// frontend/js/cart.js
let userCart = [];

async function fetchCart() {
  if (!currentUser) return;
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_URL}/api/users/cart`, {
      headers: { 'x-auth-token': token }
    });
    if (!response.ok) throw new Error('Could not fetch cart');
    userCart = await response.json();
    updateCartCount();
    if (!document.getElementById('cart-tab').classList.contains('hidden')) {
      renderCart();
    }
  } catch (error) {
    console.error("Fetch Cart Error:", error);
  }
}

async function addToCart(productId, buttonElement) {
  if (!currentUser) return showMessage("You must be logged in.");
  const token = localStorage.getItem('token');

  const originalButtonText = buttonElement.innerHTML;
  buttonElement.disabled = true;

  try {
    const response = await fetch(`${API_URL}/api/users/cart/${productId}`, {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Failed to add item');

    userCart = data;
    updateCartCount();

    buttonElement.innerHTML = 'Added ✓';
    buttonElement.classList.add('added-to-cart');
    setTimeout(() => {
        buttonElement.innerHTML = originalButtonText;
        buttonElement.classList.remove('added-to-cart');
        buttonElement.disabled = false;
    }, 2000);

  } catch (error) {
    showMessage(error.message);
    buttonElement.innerHTML = originalButtonText;
    buttonElement.disabled = false;
  }
}

function renderCart() {
  const cont = document.getElementById('cart-items-container');
  const totalEl = document.getElementById('cart-total');
  const summaryEl = document.getElementById('cart-summary');
  cont.innerHTML = '';

  if (userCart.length === 0) {
    cont.innerHTML = `
        <div class="text-center p-8 border-2 border-dashed rounded-md">
            <h3 class="text-2xl font-bold text-gray-400">Your cart is empty.</h3>
            <p class="text-gray-500 mt-2 mb-6">Looking for something special? Find your next gear in the marketplace.</p>
            <button id="cart-explore-btn" class="modern-button">Explore Gears</button>
        </div>
    `;
    summaryEl.classList.add('hidden');
    document.getElementById('cart-explore-btn').addEventListener('click', () => showSection('marketplace'));
    return;
  }

  summaryEl.classList.remove('hidden');
  let total = 0;
  userCart.forEach(item => {
    total += item.price;
    const el = document.createElement('div');
    el.className = 'flex items-center space-x-4 bg-gray-800 p-4 rounded-xl card-neon-border';
    el.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md">
      <div class="flex-grow">
        <h4 class="text-lg font-bold text-neon-blue">${item.name}</h4><p>${item.price.toFixed(4)} ETH</p>
      </div>
      <button class="remove-from-cart-btn text-red-500 hover:text-red-400 transition-colors" data-product-id="${item._id}">✖</button>`;
    cont.appendChild(el);
  });
  totalEl.textContent = `${total.toFixed(4)} ETH`;
  document.querySelectorAll('.remove-from-cart-btn').forEach(btn =>
    btn.addEventListener('click', e => removeFromCart(e.target.dataset.productId))
  );
}

async function removeFromCart(productId, showMsg = true) {
  if (!currentUser) return;
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/users/cart/${productId}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Failed to remove item');
    userCart = data;
    if (showMsg) showMessage("Item removed from cart.");
    renderCart();
    updateCartCount();
  } catch (error) {
    showMessage(error.message);
  }
}

async function checkout(buttonElement) {
  if (userCart.length === 0) return showMessage('Your cart is empty.');
  
  const total = userCart.reduce((sum, item) => sum + item.price, 0);
  const message = `Confirm purchase of <strong>${userCart.length} item(s)</strong> for a total of <strong>${total.toFixed(4)} ETH</strong>?`;

  showConfirmationModal(message, async () => {
    const itemsToCheckout = [...userCart];
    
    for (const item of itemsToCheckout) {
      // Intentionally don't await so the UI feels fast,
      // but rely on socket events for the final state.
      // We pass null for the button element as we don't have one here.
      buyNow(item._id, null, false);
    }
    
    await fetchCart(); // Re-sync the cart after all requests are fired.
    showMessage("Checkout complete! Your purchases are being processed.");
  });
}

function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (currentUser && userCart.length > 0) {
    el.textContent = userCart.length;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function handleRealTimeCartRemoval(productId, productName) {
    if (!currentUser) return;

    const removedItemIndex = userCart.findIndex(item => item._id === productId);
    if (removedItemIndex > -1) {
        const name = productName || userCart[removedItemIndex].name;
        userCart.splice(removedItemIndex, 1);
        
        updateCartCount();
        if (!document.getElementById('cart-tab').classList.contains('hidden')) {
            renderCart();
        }
        showMessage(`'${name}' was removed from your cart as it's no longer available.`, 4000);
    }
}