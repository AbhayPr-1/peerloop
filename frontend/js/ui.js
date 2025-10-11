// frontend/js/ui.js
function showSection(sectionId) {
  // Add the new profile sections to the array
  const sections = ["hero", "services", "marketplace", "sell-tab", "cart-tab", "my-listings-tab", "sold-history-tab", "purchase-history-tab"];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", id !== sectionId);
    if (id === 'hero' && sectionId !== 'hero') {
      document.getElementById('services').classList.add('hidden');
    }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderUI() {
  const exploreBtn = document.getElementById("nav-explore-btn");
  const sellBtn = document.getElementById("nav-sell-btn");
  const cartBtn = document.getElementById("nav-cart-btn");
  const authBtn = document.getElementById("auth-btn");
  const profileDropdown = document.getElementById("profile-dropdown-container");
  const loggedIn = !!currentUser;

  exploreBtn.classList.remove("hidden");
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