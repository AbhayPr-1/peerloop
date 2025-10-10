// frontend/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
  renderUI();
  fetchProducts();
});

document.getElementById('nav-home-btn').addEventListener('click', () => {
  document.getElementById('services').classList.remove('hidden');
  showSection('hero');
  document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('nav-explore-btn').addEventListener('click', () => showSection('marketplace'));
document.getElementById('nav-sell-btn').addEventListener('click', () => currentUser ? showSection('sell-tab') : showMessage('Login to sell'));
document.getElementById('nav-cart-btn').addEventListener('click', () => currentUser ? (showSection('cart-tab'), renderCart()) : showMessage('Login to view cart'));
document.getElementById('checkout-btn').addEventListener('click', checkout);

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

document.getElementById('search-input').addEventListener('input', filterAndSortProducts);
document.getElementById('category-filter').addEventListener('change', filterAndSortProducts);
document.getElementById('sort-by').addEventListener('change', filterAndSortProducts);

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
  const category = document.getElementById("product-category").value;
  const file = document.getElementById("product-photo").files[0];
  if (!name || !description || !price || !category || !file) return showMessage("Please fill all fields and upload an image.");

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
      if (!response.ok) throw new Error(newProduct.msg || 'Failed to create listing');
      showMessage("Product listed successfully!");
      document.getElementById("create-listing-form").reset();
      document.getElementById("image-preview").classList.add("hidden");
      allProducts.unshift(newProduct);
      filterAndSortProducts();
      showSection('marketplace');
    } catch(error) { showMessage(error.message); }
  };
  reader.onerror = () => showMessage("Could not read the image file.");
});