// frontend/js/ui.js
function showSection(sectionId) {
  const sections = ["hero", "services", "marketplace", "sell-tab", "cart-tab", "my-listings-tab", "sold-history-tab", "purchase-history-tab", "seller-profile-tab"];
  const navHomeBtn = document.getElementById('nav-home-btn');
  const navAboutBtn = document.getElementById('nav-about-btn'); // Get the new button
  const navExploreBtn = document.getElementById('nav-explore-btn');
  const navSellBtn = document.getElementById('nav-sell-btn');

  // Hide or show all main sections
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle("hidden", id !== sectionId);
    }
  });

  // Handle visibility of nav buttons based on the current section
  const servicesSection = document.getElementById('services');
  if (sectionId === 'hero') {
    servicesSection.classList.remove('hidden');
    navHomeBtn.classList.add('hidden');
    navAboutBtn.classList.remove('hidden'); // Show "About Us" on homepage
    navExploreBtn.classList.add('hidden');
    navSellBtn.classList.add('hidden');
  } else {
    servicesSection.classList.add('hidden');
    navHomeBtn.classList.remove('hidden');
    navAboutBtn.classList.add('hidden'); // Hide "About Us" on other pages
    navExploreBtn.classList.remove('hidden');
    if (currentUser) {
      navSellBtn.classList.remove('hidden');
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ... rest of the file remains the same ...
function renderUI() {
  const sellBtn = document.getElementById("nav-sell-btn");
  const cartBtn = document.getElementById("nav-cart-btn");
  const authBtn = document.getElementById("auth-btn");
  const profileDropdown = document.getElementById("profile-dropdown-container");
  const loggedIn = !!currentUser;

  sellBtn.classList.toggle("hidden", !loggedIn);
  cartBtn.classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    authBtn.classList.add('hidden');
    profileDropdown.classList.remove('hidden');
    document.getElementById('profile-username').textContent = currentUser.name;
  } else {
    authBtn.classList.remove('hidden');
    authBtn.textContent = "Login";
    authBtn.onclick = showAuthModal;
    profileDropdown.classList.add('hidden');
  }
  updateCartCount();
}

function showQuickView(product) {
    const modal = document.getElementById('quick-view-modal');
    const content = document.getElementById('quick-view-content');
    const sellerId = (typeof product.seller === 'object' && product.seller !== null) ? product.seller._id : product.seller;
    
    let actionButtons = "";
    if (!currentUser || (currentUser && currentUser.id !== sellerId)) {
        actionButtons = `
          <button class="modern-button-secondary add-to-cart-btn" data-id="${product._id}">Add to Cart</button>
          <button class="modern-button buy-now-btn" data-id="${product._id}">Buy Now</button>
        `;
    }

    content.innerHTML = `
        <button id="close-quick-view-btn" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-auto object-cover rounded-xl">
            <div class="flex flex-col h-full">
                <h3 class="text-4xl font-bold text-neon-blue mb-4">${product.name}</h3>
                <p class="text-gray-400 mb-4 flex-grow">${product.description}</p>
                <div class="text-sm mb-4">
                  Seller: <a href="#" class="seller-link text-neon-blue hover:underline" data-seller-id="${sellerId}" data-seller-name="${product.seller.name}">${product.seller.name}</a>
                </div>
                <div class="flex items-center justify-between mb-6">
                    <span class="text-3xl text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
                    <span class="text-sm px-3 py-1 rounded bg-gray-700">${categoryDisplayMap[product.category]}</span>
                </div>
                <div class="grid grid-cols-2 gap-3">${actionButtons}</div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
    }, 10);

    document.getElementById('close-quick-view-btn').addEventListener('click', closeQuickView);
    const addToCartBtn = content.querySelector('.add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', (e) => addToCart(e.target.dataset.id, e.target));
    }
    const buyNowBtn = content.querySelector('.buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', (e) => buyNow(e.target.dataset.id, e.target));
    }
     const sellerLink = content.querySelector('.seller-link');
    if (sellerLink) {
        sellerLink.addEventListener('click', e => {
            e.preventDefault();
            closeQuickView();
            renderSellerProfile(e.target.dataset.sellerId, e.target.dataset.sellerName);
        });
    }
}

function closeQuickView() {
    const modal = document.getElementById('quick-view-modal');
    const content = document.getElementById('quick-view-content');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}