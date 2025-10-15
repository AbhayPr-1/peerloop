// frontend/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  // --- REAL-TIME CONNECTION ---
  const socket = io(API_URL);

  socket.on('connect', () => console.log('Connected to real-time server!'));
  socket.on('product_added', handleProductAdded);
  socket.on('product_sold', handleProductSold);
  socket.on('product_deleted', handleProductDeleted);

  // --- INITIALIZATION ---
  checkAuthState();
  renderUI();
  fetchProducts();
  initializeModalListeners();
  
  showSection('hero');
  initializeCustomSelect('category-filter', filterAndSortProducts);
  initializeCustomSelect('product-category');
  initializeCustomSelect('sort-by', filterAndSortProducts);
});

// --- SOCKET HANDLERS ---
function handleProductAdded(newProduct) {
  allProducts.unshift(newProduct);
  filterAndSortProducts();
  showMessage(`New gear listed: ${newProduct.name}`);
}
function handleProductSold({ productId }) {
  const soldProduct = allProducts.find(p => p._id === productId);
  allProducts = allProducts.filter(p => p._id !== productId);
  filterAndSortProducts();
  showMessage(soldProduct ? `'${soldProduct.name}' was just sold!` : 'An item was just sold!');
  handleRealTimeCartRemoval(productId, soldProduct?.name);
}
function handleProductDeleted({ productId }) {
    const deletedProduct = allProducts.find(p => p._id === productId);
    allProducts = allProducts.filter(p => p._id !== productId);
    filterAndSortProducts();
    showMessage(deletedProduct ? `'${deletedProduct.name}' was removed by the seller.` : 'A listing was removed.');
    handleRealTimeCartRemoval(productId, deletedProduct?.name);
}

function initializeModalListeners() {
    const confirmBtn = document.getElementById('confirm-action-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    confirmBtn.addEventListener('click', async () => {
        if (typeof currentConfirmAction !== 'function') {
            return closeConfirmationModal();
        }
        setButtonLoading(confirmBtn, true, 'Confirming...');
        try {
            await currentConfirmAction();
        } catch (error) {
            console.error("Confirmation action failed:", error);
        } finally {
            setButtonLoading(confirmBtn, false);
            closeConfirmationModal();
        }
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
  if (!currentUser) return;
  const endpoints = {
    listings: '/api/users/me/listings', sold: '/api/users/me/sold', purchased: '/api/users/me/purchased'
  };
  const gridIds = {
    listings: 'my-listings-grid', sold: 'sold-history-grid', purchased: 'purchase-history-grid'
  };
  const sectionIds = {
    listings: 'my-listings-tab', sold: 'sold-history-tab', purchased: 'purchase-history-tab'
  };
  const grid = document.getElementById(gridIds[type]);
  showSection(sectionIds[type]);

  let skeletonHTML = '';
  for (let i = 0; i < 3; i++) {
      skeletonHTML += `<div class="skeleton-card"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
  }
  grid.innerHTML = skeletonHTML;

  try {
    const response = await fetch(`${API_URL}${endpoints[type]}`, {
      headers: { 'x-auth-token': localStorage.getItem('token') }
    });
    if (!response.ok) throw new Error('Could not fetch data.');
    const products = await response.json();
    
    grid.innerHTML = '';
    if (products.length === 0) {
      if (type === 'listings') {
        grid.innerHTML = `
          <div class="text-center p-8 border-2 border-dashed rounded-md col-span-full">
              <h3 class="text-2xl font-bold text-gray-400">You have no active listings.</h3>
              <p class="text-gray-500 mt-2 mb-6">Ready to give your old gear a new life?</p>
              <button id="listings-sell-btn" class="modern-button">Sell Your First Gear</button>
          </div>
        `;
        document.getElementById('listings-sell-btn').addEventListener('click', () => showSection('sell-tab'));
      } else {
        grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No products found in this section.</p>`;
      }
      return;
    }

    products.forEach(product => grid.appendChild(createProfileProductCard(product, type)));
    
  } catch (error) {
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

  const buttonElement = e.submitter;
  setButtonLoading(buttonElement, true, 'Creating...');
  
  const token = localStorage.getItem('token');
  const name = document.getElementById("product-name").value.trim();
  const description = document.getElementById("product-desc").value.trim();
  const price = parseFloat(document.getElementById("product-price").value);
  const category = document.querySelector("#product-category input[type='hidden']").value;
  const file = document.getElementById("product-photo").files[0];

  if (!name || !description || !price || !category || !file) {
    setButtonLoading(buttonElement, false);
    return showMessage("Please fill all fields and upload an image.");
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ name, description, price, category, imageUrl: reader.result })
      });
      const newProduct = await response.json();
      if (!response.ok) {
        const errorMsg = newProduct.errors ? newProduct.errors[0].msg : (newProduct.msg || 'Failed to create listing');
        throw new Error(errorMsg);
      }
      
      showMessage("Product listed successfully!");
      document.getElementById("create-listing-form").reset();
      document.getElementById("image-preview").classList.add("hidden");
      document.getElementById('file-name-display').textContent = '';
      showSection('marketplace');
    } catch(error) { 
      showMessage(error.message); 
    } finally {
      setButtonLoading(buttonElement, false);
    }
  };
  reader.onerror = () => {
      setButtonLoading(buttonElement, false);
      showMessage("Could not read the image file.");
  };
}

async function renderSellerProfile(sellerId, sellerName) {
  const heading = document.getElementById('seller-profile-heading');
  const grid = document.getElementById('seller-profile-grid');
  heading.textContent = `${sellerName}'s Gears`;
  showSection('seller-profile-tab');
  
  let skeletonHTML = '';
  for (let i = 0; i < 3; i++) {
    skeletonHTML += `<div class="skeleton-card"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
  }
  grid.innerHTML = skeletonHTML;
  
  try {
    const response = await fetch(`${API_URL}/api/users/${sellerId}/products`);
    if (!response.ok) throw new Error('Could not fetch seller profile.');
    
    const data = await response.json();
    grid.innerHTML = '';
    
    if (data.products.length === 0) {
      grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">This seller has no active listings.</p>`;
      return;
    }
    
    data.products.forEach(product => grid.appendChild(createProductCard(product)));
    
  } catch (error) {
    grid.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}</p>`;
  }
}