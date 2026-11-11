// frontend/js/utils.js
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
      image.classList.add('img-fade-in');
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


function clearLegacyPeerLoopStorage() {
  try {
    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && (['token', 'username', 'theme'].includes(key)
        || key.startsWith('peerloop_cart_')
        || key.startsWith('peerloop:wallet-history:'))) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Could not remove legacy PeerLoop browser data:', error);
  }
}

async function checkAuthState() {
  clearLegacyPeerLoopStorage();
  try {
    const data = await window.PeerLoopApi.auth.getSession();
    if (!data) return;
    if (data.user && data.user.id && data.user.walletAddress) {
      currentUser = {
        id: String(data.user.id),
        name: String(data.user.name || ''),
        walletAddress: String(data.user.walletAddress)
      };
    }
  } catch (error) {
    console.warn('Could not restore the server session:', error);
  }
}

async function logout() {
  try {
    await window.PeerLoopApi.auth.logout();
  } catch (error) {
    console.warn('Could not clear the server session:', error);
  }
  (window as any).clearAllWalletTransactionHistoryCache?.();
  (window as any).clearUserCart?.();
  currentUser = null;
  renderUI();
  showMessage("You have been logged out.");
  showSection("hero");
}

let messageTimeoutTimer = null;
function showMessage(message: string, duration = 3500) {
  const msgBox = document.getElementById("message-box");
  if (!msgBox) return;
  if (messageTimeoutTimer) {
    clearTimeout(messageTimeoutTimer);
    messageTimeoutTimer = null;
  }

  const isSuccess = /success|added|created|saved|restored|released|refunded/i.test(message);
  const isError = /fail|error|reject|cannot|cancel|lost|unavailable/i.test(message);

  const iconSvg = isSuccess
    ? '<svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
    : isError
    ? '<svg class="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
    : '<svg class="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  msgBox.innerHTML = `
    <div class="flex items-center gap-3">
      ${iconSvg}
      <span class="text-sm font-medium leading-snug">${escapeHtml(message)}</span>
    </div>
  `;
  msgBox.classList.remove("hidden", "toast-slide-out");
  msgBox.classList.add("toast-slide-in");

  messageTimeoutTimer = setTimeout(() => {
    msgBox.classList.remove("toast-slide-in");
    msgBox.classList.add("toast-slide-out");
    setTimeout(() => {
      msgBox.classList.add("hidden");
      msgBox.classList.remove("toast-slide-out");
      messageTimeoutTimer = null;
    }, 200);
  }, duration);
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
