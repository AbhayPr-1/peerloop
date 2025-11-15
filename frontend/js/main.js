// frontend/js/main.js

document.addEventListener('DOMContentLoaded', async () => {
  
  // CRITICAL: Initialize the read-only provider first!
  await initializeReadOnlyProvider(); // <— ADDED LINE
    
  // FIX: Aggressive Socket.IO Configuration for better resilience
  const socket = io(API_URL, {
    reconnection: true,             // Enable reconnection attempts
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,         
    timeout: 20000,
    pingInterval: 10000,
  });
  
  // *** FINAL SOCKET CONNECTION HANDLERS ***
  socket.on('connect', () => {
      console.log('DEBUG: Socket: Connected to real-time server!');
      // showMessage("Real-time enabled.", 2000);
      if (document.getElementById('marketplace').classList.contains('hidden') === false) {
          fetchProducts(false); 
      }
  });

  socket.on('ping', () => { console.log('DEBUG: Socket Ping Received (Connection Alive)'); });

  socket.on('disconnect', (reason) => {
      console.error('DEBUG: Socket: Disconnected. Reason:', reason);
      showMessage("Real-time connection lost. Reconnecting...", 5000);
  });
  
  socket.on('reconnect', () => {
      console.log('DEBUG: Socket: Reconnected successfully.');
      showMessage("Real-time connection restored. Refreshing...", 3000);
      fetchProducts(true); 
  });
  
  socket.on('reconnect_error', (error) => {
      console.error('DEBUG: Socket: Reconnect error. Forcing fresh connection.', error);
      socket.close();
      setTimeout(() => socket.open(), 5000); 
  });
  
  socket.on('reconnect_failed', () => {
      console.error('DEBUG: Socket: Reconnection failed permanently.');
      showMessage("Real-time connection failed permanently. Please refresh the page.", 6000);
  });

  // CRITICAL FIX: Add sync delay for transaction events
  socket.on('product_updated', (data) => {
      console.log('DEBUG: Socket Event Received: product_updated', data);
      
      if (socket.connected) {
          showMessage(`Real-time update: A product was ${data.type}. Refreshing...`); 
          
          try {
              fetchProducts(true); 
          } catch (e) {
              console.error("Failed to execute fetchProducts during real-time update:", e);
          }
          
          if (data.type === 'sold' || data.type === 'deleted') {
            handleRealTimeCartRemoval(data.id, data.name);
          }
      } else {
          console.warn("DEBUG: Real-time event received but socket is disconnected. Ignoring event.");
      }
  });
  
  checkAuthState();

  if (currentUser && typeof window.ethereum !== 'undefined') {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      await connectContractToSigner(signer); 
    } catch (e) {
      console.error("Failed to auto-re-initialize contract:", e);
      showMessage("Please reconnect your wallet.");
      logout();
    }
  }

  renderUI();
  // *** FIX APPLIED: Removed redundant fetchProducts(false) call here. ***
  initializeModalListeners();
  showSection('hero'); // This initiates the initial UI state
  initializeCustomSelect('category-filter', filterAndSortProducts);
  initializeCustomSelect('product-category');
  initializeCustomSelect('sort-by', filterAndSortProducts);
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

// --- Sell Form & Image Uploader Event Listeners ---
const uploader = document.getElementById('image-uploader');
const fileInput = document.getElementById('product-photo');
uploader.addEventListener('click', () => fileInput.click());
uploader.addEventListener('dragover', e => { e.preventDefault(); uploader.classList.add('drag-over'); });
uploader.addEventListener('dragleave', () => uploader.classList.remove('drag-over'));
uploader.addEventListener('drop', e => {
    e.preventDefault();
    uploader.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFileChange(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', () => handleFileChange(fileInput.files[0]));
document.getElementById("create-listing-form").addEventListener("submit", createListingFormHandler);

async function renderProfileSection(type) {
  document.getElementById('profile-dropdown-menu').classList.add('hidden');
  if (!currentUser || !marketplaceContract) return;

  const gridIds = { listings: 'my-listings-grid', sold: 'sold-history-grid', purchased: 'purchase-history-grid' };
  const sectionIds = { listings: 'my-listings-tab', sold: 'sold-history-tab', purchased: 'purchase-history-tab' };
  const grid = document.getElementById(gridIds[type]);
  showSection(sectionIds[type]);

  let skeletonHTML = '';
  for (let i = 0; i < 3; i++) skeletonHTML += `<div class="skeleton-card"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
  grid.innerHTML = skeletonHTML;

  try {
    const myAddress = currentUser.walletAddress.toLowerCase();

    // FIX: Only render Listings, other tabs remain placeholder.
    if (type !== 'listings') {
        grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">Purchase and Sold History require a more complex smart contract to track past transactions.</p>`;
        return;
    }

    // CRITICAL FIX: Ensure ALL PRODUCTS is fresh before filtering for the profile view
    await fetchProducts(false); 
    
    const myProducts = allProducts 
      .filter(p => p.seller.toLowerCase() === myAddress)
      .map(p => ({
            _id: p._id, name: p.name, description: p.description,
            price: p.price,
            seller: p.seller, imageUrl: p.imageUrl, category: p.category, isSold: p.isSold
        }));

    grid.innerHTML = '';
    if (myProducts.length === 0) {
      grid.innerHTML = `<div class="text-center p-8 border-2 border-dashed rounded-md col-span-full">
              <h3 class="text-2xl font-bold text-gray-400">You have no active listings.</h3>
              <p class="text-gray-500 mt-2 mb-6">Ready to give your old gear a new life?</p>
              <button id="listings-sell-btn" class="modern-button">Sell Your First Gear</button>
          </div>`;
      document.getElementById('listings-sell-btn').addEventListener('click', () => showSection('sell-tab'));
      return;
    }
    myProducts.forEach(product => grid.appendChild(createProfileProductCard(product, type)));
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}</p>`;
  }
}

function handleFileChange(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showMessage("Invalid file type."); fileInput.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { showMessage("Image too large (Max 5MB)."); fileInput.value = ""; return; }
    document.getElementById('file-name-display').textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
        const preview = document.getElementById('image-preview');
        preview.src = ev.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
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
  const file = document.getElementById("product-photo").files[0];

  if (!name || !description || !priceString || !file) {
    setButtonLoading(buttonElement, false);
    return showMessage("Please fill all fields and upload an image.");
  }
  const priceNumber = parseFloat(priceString);
  if (isNaN(priceNumber) || priceNumber <= 0) {
      setButtonLoading(buttonElement, false);
      return showMessage("Price must be a number greater than 0.");
  }

  try {
    setButtonLoading(buttonElement, true, 'Uploading Image...');
    const formData = new FormData();
    formData.append('productImage', file);
    const uploadResponse = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { 'x-auth-token': localStorage.getItem('token') },
      body: formData
    });
    if (!uploadResponse.ok) {
      const err = await uploadResponse.json();
      throw new Error(err.msg || 'Image upload failed.');
    }
    const uploadData = await uploadResponse.json();
    const imageUrl = uploadData.imageUrl; 

    setButtonLoading(buttonElement, true, 'Listing on Blockchain...');
    const priceInWei = ethers.utils.parseEther(priceString);
    showMessage("Sending transaction... Please check your wallet.");
    const tx = await marketplaceContract.listProduct(name, description, priceInWei, imageUrl);
    await tx.wait(); 

    showMessage("Product listed successfully!");
    
    // *** FIX: GUARANTEED LOCAL REFRESH ***
    fetchProducts(true); // Pass true to wait for RPC sync
    // *** END FIX ***
    
    document.getElementById("create-listing-form").reset();
    document.getElementById("image-preview").classList.add("hidden");
    document.getElementById('file-name-display').textContent = '';
    const categoryContainer = document.getElementById('product-category');
    categoryContainer.querySelector('span').textContent = 'Electronics';
    categoryContainer.querySelector('input[type="hidden"]').value = 'electronics';

    setButtonLoading(buttonElement, false); 
    showSection('marketplace');
    
  } catch(error) { 
    console.error(error);
    if (error.code === 'USER_REJECTED_TRANSACTION') {
      showMessage("Transaction was cancelled.");
    } else {
      showMessage(error.message || "Transaction failed.");
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
  
  let skeletonHTML = '';
  for (let i = 0; i < 3; i++) skeletonHTML += `<div class="skeleton-card"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
  grid.innerHTML = skeletonHTML;
  
  try {
    // FIX: Use up-to-date products fetched from the blockchain
    await fetchProducts(false); 
    
    const sellerProducts = allProducts.filter(p => p.seller.toLowerCase() === sellerId.toLowerCase());
    grid.innerHTML = '';
    if (sellerProducts.length === 0) {
      grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">This seller has no active listings.</p>`;
      return;
    }
    sellerProducts.forEach(product => grid.appendChild(createProductCard(product)));
  } catch (error) {
    grid.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}</p>`;
  }
}