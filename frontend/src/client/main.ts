// frontend/js/main.js

const processedRefundUpdates = new Set<string>();
const processedSaleUpdates = new Set<string>();
const processedEscrowUpdates = new Set<string>();

document.addEventListener('DOMContentLoaded', async () => {
  readOnlyProviderReady = initializeReadOnlyProvider();
    
  // Socket.IO Configuration (guarded if socket.io is unavailable)
  let socket = null;
  if (typeof io !== 'undefined') {
    socket = io(window.PeerLoopApi.baseUrl, {
      reconnection: true,             // Enable reconnection attempts
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,         
      timeout: 20000,
      pingInterval: 10000,
    });
    
    // *** FINAL SOCKET CONNECTION HANDLERS ***
    socket.on('connect', () => {
        console.info(`Socket.IO connected (${socket.id}) via ${socket.io.engine.transport.name}.`);
        if (document.getElementById('marketplace').classList.contains('hidden') === false) {
            fetchProducts(true);
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Socket: Connection failed; automatic retries continue.', error);
    });

    socket.on('disconnect', (reason) => {
        console.error('Socket: Disconnected. Reason:', reason);
        if (reason !== 'io client disconnect') {
            showMessage("Real-time connection lost. Reconnecting...", 5000);
        }
    });
    
    socket.io.on('reconnect', () => {
        showMessage("Real-time connection restored. Refreshing...", 3000);
        if (!document.getElementById('marketplace').classList.contains('hidden')) {
            fetchProducts(true);
        }
    });
    
    socket.io.on('reconnect_error', (error) => {
        console.error('Socket: Reconnect attempt failed; automatic retries continue.', error);
    });
    
    socket.io.on('reconnect_failed', () => {
        console.error('Socket: Reconnection failed permanently.');
        showMessage("Real-time connection failed permanently. Please refresh the page.", 6000);
    });

    socket.on('product_updated', (data) => {
        if (!data || !['listed', 'sold', 'deleted', 'refunded', 'released', 'disputed', 'vote'].includes(data.type)) return;
        console.info(`Socket: Received ${data.type} update for product ${data.id ?? 'unknown'}.`);
        if (data.type === 'sold' && data.id != null) {
            applyProductSoldUpdate(String(data.id), data.name, data.tx);
        } else if (data.type === 'deleted') {
            if (data.id != null) {
                removeProductFromMarketplace(data.id);
            }
            handleRealTimeCartRemoval(data.id, data.name);
        } else if (data.type === 'refunded' && data.id != null && data.escrowId != null) {
            applyRefundUpdate(String(data.id), String(data.escrowId));
        } else if (data.type === 'released' && data.id != null && data.escrowId != null) {
            applyEscrowUpdate(String(data.id), String(data.escrowId), 2);
        } else if (data.type === 'disputed' && data.id != null && data.escrowId != null) {
            applyEscrowUpdate(String(data.id), String(data.escrowId), 4);
        } else if (data.type === 'vote' && data.id != null && data.escrowId != null) {
            void refreshEscrowStateFromChain(String(data.id), String(data.escrowId));
        }
        if (socket.connected && !['refunded', 'released', 'disputed', 'vote'].includes(data.type)) fetchProducts(true);
    });
  } else {
    console.warn("Socket.IO client library not found. Real-time updates disabled.");
  }
  
  await checkAuthState();
  renderUI();

  initializeModalListeners();
  const initialSection = ({ '/': 'hero', '/index.html': 'hero', '/marketplace': 'marketplace', '/sell': 'sell-tab' } as Record<string, string>)[window.location.pathname] || 'hero';
  showSection(initialSection);
  if (initialSection === 'sell-tab' && !currentUser) showAuthModal();
  initializeCustomSelect('category-filter', filterAndSortProducts);
  initializeCustomSelect('product-category');
  initializeCustomSelect('sort-by', filterAndSortProducts);

  await readOnlyProviderReady;

  if (readOnlyContract) {
    try {
      readOnlyContract.on('ProductSold', (productId, name, _price, _seller, _buyer, event) => {
        applyProductSoldUpdate(String(productId), String(name), event?.transactionHash);
      });
      readOnlyContract.on('EscrowRefunded', (escrowId, productId) => {
        applyRefundUpdate(String(productId), String(escrowId));
      });
      readOnlyContract.on('EscrowReleased', (escrowId, productId) => {
        applyEscrowUpdate(String(productId), String(escrowId), 2);
      });
      readOnlyContract.on('EscrowDisputed', (escrowId, productId) => {
        applyEscrowUpdate(String(productId), String(escrowId), 4);
      });
      readOnlyContract.on('EscrowResolutionVoted', (escrowId, productId) => {
        void refreshEscrowStateFromChain(String(productId), String(escrowId));
      });
    } catch (error) {
      console.error('Could not subscribe to on-chain marketplace events:', error);
    }
  }

  if (currentUser) {
    try {
      const detected = await WalletDetection.detectWalletProvider();
      const walletProvider = (detected && detected.provider) || window.ethereum;
      if (!walletProvider) {
        console.warn("No wallet provider available for auto-connect.");
      } else {
        const provider = new ethers.providers.Web3Provider(walletProvider, "any");
        const accounts = await provider.send("eth_accounts", []);
        if (accounts && accounts.length > 0) {
          const signer = provider.getSigner();
          await connectContractToSigner(signer);
        }
      }
    } catch (e) {
      console.warn("Could not auto-connect signer:", e);
    }
  }
});

function applyProductSoldUpdate(productId, name = '', transactionHash = '') {
  const updateId = transactionHash ? transactionHash.toLowerCase() : '';
  if (updateId && processedSaleUpdates.has(updateId)) return;
  if (updateId) processedSaleUpdates.add(updateId);

  removeProductFromMarketplace(productId);
  window.PeerLoopAccount?.removeListing(productId);
  window.PeerLoopAccount?.invalidateHistory();
  handleRealTimeCartRemoval(productId, name);
  fetchProducts(false, 0, false);
}

function applyRefundUpdate(productId, escrowId) {
  const updateId = `${productId}:${escrowId}`;
  if (processedRefundUpdates.has(updateId)) return;
  processedRefundUpdates.add(updateId);
  updateConfirmedEscrowState(
    productId,
    escrowId,
    3,
    currentUser?.walletAddress || ''
  );
  window.PeerLoopAccount?.refreshEscrowState(productId, escrowId, 3);
  fetchProducts(false, 0, false);
}

function applyEscrowUpdate(productId, escrowId, state) {
  const updateId = `${productId}:${escrowId}:${state}`;
  if (processedEscrowUpdates.has(updateId)) return;
  processedEscrowUpdates.add(updateId);
  updateConfirmedEscrowState(
    productId,
    escrowId,
    state,
    currentUser?.walletAddress || ''
  );
  window.PeerLoopAccount?.refreshEscrowState(productId, escrowId, state);
}

async function refreshEscrowStateFromChain(productId, escrowId) {
  try {
    await readOnlyProviderReady;
    if (!readOnlyContract) return;
    let escrow;
    if (readOnlyContract.escrowHistory) {
      try {
        escrow = await readOnlyContract.escrowHistory(escrowId);
      } catch (error) {
        if (error.code !== 'CALL_EXCEPTION') throw error;
        escrow = await readOnlyContract.getEscrow(productId);
      }
    } else {
      escrow = await readOnlyContract.getEscrow(productId);
    }
    const state = Number(escrow.state);
    if (state >= 1 && state <= 5) applyEscrowUpdate(productId, escrowId, state);
  } catch (error) {
    console.warn(`Could not refresh escrow ${escrowId} after a resolution vote:`, error);
  }
}

function initializeModalListeners() {
    const confirmBtn = document.getElementById('confirm-action-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    confirmBtn.addEventListener('click', async () => {
        if (typeof currentConfirmAction !== 'function') return closeConfirmationModal();
        setButtonLoading(confirmBtn, true, 'Confirming...');
        try { await currentConfirmAction(); } 
        catch (error) { console.error("Confirmation action failed:", error); } 
        finally { setButtonLoading(confirmBtn, false); closeConfirmationModal(); }
    });
    cancelBtn.addEventListener('click', closeConfirmationModal);
}

// --- Nav & Page Event Listeners ---
document.getElementById('nav-home-btn').addEventListener('click', () => showSection('hero'));
document.getElementById('hero-explore-btn').addEventListener('click', () => showSection('marketplace'));
document.getElementById('nav-explore-btn').addEventListener('click', () => showSection('marketplace'));
document.getElementById('nav-about-btn').addEventListener('click', () => document.getElementById('services').scrollIntoView({ behavior: 'smooth' }));
document.getElementById('services-back-btn')?.addEventListener('click', () => showSection('hero'));
document.getElementById('nav-sell-btn').addEventListener('click', () => { showSection('sell-tab'); if (!currentUser) showAuthModal(); });
document.getElementById('hero-sell-btn').addEventListener('click', () => { showSection('sell-tab'); if (!currentUser) showAuthModal(); });
document.getElementById('nav-cart-btn').addEventListener('click', () => currentUser ? (showSection('cart-tab'), renderCart()) : showAuthModal());
document.getElementById('checkout-btn').addEventListener('click', e => checkout(e.currentTarget));

// --- Auth Modal & Form Event Listeners ---
document.getElementById('close-modal-btn').addEventListener('click', closeAuthModal);
document.getElementById("metamask-login-btn").addEventListener("click", e => handleMetaMaskLogin(e.currentTarget));

// --- Profile Dropdown Event Listeners ---
document.getElementById('profile-dropdown-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profile-dropdown-menu').classList.toggle('hidden');
});
document.getElementById('logout-btn').addEventListener('click', logout);

// --- Marketplace Filter Event Listeners ---
document.getElementById('search-input').addEventListener('input', filterAndSortProducts);
const priceFilter = document.getElementById('price-filter');
priceFilter.addEventListener('input', filterAndSortProducts);
document.getElementById('available-only').addEventListener('change', filterAndSortProducts);

// --- Sell Form & Image Uploader Event Listeners ---
const uploader = document.getElementById('image-uploader');
const fileInput = document.getElementById('product-photo');
let selectedListingImages = [];
let listingPreviewUrls = [];
uploader.addEventListener('click', e => { if (!(e.target as Element).closest('label')) fileInput.click(); });
uploader.addEventListener('dragover', e => { e.preventDefault(); uploader.classList.add('drag-over'); });
uploader.addEventListener('dragleave', () => uploader.classList.remove('drag-over'));
uploader.addEventListener('drop', e => {
  e.preventDefault();
  uploader.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) handleFileChange(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => {
  handleFileChange(fileInput.files);
  fileInput.value = '';
});
document.getElementById("create-listing-form").addEventListener("submit", createListingFormHandler);

function handleFileChange(files: FileList | File[] | null) {
  const incoming = Array.from(files || []);
  if (!incoming.length) return;
  const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const rejected = [];
  for (const file of incoming) {
    if (!acceptedTypes.has((file.type || '').toLowerCase())) { rejected.push(`${file.name}: use a JPEG, PNG, GIF or WebP image.`); continue; }
    if (file.size > 5 * 1024 * 1024) { rejected.push(`${file.name}: image exceeds 5 MB.`); continue; }
    if (selectedListingImages.length >= 8) { rejected.push('You can select up to 8 images.'); break; }
    const duplicate = selectedListingImages.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified);
    if (!duplicate) selectedListingImages.push(file);
  }
  renderListingImagePreviews();
  if (rejected.length) showMessage(rejected.join(' '));
}

function renderListingImagePreviews() {
  listingPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  listingPreviewUrls = [];
  const wrapper = document.getElementById('image-preview');
  const grid = document.getElementById('image-preview-grid');
  const nameDisplay = document.getElementById('file-name-display');
  grid.replaceChildren();
  if (!selectedListingImages.length) {
    wrapper.classList.add('hidden');
    nameDisplay.textContent = '';
    return;
  }
  wrapper.classList.remove('hidden');
  nameDisplay.textContent = `${selectedListingImages.length} image${selectedListingImages.length === 1 ? '' : 's'} selected`;
  selectedListingImages.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'image-preview-card';
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.alt = file.name;
    listingPreviewUrls.push(image.src);
    card.appendChild(image);
    const name = document.createElement('span');
    name.className = 'image-preview-name';
    name.textContent = file.name;
    card.appendChild(name);
    if (index === 0) {
      const cover = document.createElement('span');
      cover.className = 'image-preview-cover';
      cover.textContent = 'COVER';
      card.appendChild(cover);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'image-preview-remove';
    remove.textContent = '\u00d7';
    remove.title = `Remove ${file.name}`;
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => {
      selectedListingImages.splice(index, 1);
      renderListingImagePreviews();
    });
    card.appendChild(remove);
    grid.appendChild(card);
  });
}

function clearListingImageSelection() {
  selectedListingImages = [];
  fileInput.value = '';
  renderListingImagePreviews();
}
function getListingErrorMessage(error) {
  if (error.code === 'USER_REJECTED_TRANSACTION' || error.code === 4001) {
    return "Transaction was cancelled in your wallet.";
  }
  if (error.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(error.message || '')) {
    return "Your wallet does not have enough Sepolia ETH to pay the transaction fee.";
  }

  const reason = [
    error.reason,
    error.error?.reason,
    error.data?.message,
    error.error?.data?.message,
    error.error?.message,
    error.message
  ].find((candidate) => typeof candidate === 'string'
    && candidate.trim()
    && !/^transaction failed\.?$/i.test(candidate.trim()));
  if (reason) {
    return reason.trim().replace(/^execution reverted:\s*/i, '');
  }

  const transactionHash = error.transactionHash || error.receipt?.transactionHash;
  if (transactionHash) {
    return `Listing transaction failed. View the reverted transaction on Sepolia Etherscan: https://sepolia.etherscan.io/tx/${transactionHash}`;
  }
  return "Listing transaction failed. Confirm your wallet is on Sepolia and has enough Sepolia ETH for gas, then check the browser console for details.";
}

async function createListingFormHandler(e) {
  e.preventDefault();
  if (!currentUser) return showMessage("You must be logged in.");
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please wait and try again."); 

  const buttonElement = e.submitter;
  setButtonLoading(buttonElement, true, 'Checking...');
  
  const name = document.getElementById("product-name").value.trim();
  const description = document.getElementById("product-desc").value.trim();
  const priceString = document.getElementById("product-price").value;
  const category = (document.querySelector("#product-category input[type='hidden']") as HTMLInputElement).value;
  const imagesToUpload = [...selectedListingImages]
  const file = imagesToUpload[0];

  if (!name || !description || !priceString || !file) {
    setButtonLoading(buttonElement, false);
    return showMessage("Please fill all fields and select at least one image.");
  }
  const encoder = new TextEncoder();
  if (encoder.encode(name).length > 100) {
    setButtonLoading(buttonElement, false);
    return showMessage("Product name must be 100 UTF-8 bytes or fewer.");
  }
  if (encoder.encode(description).length > 2000) {
    setButtonLoading(buttonElement, false);
    return showMessage("Product description must be 2,000 UTF-8 bytes or fewer.");
  }
  let priceInWei;
  try {
    priceInWei = ethers.BigNumber.from(window.PeerLoopMoney.toWei(priceString).toString());
  } catch {
      setButtonLoading(buttonElement, false);
      return showMessage("Price must be a valid positive ETH amount with at most 18 decimal places.");
  }
  if (priceInWei.isZero()) {
    setButtonLoading(buttonElement, false);
    return showMessage("Price must be greater than 0.");
  }

  let listingConfirmed = false;
  try {
    await ensureSepoliaNetwork(walletProvider);
    const imageUrls = [];
    for (let index = 0; index < imagesToUpload.length; index++) {
      setButtonLoading(buttonElement, true, `Uploading image ${index + 1} of ${imagesToUpload.length}...`);
      const uploadData = await window.PeerLoopApi.uploads.uploadImage(imagesToUpload[index]);
      if (!uploadData.imageUrl) throw new Error(`Image ${index + 1} did not return a usable URL.`);
      imageUrls.push(uploadData.imageUrl);
    }
    const imageUrl = JSON.stringify(imageUrls);
    if (encoder.encode(imageUrl).length > 4096) {
      throw new Error("Image metadata must be 4,096 UTF-8 bytes or fewer.");
    }
    setButtonLoading(buttonElement, true, 'Listing on Blockchain...');
    showMessage("Sending transaction... Please check your wallet.");
    const tx = await marketplaceContract.listProduct(name, description, priceInWei, imageUrl);
    const receipt = await tx.wait();
    listingConfirmed = true;
    const listingEvent = receipt.logs
      .map((log) => {
        try {
          return marketplaceContract.interface.parseLog(log);
        } catch (_) {
          return null;
        }
      })
      .find((event) => event && event.name === 'ProductListed');
    if (!listingEvent) {
      throw new Error('The listing was confirmed, but its product ID could not be read from the transaction.');
    }

      await window.PeerLoopApi.listingMetadata.saveCategory(
        listingEvent.args.id.toString(),
        category,
        'Could not save the selected category.'
      );

    showMessage("Product listed successfully!");
    
    document.getElementById("create-listing-form").reset();
    clearListingImageSelection();
    const categoryContainer = document.getElementById('product-category');
    categoryContainer.querySelector('span').textContent = 'Electronics';
    (categoryContainer.querySelector('input[type="hidden"]') as HTMLInputElement).value = 'electronics';

    window.PeerLoopAccount.setView('listings');
    showSection('user-profile-tab');
    setButtonLoading(buttonElement, false);
    
  } catch(error) { 
    console.error(error);
    if (listingConfirmed) {
      showMessage(`Listing confirmed, but its category could not be saved: ${error.message}`);
    } else {
      showMessage(getListingErrorMessage(error));
    }
  } finally {
    setButtonLoading(buttonElement, false);
  }
}

async function renderSellerProfile(sellerId, sellerName) {
  const heading = document.getElementById('seller-profile-heading');
  const grid = document.getElementById('seller-profile-grid');
  heading.textContent = `Gears from ${sellerName}`;
  showSection('seller-profile-tab');
  
  const loadingMessage = document.createElement('p');
  loadingMessage.className = 'text-center text-gray-500 col-span-full';
  loadingMessage.textContent = 'No items.';
  grid.replaceChildren(loadingMessage);
  
  try {
    // FIX: Use up-to-date products fetched from the blockchain
    await fetchProducts(false); 
    
    const sellerProducts = allProducts.filter(p => p.seller.toLowerCase() === sellerId.toLowerCase());
    grid.innerHTML = '';
    if (sellerProducts.length === 0) {
      grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No items.</p>`;
      return;
    }
    sellerProducts.forEach(product => grid.appendChild(createProductCard(product)));
  } catch (error) {
    const errorMessage = document.createElement('p');
    errorMessage.className = 'text-center text-red-500 col-span-full';
    errorMessage.textContent = `Could not load items: ${error.message}`;
    grid.replaceChildren(errorMessage);
  }
}
