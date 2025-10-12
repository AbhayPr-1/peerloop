// frontend/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
  renderUI();
  fetchProducts();

  initializeCustomSelect('category-filter', filterAndSortProducts);
  initializeCustomSelect('product-category');
  initializeCustomSelect('sort-by', filterAndSortProducts);
});

// --- Nav & Page Event Listeners ---
document.getElementById('nav-home-btn').addEventListener('click', () => {
  const allSections = ["marketplace", "sell-tab", "cart-tab", "my-listings-tab", "sold-history-tab", "purchase-history-tab", "seller-profile-tab"];
  allSections.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('hero').classList.remove('hidden');
  document.getElementById('services').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// MODIFIED: This now re-renders the products every time you click "Explore Gears"
document.getElementById('nav-explore-btn').addEventListener('click', () => {
  showSection('marketplace');
  filterAndSortProducts(); // This forces a redraw with the latest data
});

document.getElementById('nav-sell-btn').addEventListener('click', () => currentUser ? showSection('sell-tab') : showMessage('Login to sell'));
document.getElementById('nav-cart-btn').addEventListener('click', () => currentUser ? (showSection('cart-tab'), renderCart()) : showMessage('Login to view cart'));
document.getElementById('checkout-btn').addEventListener('click', checkout);

// --- Auth Modal & Form Event Listeners ---
document.getElementById('close-modal-btn').addEventListener('click', closeAuthModal);
document.getElementById('toggle-form-btn').addEventListener('click', toggleAuthForm);
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  handleLogin(document.getElementById('login-identifier').value, document.getElementById('login-password').value);
});
document.getElementById('signup-form').addEventListener('submit', e => {
  e.preventDefault();
  handleSignup(document.getElementById('signup-name').value, document.getElementById('signup-email').value, document.getElementById('signup-password').value);
});
document.getElementById("metamask-login-btn").addEventListener("click", handleMetaMaskLogin);

// --- Profile Dropdown Event Listeners ---
document.getElementById('profile-dropdown-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('profile-dropdown-menu');
    document.querySelectorAll('.custom-select-btn + .dropdown-menu').forEach(otherMenu => {
        otherMenu.classList.add('hidden');
    });
    menu.classList.toggle('hidden');
});
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('nav-listings-btn').addEventListener('click', () => renderProfileSection('listings'));
document.getElementById('nav-sold-btn').addEventListener('click', () => renderProfileSection('sold'));
document.getElementById('nav-purchased-btn').addEventListener('click', () => renderProfileSection('purchased'));

// --- Marketplace Filter Event Listeners ---
document.getElementById('search-input').addEventListener('input', filterAndSortProducts);

// --- Sell Form Event Listeners ---
document.getElementById('product-photo').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith("image/")) { showMessage("Invalid file type."); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { showMessage("Image too large (Max 5MB)."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('image-preview');
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("create-listing-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return showMessage("You must be logged in.");
  
  const token = localStorage.getItem('token');
  const name = document.getElementById("product-name").value.trim();
  const description = document.getElementById("product-desc").value.trim();
  const price = parseFloat(document.getElementById("product-price").value);
  const category = document.querySelector("#product-category input[type='hidden']").value;
  const file = document.getElementById("product-photo").files[0];

  if (!name || !description || !price || !category || !file) {
    return showMessage("Please fill all fields and upload an image.");
  }

  showLoadingMessage("Creating listing...");

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    const imageUrl = reader.result;
    try {
      const response = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ name, description, price, category, imageUrl })
      });
      
      const newProduct = await response.json();
      if (!response.ok) {
        const errorMsg = newProduct.errors ? newProduct.errors[0].msg : (newProduct.msg || 'Failed to create listing');
        throw new Error(errorMsg);
      }
      
      hideLoadingMessage();
      showMessage("Product listed successfully!");
      document.getElementById("create-listing-form").reset();
      document.getElementById("image-preview").classList.add("hidden");
      document.querySelector("#product-category .custom-select-btn span").textContent = 'Electronics';

      newProduct.seller = { _id: currentUser.id, name: currentUser.name };
      
      allProducts.unshift(newProduct);
      filterAndSortProducts();
      showSection('marketplace');
    } catch(error) { 
      hideLoadingMessage();
      showMessage(error.message); 
    }
  };
  reader.onerror = () => {
      hideLoadingMessage();
      showMessage("Could not read the image file.");
  };
});

// --- PROFILE RENDERING FUNCTION ---
async function renderProfileSection(type) {
  document.getElementById('profile-dropdown-menu').classList.add('hidden');
  if (!currentUser) return;

  const endpoints = {
    listings: '/api/users/me/listings',
    sold: '/api/users/me/sold',
    purchased: '/api/users/me/purchased'
  };

  const gridIds = {
    listings: 'my-listings-grid',
    sold: 'sold-history-grid',
    purchased: 'purchase-history-grid'
  };

  const sectionIds = {
    listings: 'my-listings-tab',
    sold: 'sold-history-tab',
    purchased: 'purchase-history-tab'
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
      grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No products found in this section.</p>`;
      return;
    }

    products.forEach(product => {
      grid.appendChild(createProfileProductCard(product, type));
    });

  } catch (error) {
    grid.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}</p>`;
  }
}

// --- FILTER AND SORT FUNCTION ---
function filterAndSortProducts() {
  const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  const cat = document.querySelector("#category-filter input[type='hidden']")?.value || "all";
  const sortBy = document.querySelector("#sort-by input[type='hidden']")?.value || "date-desc";
  let list = [...allProducts];
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (cat !== "all") list = list.filter(p => p.category === cat);
  switch (sortBy) {
    case "price-asc": list.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case "price-desc": list.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "name-desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
    default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
  }
  renderProducts(list);
}

// --- SELLER PROFILE RENDERING FUNCTION ---
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
    const products = data.products;

    grid.innerHTML = '';
    if (products.length === 0) {
      grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">This seller has no active listings.</p>`;
      return;
    }

    products.forEach(product => {
      grid.appendChild(createProductCard(product));
    });
    
    attachCardListeners(grid);
    
  } catch (error) {
    grid.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}</p>`;
  }
}