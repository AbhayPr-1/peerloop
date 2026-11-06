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
  showSection('hero');
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
document.getElementById('services-back-btn').addEventListener('click', () => showSection('hero'));
document.getElementById('nav-sell-btn').addEventListener('click', () => currentUser ? showSection('sell-tab') : showAuthModal());
document.getElementById('hero-sell-btn').addEventListener('click', () => currentUser ? showSection('sell-tab') : showAuthModal());
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
document.getElementById('nav-listings-btn').addEventListener('click', () => renderProfileSection('listings'));
document.getElementById('nav-sold-btn').addEventListener('click', () => renderProfileSection('sold'));
document.getElementById('nav-purchased-btn').addEventListener('click', () => renderProfileSection('purchased'));

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
uploader.addEventListener('click', e => { if (!e.target.closest('label')) fileInput.click(); });
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

async function renderProfileSection(type, retryCount = 0) {
  document.getElementById('profile-dropdown-menu').classList.add('hidden');
  if (!currentUser) return;

  const gridIds = { listings: 'my-listings-grid', sold: 'sold-history-grid', purchased: 'purchase-history-grid' };
  const sectionIds = { listings: 'my-listings-tab', sold: 'sold-history-tab', purchased: 'purchase-history-tab' };
  const grid = document.getElementById(gridIds[type]);
  showSection(sectionIds[type]);

  const loadingMessage = document.createElement('p');
  loadingMessage.className = 'text-center text-gray-500 col-span-full';
  loadingMessage.textContent = type === 'listings' ? 'Loading listings...' : 'Loading transaction history...';
  grid.replaceChildren(loadingMessage);

  try {
    if (type === 'listings' && !readOnlyContract) {
      throw new Error('The marketplace contract is not connected.');
    }
    const myAddress = currentUser.walletAddress.toLowerCase();

    if (type !== 'listings') {
      const history = await getWalletTransactionHistory(myAddress);
      const records = type === 'sold' ? history.sold : history.purchased;
      grid.innerHTML = '';
      if (records.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'text-center text-gray-500 col-span-full';
        emptyState.textContent = 'No items.';
        grid.appendChild(emptyState);
        return;
      }
      records.forEach((product) => grid.appendChild(createProfileProductCard(product, type)));
      return;
    }

    const activeProducts = await loadProductsFromChain();
    allProducts = activeProducts;
    const myProducts = activeProducts
      .filter(p => p.seller.toLowerCase() === myAddress)
      .map(p => ({
            _id: p._id, name: p.name, description: p.description,
            price: p.price,
            seller: p.seller, imageUrl: p.imageUrl, category: p.category, isSold: p.isSold
        }));

    grid.innerHTML = '';
    if (myProducts.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'text-center text-gray-500 col-span-full';
      emptyState.textContent = 'No items.';
      grid.replaceChildren(emptyState);
      return;
    }
    myProducts.forEach(product => grid.appendChild(createProfileProductCard(product, type)));
  } catch (error) {
    console.error(error);
    if (retryCount < 2) {
      loadingMessage.textContent = 'Connection is slow. Retrying...';
      setTimeout(() => {
        if (currentUser
          && !document.getElementById(sectionIds[type]).classList.contains('hidden')) {
          renderProfileSection(type, retryCount + 1);
        }
      }, 1000 * (retryCount + 1));
      return;
    }
    const errorMessage = document.createElement('p');
    errorMessage.className = 'text-center text-red-500 col-span-full';
    errorMessage.textContent = `Could not load items after retrying: ${error.message}`;
    grid.replaceChildren(errorMessage);
  }
}

function handleFileChange(files) {
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
  const category = document.querySelector("#product-category input[type='hidden']").value;
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
    categoryContainer.querySelector('input[type="hidden"]').value = 'electronics';

    await renderProfileSection('listings');
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
// Shared visual account navigation; delegates to the existing profile renderer.
document.querySelectorAll('[data-profile-view]').forEach((button) => {
  button.addEventListener('click', () => renderProfileSection(button.dataset.profileView));
});

document.getElementById('nav-profile-btn').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('profile-dropdown-menu').classList.add('hidden');
  if (!currentUser) return showAuthModal();
  showSection('user-profile-tab');
});

let accountDashboardHistory = null;
let accountDashboardView = 'purchased';

async function renderUserProfileDashboard() {
  if (!currentUser) return showAuthModal();
  const name = currentUser.name || 'PeerLoop member';
  const wallet = currentUser.walletAddress || '';
  const avatarText = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
  document.getElementById('profile-display-name').textContent = name;
  document.getElementById('profile-avatar').textContent = avatarText;
  document.getElementById('profile-wallet-address').textContent = wallet;
  document.getElementById('profile-activity-rows').innerHTML = '<tr><td colspan="6" class="profile-empty">Loading on-chain activity.</td></tr>';
  accountDashboardHistory = null;
  accountDashboardView = 'purchased';
  document.querySelectorAll('[data-profile-table]').forEach(button => button.classList.toggle('active', button.dataset.profileTable === accountDashboardView));
  const [historyResult, listingResult] = await Promise.allSettled([
    getWalletTransactionHistory(wallet),
    loadProductsFromChain()
  ]);
  const historyOk = historyResult.status === 'fulfilled';
  const listingOk = listingResult.status === 'fulfilled';
  const history = historyOk ? historyResult.value : { purchased: [], sold: [] };
  accountDashboardHistory = history;
  const address = wallet.toLowerCase();
  const listings = listingOk ? listingResult.value.filter(item => item.seller.toLowerCase() === address && !item.isSold) : [];
  const ownedItems = historyOk ? history.purchased.filter(item => !history.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber))) : [];
  const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
  document.getElementById('profile-owned-value').textContent = historyOk ? `${ownedValue.toFixed(4)} ETH` : 'Unavailable';
  document.getElementById('profile-listing-count').textContent = listingOk ? String(listings.length) : 'Unavailable';
  document.getElementById('profile-sold-count').textContent = historyOk ? String(history.sold.length) : 'Unavailable';
  paintAccountActivityRows();
  if (!historyOk || !listingOk) {
    const issues = [];
    if (!historyOk) issues.push('transaction history');
    if (!listingOk) issues.push('active listings');
    showMessage(`Some profile data could not be loaded (${issues.join(' and ')}).`, 4500);
  }
}

function paintAccountActivityRows() {
  const tbody = document.getElementById('profile-activity-rows');
  if (!tbody) return;
  if (!accountDashboardHistory) {
    tbody.innerHTML = '<tr><td colspan="6" class="profile-empty">Profile activity is not available yet.</td></tr>';
    return;
  }
  const isSold = accountDashboardView === 'sold';
  const data = isSold
    ? accountDashboardHistory.sold
    : accountDashboardHistory.purchased.filter(item => !accountDashboardHistory.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
  tbody.replaceChildren();
  if (!data.length) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="6" class="profile-empty">${isSold ? 'No completed sales found for this wallet.' : 'No purchased items found for this wallet.'}</td>`;
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
    row.append(imageCell, nameCell, walletCell, dateCell, priceCell, linkCell);
    tbody.appendChild(row);
  });
}

document.querySelectorAll('[data-profile-table]').forEach(button => {
  button.addEventListener('click', () => {
    accountDashboardView = button.dataset.profileTable;
    document.querySelectorAll('[data-profile-table]').forEach(tab => tab.classList.toggle('active', tab === button));
    paintAccountActivityRows();
  });
});
