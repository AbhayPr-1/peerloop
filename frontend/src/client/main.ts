// frontend/js/main.js

document.addEventListener('DOMContentLoaded', async () => {
  readOnlyProviderReady = initializeReadOnlyProvider();
    
  // Socket.IO Configuration (guarded if socket.io is unavailable)
  let socket = null;
  if (typeof io !== 'undefined') {
    socket = io(API_URL, {
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
        if (!data || !['listed', 'sold', 'deleted'].includes(data.type)) return;
        console.info(`Socket: Received ${data.type} update for product ${data.id ?? 'unknown'}.`);
        if (data.type === 'sold' || data.type === 'deleted') {
            if (data.id != null) {
                const productId = String(data.id);
                realtimeRemovedProductIds.add(productId);
                allProducts = allProducts.filter(product => String(product._id) !== productId);
                filterAndSortProducts();
            }
            handleRealTimeCartRemoval(data.id, data.name);
        }
        if (socket.connected) fetchProducts(true);
    });
  } else {
    console.warn("Socket.IO client library not found. Real-time updates disabled.");
  }
  
  checkAuthState();
  renderUI();

  initializeModalListeners();
  const initialSection = ({ '/': 'hero', '/index.html': 'hero', '/marketplace': 'marketplace', '/sell': 'sell-tab' } as Record<string, string>)[window.location.pathname] || 'hero';
  showSection(initialSection);
  if (initialSection === 'sell-tab' && !currentUser) showAuthModal();
  initializeCustomSelect('category-filter', filterAndSortProducts);
  initializeCustomSelect('product-category');
  initializeCustomSelect('sort-by', filterAndSortProducts);

  await readOnlyProviderReady;

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
window.showEscrowDashboard = function (purchase) {
  if (!currentUser) return showAuthModal();
  accountDashboardView = 'escrow';
  accountDashboardOptimisticHistory = purchase
    ? { purchased: [purchase], sold: [] }
    : null;
  showSection('user-profile-tab');
};
window.refreshAccountDashboardEscrowState = function (productId, escrowId, state) {
  if (!accountDashboardHistory) return;
  for (const item of [...accountDashboardHistory.purchased, ...accountDashboardHistory.sold]) {
    if (item._id !== String(productId) || String(item.escrowId) !== String(escrowId)) continue;
    item.escrowState = Number(state);
    item.refunded = Number(state) === 3;
  }
  const ownedItems = accountDashboardHistory.purchased.filter(item => !item.refunded
    && !accountDashboardHistory.sold.some(sold => sold._id === item._id
      && !sold.refunded && Number(sold.blockNumber) > Number(item.blockNumber)));
  const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
  document.getElementById('profile-owned-value').textContent = `${ownedValue.toFixed(4)} ETH`;
  document.getElementById('profile-sold-count').textContent = String(
    accountDashboardHistory.sold.filter(item => !item.refunded).length
  );
  paintAccountActivityRows();
};
document.getElementById('nav-escrow-btn').addEventListener('click', () => window.showEscrowDashboard());
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
  const priceNumber = parseFloat(priceString);
  if (isNaN(priceNumber) || priceNumber <= 0) {
      setButtonLoading(buttonElement, false);
      return showMessage("Price must be a number greater than 0.");
  }

  let listingConfirmed = false;
  try {
    await ensureSepoliaNetwork(walletProvider);
    const imageUrls = [];
    for (let index = 0; index < imagesToUpload.length; index++) {
      setButtonLoading(buttonElement, true, `Uploading image ${index + 1} of ${imagesToUpload.length}...`);
      const formData = new FormData();
      formData.append('productImage', imagesToUpload[index]);
      const uploadResponse = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { 'x-auth-token': localStorage.getItem('token') },
        body: formData
      });
      if (!uploadResponse.ok) {
        let errorMsg = 'Image upload failed.';
        try {
          const err = await uploadResponse.json();
          errorMsg = err.msg || err.error || errorMsg;
        } catch (_) {
          const text = await uploadResponse.text();
          if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }
      const uploadData = await uploadResponse.json();
      if (!uploadData.imageUrl) throw new Error(`Image ${index + 1} did not return a usable URL.`);
      imageUrls.push(uploadData.imageUrl);
    }
    const imageUrl = JSON.stringify(imageUrls);
    setButtonLoading(buttonElement, true, 'Listing on Blockchain...');
    const priceInWei = ethers.utils.parseEther(priceString);
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

    const categoryResponse = await fetch(`${API_URL}/api/listing-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': localStorage.getItem('token')
      },
      body: JSON.stringify({ productId: listingEvent.args.id.toString(), category })
    });
    if (!categoryResponse.ok) {
      let errorMessage = 'Could not save the selected category.';
      try {
        const errorData = await categoryResponse.json();
        errorMessage = errorData.msg || errorMessage;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    showMessage("Product listed successfully!");
    
    document.getElementById("create-listing-form").reset();
    clearListingImageSelection();
    const categoryContainer = document.getElementById('product-category');
    categoryContainer.querySelector('span').textContent = 'Electronics';
    (categoryContainer.querySelector('input[type="hidden"]') as HTMLInputElement).value = 'electronics';

    accountDashboardView = 'listings';
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
document.getElementById('nav-profile-btn').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('profile-dropdown-menu').classList.add('hidden');
  if (!currentUser) return showAuthModal();
  showSection('user-profile-tab');
});

let accountDashboardHistory = null;
let accountDashboardListings = null;
let accountDashboardListingsError = null;
let accountDashboardListingsLoading = false;
let accountDashboardView = 'purchased';
let accountDashboardRequestId = 0;
let accountDashboardOptimisticHistory = null;

async function renderUserProfileDashboard() {
  if (!currentUser) return showAuthModal();
  const requestId = ++accountDashboardRequestId;
  const name = currentUser.name || 'PeerLoop member';
  const wallet = currentUser.walletAddress || '';
  const avatarText = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
  document.getElementById('profile-display-name').textContent = name;
  document.getElementById('profile-avatar').textContent = avatarText;
  document.getElementById('profile-wallet-address').textContent = wallet;
  document.getElementById('profile-activity-rows').innerHTML = '<tr><td colspan="7" class="profile-empty">Loading on-chain activity.</td></tr>';
  document.getElementById('profile-listings-grid').replaceChildren();
  accountDashboardHistory = accountDashboardOptimisticHistory;
  accountDashboardOptimisticHistory = null;
  accountDashboardListings = null;
  accountDashboardListingsError = null;
  accountDashboardListingsLoading = true;
  document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(button => button.classList.toggle('active', button.dataset.profileTable === accountDashboardView));
  const address = wallet.toLowerCase();
  if (accountDashboardHistory) {
    const optimisticHistory = accountDashboardHistory;
    const optimisticOwnedItems = optimisticHistory.purchased.filter(item => !item.refunded);
    const optimisticOwnedValue = optimisticOwnedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
    document.getElementById('profile-owned-value').textContent = `${optimisticOwnedValue.toFixed(4)} ETH`;
    document.getElementById('profile-sold-count').textContent = String(optimisticHistory.sold.filter(item => !item.refunded).length);
    paintAccountActivityRows();
  }
  const historyPromise = getWalletTransactionHistory(wallet).then(history => {
    if (requestId !== accountDashboardRequestId) return;
    accountDashboardHistory = history;
    const ownedItems = history.purchased.filter(item => !item.refunded
      && !history.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
    const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
    document.getElementById('profile-owned-value').textContent = `${ownedValue.toFixed(4)} ETH`;
    document.getElementById('profile-sold-count').textContent = String(history.sold.filter(item => !item.refunded).length);
    paintAccountActivityRows();
  });
  const listingPromise = loadProductsFromChain().then(products => {
    if (requestId !== accountDashboardRequestId) return;
    accountDashboardListings = products.filter(item => item.seller.toLowerCase() === address && !item.isSold);
    accountDashboardListingsError = null;
    document.getElementById('profile-listing-count').textContent = String(accountDashboardListings.length);
    accountDashboardListingsLoading = false;
    if (accountDashboardView === 'listings') paintAccountActivityRows();
  });
  const [historyResult, listingResult] = await Promise.allSettled([historyPromise, listingPromise]);
  if (requestId !== accountDashboardRequestId) return;
  const historyOk = historyResult.status === 'fulfilled';
  const listingOk = listingResult.status === 'fulfilled';
  if (!historyOk && !accountDashboardHistory) {
    document.getElementById('profile-owned-value').textContent = 'Unavailable';
    document.getElementById('profile-sold-count').textContent = 'Unavailable';
    const row = document.createElement('tr');
    const message = document.createElement('td');
    message.colSpan = 7;
    message.className = 'profile-empty';
    message.textContent = 'Could not load transaction history. Please try again.';
    row.appendChild(message);
    document.getElementById('profile-activity-rows').replaceChildren(row);
  }
  if (!listingOk) {
    accountDashboardListings = null;
    accountDashboardListingsError = listingResult.reason;
    accountDashboardListingsLoading = false;
    document.getElementById('profile-listing-count').textContent = 'Unavailable';
    if (accountDashboardView === 'listings') paintAccountActivityRows();
  }
  if (!historyOk || !listingOk) {
    const issues = [];
    if (!historyOk) issues.push('transaction history');
    if (!listingOk) issues.push('active listings');
    showMessage(`Some profile data could not be loaded (${issues.join(' and ')}).`, 4500);
  }
}

function paintAccountActivityRows() {
  const tbody = document.getElementById('profile-activity-rows');
  const listingGrid = document.getElementById('profile-listings-grid');
  const tableWrap = document.querySelector('#user-profile-tab .profile-table-wrap');
  if (!tbody || !listingGrid || !tableWrap) return;
  const isListings = accountDashboardView === 'listings';
  listingGrid.classList.toggle('hidden', !isListings);
  tableWrap.classList.toggle('hidden', isListings);
  document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.profileTable === accountDashboardView);
  });
  const heading = document.getElementById('profile-activity-heading');
  const counterpartyHeading = document.getElementById('profile-counterparty-heading');
  if (heading) {
    heading.textContent = isListings ? 'My Listings'
      : accountDashboardView === 'sold' ? 'Sold History'
        : isEscrowView() ? 'Escrow' : 'My Purchases';
  }
  if (counterpartyHeading) counterpartyHeading.textContent = accountDashboardView === 'sold' ? 'Buyer' : 'Seller';

  if (isListings) {
    listingGrid.replaceChildren();
    if (accountDashboardListings === null) {
      const errorMessage = document.createElement('p');
      errorMessage.className = 'profile-empty col-span-full';
      errorMessage.textContent = accountDashboardListingsLoading
        ? 'Loading your listings…'
        : `Could not load listings: ${accountDashboardListingsError?.message || 'Please try again.'}`;
      listingGrid.appendChild(errorMessage);
      return;
    }
    if (!accountDashboardListings.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'profile-empty col-span-full';
      emptyState.textContent = 'You have no active listings.';
      listingGrid.appendChild(emptyState);
      return;
    }
    accountDashboardListings.forEach(product => {
      listingGrid.appendChild(createProfileProductCard({
        _id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        seller: product.seller,
        imageUrl: product.imageUrl,
        category: product.category,
        isSold: product.isSold
      }, 'listings'));
    });
    return;
  }

  if (!accountDashboardHistory) {
    tbody.innerHTML = '<tr><td colspan="7" class="profile-empty">Profile activity is not available yet.</td></tr>';
    return;
  }
  const isSold = accountDashboardView === 'sold';
  const isEscrow = isEscrowView();
  const data = isSold
    ? accountDashboardHistory.sold
    : isEscrow
      ? accountDashboardHistory.purchased.filter(item => item.escrowId)
      : accountDashboardHistory.purchased.filter(item => !item.refunded
        && !accountDashboardHistory.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
  tbody.replaceChildren();
  if (!data.length) {
    const row = document.createElement('tr');
    const emptyMessage = isSold
      ? 'No completed sales found for this wallet.'
      : isEscrow ? 'No escrow purchases found for this wallet.' : 'No purchased items found for this wallet.';
    row.innerHTML = `<td colspan="7" class="profile-empty">${emptyMessage}</td>`;
    tbody.appendChild(row);
    return;
  }
  data.forEach(item => {
    const row = document.createElement('tr');
    const imageCell = document.createElement('td');
    const itemCell = document.createElement('div');
    itemCell.className = 'profile-item';
    const imageGallery = createProductImageGallery(item.imageUrl, item.name || 'Marketplace item', 'compact');
    const title = document.createElement('span');
    title.textContent = item.name || 'Marketplace item';
    itemCell.append(imageGallery, title);
    imageCell.appendChild(itemCell);
    const nameCell = document.createElement('td'); nameCell.textContent = item.name || 'Marketplace item';
    const walletCell = document.createElement('td'); walletCell.className = 'profile-wallet-cell'; walletCell.textContent = isSold ? (item.buyer || '') : (item.seller || '');
    walletCell.title = walletCell.textContent;
    const dateCell = document.createElement('td');
    dateCell.textContent = item.soldAt && !Number.isNaN(Date.parse(item.soldAt)) ? new Date(item.soldAt).toLocaleDateString() : '-';
    const priceCell = document.createElement('td'); priceCell.textContent = `${(Number(item.price) || 0).toFixed(4)} ETH`;
    const linkCell = document.createElement('td');
    if (/^0x[a-f0-9]{64}$/i.test(item.transactionHash || '')) {
      const link = document.createElement('a');
      link.href = `https://sepolia.etherscan.io/tx/${item.transactionHash}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View';
      linkCell.appendChild(link);
    } else linkCell.textContent = '-';
    const escrowCell = document.createElement('td');
    const escrowStatus = document.createElement('div');
    escrowStatus.className = 'escrow-status';
    escrowCell.appendChild(escrowStatus);
    renderEscrowStatus(String(item._id), escrowStatus, null, item);
    row.append(imageCell, nameCell, walletCell, dateCell, priceCell, linkCell, escrowCell);
    tbody.appendChild(row);
  });
}

function isEscrowView() {
  return accountDashboardView === 'escrow';
}

document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(button => {
  button.addEventListener('click', () => {
    accountDashboardView = button.dataset.profileTable;
    paintAccountActivityRows();
  });
});
