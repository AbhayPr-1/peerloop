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

function createProfileProductCard(product, context) {
    const card = document.createElement("div");
    card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col";
    let contextInfo = '';
    let actionButtons = '';
    
    const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';
    let historyInfo = '';
    if (context === 'sold' || context === 'purchased') {
        const completedAt = product.soldAt
            ? new Date(product.soldAt).toLocaleString()
            : `Block ${Number(product.blockNumber) || 'unknown'}`;
        const transactionLink = /^0x[a-f0-9]{64}$/i.test(product.transactionHash || '')
            ? `<a class="text-neon-blue underline text-sm" href="https://sepolia.etherscan.io/tx/${product.transactionHash}" target="_blank" rel="noopener noreferrer">View transaction</a>`
            : '';
        historyInfo = `<p class="text-xs text-gray-500 mb-2">${context === 'purchased' ? 'Purchase recorded' : 'Sale recorded'} ${escapeHtml(completedAt)}</p>${transactionLink}`;
    }

    const sellerAddressDisplay = formatAddress(product.seller);
    const buyerAddressDisplay = formatAddress(product.buyer);


    if (context === 'sold' && product.buyer) {
        contextInfo = `<p class="text-sm text-green-400 mb-2" style="overflow-wrap: break-word;">Sold to: ${escapeHtml(product.buyer.name || buyerAddressDisplay)}</p>`;
    } else if (context === 'purchased' && product.seller) {
        contextInfo = `<p class="text-sm text-yellow-400 mb-2" style="overflow-wrap: break-word;">Purchased from: ${escapeHtml(product.seller.name || sellerAddressDisplay)}</p>`;
    } else if (context === 'listings') {
         contextInfo = `<p class="text-sm text-blue-400 mb-2">Status: Listed for sale</p>`;
         actionButtons = `
            <div class="grid grid-cols-1 gap-3 mt-4">
                <label class="text-sm text-gray-400">
                    Category
                    <select class="listing-category-select w-full mt-1 p-2 rounded-xl auth-input">
                        ${Object.entries(categoryDisplayMap).map(([value, label]) => `<option value="${value}"${product.category === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
                    </select>
                </label>
                <button class="modern-button-secondary save-listing-category-btn">Save Category</button>
                <button class="modern-button-secondary delete-listing-btn !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white">Delete</button>
            </div>
         `;
    }

    card.innerHTML = `
        <div class="profile-image-gallery-slot"></div>
        <h3 class="text-2xl font-bold text-neon-blue mb-2">${escapeHtml(product.name)}</h3>
        ${contextInfo}
        ${historyInfo}
        <p class="text-gray-400 flex-1 mb-4">${escapeHtml(product.description)}</p>
        <div class="flex items-center justify-between">
            <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
            <span class="category-label text-xs px-2 py-1 rounded bg-gray-700">${escapeHtml(displayCategory)}</span>
        </div>
        ${actionButtons}
        ${context === 'purchased' ? '<div class="escrow-status mt-4 text-sm" data-product-id="' + escapeHtml(product._id) + '">Loading escrow status...</div>' : ''}
    `;
    card.querySelector('.profile-image-gallery-slot').replaceWith(createProductImageGallery(product.imageUrl, product.name, 'profile'));

    if (context === 'purchased') {
        renderEscrowStatus(String(product._id), card.querySelector('.escrow-status'));
    }

    if (context === 'listings') {
        const saveCategoryBtn = card.querySelector('.save-listing-category-btn');
        if (saveCategoryBtn) {
            saveCategoryBtn.addEventListener('click', async () => {
                const category = (card.querySelector('.listing-category-select') as HTMLInputElement).value;
                setButtonLoading(saveCategoryBtn, true, 'Saving...');
                try {
                    const response = await fetch(`${API_URL}/api/listing-metadata`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-token': localStorage.getItem('token')
                        },
                        body: JSON.stringify({ productId: product._id, category })
                    });
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.msg || 'Could not save the category.');
                    }
                    product.category = category;
                    const currentProduct = allProducts.find((item) => item._id === product._id);
                    if (currentProduct) currentProduct.category = category;
                    (card.querySelector('.listing-category-select') as HTMLInputElement).value = category;
                    card.querySelector('.category-label').textContent = categoryDisplayMap[category];
                    showMessage('Listing category updated.');
                } catch (error) {
                    console.error('Could not update listing category:', error);
                    showMessage(error.message || 'Could not save the category.');
                } finally {
                    setButtonLoading(saveCategoryBtn, false);
                }
            });
        }

        const deleteBtn = card.querySelector('.delete-listing-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                const buttonThatWasClicked = e.currentTarget;
                const message = `Are you sure you want to permanently delete this listing from the blockchain? This action cannot be undone.`;
                showConfirmationModal(message, () => deleteProduct(product._id, buttonThatWasClicked));
            });
        }
    }

    return card;
}

async function renderEscrowStatus(productId, container, confirmedState = null, historyRecord = null) {
    if (!container) return;
    container.replaceChildren();

    try {
        await readOnlyProviderReady;
        if (!readOnlyContract) throw new Error('Marketplace contract is not connected.');
        const escrow = await readOnlyContract.getEscrow(productId);
        const escrowId = escrow.id.toString();
        const status = document.createElement('p');
        status.className = 'text-sm text-gray-400 mb-2';

        if (historyRecord && !historyRecord.escrowId) {
            status.textContent = 'No escrow recorded for this purchase.';
            container.appendChild(status);
            return;
        }

        if (escrowId === '0') {
            status.textContent = 'No escrow recorded for this purchase.';
            container.appendChild(status);
            return;
        }

        const escrowState = confirmedState
            ?? (historyRecord ? Number(historyRecord.escrowState) : Number(escrow.state));
        const stateLabels = {
            1: 'Payment held in escrow',
            2: 'Payment released to seller',
            3: 'Payment refunded',
            4: 'Escrow disputed'
        };
        status.textContent = stateLabels[escrowState] || 'Unknown escrow state';
        container.appendChild(status);

        if (historyRecord && historyRecord.escrowId !== escrowId) return;
        if ((escrowState !== 1 && escrowState !== 4)
            || !currentUser
            || String(escrow.buyer).toLowerCase() !== currentUser.walletAddress.toLowerCase()) {
            return;
        }

        const buttons = document.createElement('div');
        buttons.className = 'escrow-actions';
        if (escrowState === 1) {
            const releaseButton = document.createElement('button');
            releaseButton.type = 'button';
            releaseButton.className = 'modern-button-secondary';
            releaseButton.textContent = 'Release payment';
            releaseButton.addEventListener('click', () => {
                showConfirmationModal(
                    'Release escrow payment to the seller? This transfer cannot be undone.',
                    () => submitEscrowAction(productId, escrowId, 'releaseEscrow', releaseButton, container)
                );
            });
            buttons.appendChild(releaseButton);
        } else {
            status.textContent = 'Escrow disputed; release is unavailable. You may refund the funds.';
        }

        const refundButton = document.createElement('button');
        refundButton.type = 'button';
        refundButton.className = 'modern-button-secondary !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white';
        refundButton.textContent = 'Refund to me';
        buttons.appendChild(refundButton);
        container.appendChild(buttons);

        refundButton.addEventListener('click', () => {
            showConfirmationModal(
                'Refund this escrow payment to your wallet? The contract will return the funds immediately if the transaction succeeds.',
                () => submitEscrowAction(productId, escrowId, 'refundEscrow', refundButton, container)
            );
        });
    } catch (error) {
        console.error(`Could not load escrow status for product ${productId}:`, error);
        container.textContent = 'Escrow status unavailable. Please try again later.';
    }
}

async function submitEscrowAction(productId, escrowId, method, button, container) {
    if (!marketplaceContract || !signer) {
        showMessage('Connect your wallet again to manage escrow.');
        return;
    }

    setButtonLoading(button, true, 'Processing...');
    try {
        await ensureSepoliaNetwork();
        const tx = await marketplaceContract[method](productId);
        showMessage('Escrow transaction submitted. Waiting for confirmation...');
        await tx.wait();
        invalidateWalletTransactionHistory();
        const confirmedState = method === 'releaseEscrow' ? 2 : 3;
        updateConfirmedEscrowState(productId, escrowId, confirmedState);
        refreshAccountDashboardEscrowState(productId, escrowId, confirmedState);
        if (method === 'refundEscrow') {
            realtimeRemovedProductIds.delete(String(productId));
            fetchProducts(false);
        }
        showMessage(method === 'releaseEscrow'
            ? 'Payment released to the seller.'
            : "Escrow funds refunded and the item returned to the seller's active listings.");
        await renderEscrowStatus(productId, container, confirmedState);
    } catch (error) {
        console.error(`Could not ${method} for product ${productId}:`, error);
        showMessage(error.reason || error.message || 'Escrow transaction failed.');
        setButtonLoading(button, false);
    }
}