// frontend/js/ui.js
let currentConfirmAction = null;

function showSection(sectionId) {
  const sections = ["hero", "marketplace", "sell-tab", "cart-tab", "seller-profile-tab", "user-profile-tab"];
  const navHomeBtn = document.getElementById('nav-home-btn');
  const navAboutBtn = document.getElementById('nav-about-btn');
  const navExploreBtn = document.getElementById('nav-explore-btn');
  const navSellBtn = document.getElementById('nav-sell-btn');
  const navEscrowBtn = document.getElementById('nav-escrow-btn');

  const routeBySection = { hero: '/', marketplace: '/marketplace', 'sell-tab': '/sell' };
  const nextPath = routeBySection[sectionId];
  if (nextPath && window.location.pathname !== nextPath) {
    window.history.pushState({ sectionId }, '', nextPath);
  }

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = id === sectionId;
    el.classList.toggle("hidden", !isActive);
    if (id !== 'hero') {
      el.classList.toggle('hidden-section', !isActive);
      el.classList.toggle('visible-section', isActive);
    }
  });

  const landingPage = document.querySelector('.peerloop-home');
  if (landingPage) landingPage.classList.toggle('hidden', sectionId !== 'hero');

  const servicesSection = document.getElementById('services');
  const showServices = sectionId === 'hero';
  servicesSection.classList.toggle('hidden', !showServices);
  servicesSection.classList.toggle('hidden-section', !showServices);
  servicesSection.classList.toggle('visible-section', showServices);
  if (sectionId === 'hero') {
    navHomeBtn.classList.add('hidden');
    navAboutBtn.classList.remove('hidden');
    navExploreBtn.classList.remove('hidden');
    navSellBtn.classList.remove('hidden');
  } else {
    navHomeBtn.classList.remove('hidden');
    navAboutBtn.classList.add('hidden');
    navExploreBtn.classList.remove('hidden');
    navSellBtn.classList.toggle('hidden', !currentUser);
  }
  navEscrowBtn.classList.toggle('hidden', !currentUser);
  
  // FIX: Explicitly fetch products only when navigating to the marketplace, no delay on manual navigation
  if (sectionId === 'marketplace') {
      fetchProducts(false);
  }
  if (sectionId === 'user-profile-tab' && window.PeerLoopAccount) {
    window.PeerLoopAccount.renderDashboard();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.addEventListener('popstate', () => {
  const sectionByRoute = { '/': 'hero', '/index.html': 'hero', '/marketplace': 'marketplace', '/sell': 'sell-tab' };
  const sectionId = sectionByRoute[window.location.pathname];
  if (sectionId) showSection(sectionId);
});

function renderUI() {
  const cartBtn = document.getElementById("nav-cart-btn");
  const authBtn = document.getElementById("auth-btn");
  const profileDropdown = document.getElementById("profile-dropdown-container");
  const loggedIn = !!currentUser;
  const onLandingPage = window.location.pathname === '/' || window.location.pathname === '/index.html';

  cartBtn.classList.toggle("hidden", !loggedIn); 
  document.getElementById('nav-escrow-btn').classList.toggle('hidden', !loggedIn);
  document.getElementById('nav-sell-btn').classList.toggle('hidden', !loggedIn && !onLandingPage);

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
  
  fetchCart(); 
}

function showConfirmationModal(message, onConfirmCallback) {
  const modal = document.getElementById('confirmation-modal');
  const content = modal.querySelector('.modal-content');
  const messageEl = document.getElementById('confirmation-message');
  messageEl.innerHTML = message;
  currentConfirmAction = onConfirmCallback; 
  modal.classList.remove('hidden');
  setTimeout(() => content.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmation-modal');
  const content = modal.querySelector('.modal-content');
  content.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
    currentConfirmAction = null; 
  }, 300);
}

function showQuickView(product) {
    const modal = document.getElementById('quick-view-modal');
    const content = document.getElementById('quick-view-content');

    const sellerAddress = product.seller;
    const sellerDisplay = (product.seller && product.seller.name) ? product.seller.name : formatAddress(sellerAddress);
    
    const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';

    let actionButtons = "";
    if (!currentUser || (currentUser && currentUser.walletAddress.toLowerCase() !== product.seller.toLowerCase())) {
        actionButtons = `
          <button class="modern-button-secondary add-to-cart-btn">Add to Cart</button>
          <button class="modern-button buy-now-btn">Buy with Escrow</button>
        `;
    }

    content.innerHTML = `
        <button id="close-quick-view-btn" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div class="quick-view-gallery-slot"></div>
            <div class="flex flex-col h-full">
                <h3 class="text-4xl font-bold text-neon-blue mb-4">${escapeHtml(product.name)}</h3>
                <p class="text-gray-400 mb-4 flex-grow">${escapeHtml(product.description)}</p>
                <div class="text-sm mb-4" style="overflow-wrap: break-word;">
                  Seller: <a href="#" class="seller-link">${escapeHtml(sellerDisplay)}</a>
                </div>
                <div class="product-card-meta mb-6">
                    <span class="product-card-price text-3xl text-neon-pink font-bold">${window.PeerLoopMoney.formatEth(product.price)} ETH</span>
                    <span class="product-card-category text-sm px-3 py-1 rounded bg-gray-700">${escapeHtml(displayCategory)}</span>
                </div>
                <div class="product-card-actions grid grid-cols-2 gap-3">${actionButtons}</div>
            </div>
        </div>
    `;
    content.querySelector('.quick-view-gallery-slot').appendChild(createProductImageGallery(product.imageUrl, product.name, 'detail'));

    document.getElementById('close-quick-view-btn').addEventListener('click', closeQuickView);
    
    const buyNowBtn = content.querySelector(".buy-now-btn");
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', (e) => {
            if (!currentUser) return showAuthModal();
            const message = `Buy <strong>${escapeHtml(product.name)}</strong> for <strong>${window.PeerLoopMoney.formatEth(product.price)} ETH</strong>? Payment will be held in escrow until you release it or request a refund.`;
            showConfirmationModal(message, () => buyNow(product, e.currentTarget));
        });
    }

    const addToCartBtn = content.querySelector(".add-to-cart-btn");
    if(addToCartBtn) {
        addToCartBtn.addEventListener('click', (e) => {
            if (!currentUser) return showAuthModal();
            addToCart(product, e.currentTarget);
        });
    }

    const sellerLink = content.querySelector(".seller-link");
    if (sellerLink) {
        sellerLink.addEventListener('click', (e) => {
            e.preventDefault();
            renderSellerProfile(product.seller, sellerDisplay);
        });
    }

    modal.classList.remove('hidden');
    setTimeout(() => content.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeQuickView() {
    const modal = document.getElementById('quick-view-modal');
    const content = modal.querySelector('.modal-content');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}
