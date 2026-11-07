// frontend/js/utils.js
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = window.PEERLOOP_API_URL
  || (isLocalHost ? `http://${window.location.hostname}:5001` : window.location.origin);
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/'
];
const IMAGE_LOAD_TIMEOUT_MS = 2500;
const IMAGE_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#17212b"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle">Image unavailable</text></svg>'
)}`;

function getProductImageUrls(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
  } catch (_) {}
  return [raw];
}
function getImageSources(value) {
  const rawValue = getProductImageUrls(value)[0] || '';
  if (!rawValue) return [IMAGE_PLACEHOLDER];

  try {
    const url = new URL(rawValue, window.location.href);
    let ipfsPath = '';
    if (url.protocol === 'ipfs:') {
      ipfsPath = `${url.hostname}${url.pathname}${url.search}${url.hash}`.replace(/^ipfs\//, '');
    } else {
      const markerIndex = url.pathname.indexOf('/ipfs/');
      if (markerIndex !== -1) {
        ipfsPath = `${url.pathname.slice(markerIndex + 6)}${url.search}${url.hash}`;
      }
    }

    if (ipfsPath && !ipfsPath.split('/').includes('..')) {
      return IPFS_GATEWAYS.map(gateway => `${gateway}${ipfsPath}`);
    }
    if (url.protocol === 'https:' || url.protocol === 'http:') return [url.href];
  } catch (_) {
    return [IMAGE_PLACEHOLDER];
  }
  return [IMAGE_PLACEHOLDER];
}

function setResilientImage(image, value) {
  const sources = getImageSources(value);
  let sourceIndex = 0;
  let loadTimer = null;
  let activeSource = '';
  let started = false;
  let observer = null;

  image.loading = 'lazy';
  image.decoding = 'async';
  image.style.backgroundColor = '#17212b';

  const showNextSource = () => {
    clearTimeout(loadTimer);
    if (sourceIndex >= sources.length) {
      image.src = IMAGE_PLACEHOLDER;
      return;
    }
    activeSource = sources[sourceIndex++];
    image.src = activeSource;
    if (activeSource !== IMAGE_PLACEHOLDER && sources.length > 1) {
      loadTimer = setTimeout(() => {
        if (!image.complete || image.naturalWidth === 0) showNextSource();
      }, IMAGE_LOAD_TIMEOUT_MS);
    }
  };

  const startLoading = () => {
    if (started) return;
    started = true;
    if (observer) observer.disconnect();
    showNextSource();
  };

  image.addEventListener('load', () => {
    if (image.currentSrc === activeSource || image.src === activeSource) {
      clearTimeout(loadTimer);
    }
  });
  image.addEventListener('error', () => {
    if (image.currentSrc === activeSource || image.src === activeSource) showNextSource();
  });
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) startLoading();
    });
    observer.observe(image);
  } else {
    startLoading();
  }
}

function createProductImageGallery(value, altText = '', variant = '', onMainClick = null) {
  const urls = getProductImageUrls(value);
  const gallery = document.createElement('div');
  gallery.className = `product-image-gallery${variant ? ` ${variant}` : ''}`;
  let mainImage = document.createElement('img');
  mainImage.className = 'gallery-main';
  mainImage.alt = altText;
  gallery.appendChild(mainImage);
  setResilientImage(mainImage, urls[0] || '');

  if (typeof onMainClick === 'function') {
    gallery.addEventListener('click', event => {
      const target = event.target as Element;
      if (target.closest('.gallery-thumbnails')) return;
      if (target.closest('.gallery-main')) onMainClick(event);
    });
  }

  if (urls.length > 1) {
    const thumbnails = document.createElement('div');
    thumbnails.className = 'gallery-thumbnails';
    urls.forEach((url, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `gallery-thumb${index === 0 ? ' active' : ''}`;
      button.setAttribute('aria-label', `Show image ${index + 1} of ${urls.length}`);
      button.title = `Image ${index + 1} of ${urls.length}`;
      const thumb = document.createElement('img');
      thumb.alt = '';
      setResilientImage(thumb, url);
      button.appendChild(thumb);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const replacement = document.createElement('img');
        replacement.className = 'gallery-main';
        replacement.alt = altText;
        mainImage.replaceWith(replacement);
        mainImage = replacement;
        setResilientImage(mainImage, url);
        thumbnails.querySelectorAll('.gallery-thumb').forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === index));
      });
      thumbnails.appendChild(button);
    });
    gallery.appendChild(thumbnails);
  }
  return gallery;
}
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

let currentUser = null;
let allProducts = [];
let purchaseIntentProductId = null;

const categoryDisplayMap = {
    'electronics': 'Electronics',
    'wearables': 'Wearables',
    'cybernetics': 'Cybernetics',
    'data': 'Data & Software',
    'gadgets': 'Gadgets',
    'others': 'Others'
};

// *** NEW FUNCTION ***
function formatAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
// *** END NEW FUNCTION ***


function checkAuthState() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.authVersion === 2 && payload.exp * 1000 > Date.now()) {
        currentUser = { 
          id: payload.user.id, 
          name: payload.user.name, 
          walletAddress: payload.user.walletAddress 
        };
        if(!currentUser.name) currentUser.name = localStorage.getItem('username');
      } else {
        logout();
      }
    } catch (e) {
      console.error("Auth check failed:", e);
      logout();
    }
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  if (currentUser) {
    localStorage.removeItem(`peerloop_cart_${currentUser.id}`);
  }
  currentUser = null;
  renderUI();
  showMessage("You have been logged out.");
  showSection("hero");
}

function showMessage(message, duration = 3000) {
  const msgBox = document.getElementById("message-box");
  msgBox.textContent = message;
  msgBox.classList.remove("hidden");
  setTimeout(() => msgBox.classList.add("hidden"), duration);
}

function setButtonLoading(button, isLoading, loadingText = 'Loading...') {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.innerHTML = `<span class="loader"></span> ${loadingText}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
          button.innerHTML = button.dataset.originalText;
          delete button.dataset.originalText;
        }
    }
}
