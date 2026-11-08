// frontend/js/cart.js
let userCart = [];
let activeCartUserId = null;

function fetchCart() {
  if (currentUser) {
    if (activeCartUserId !== currentUser.id) {
      userCart = [];
      activeCartUserId = currentUser.id;
    }
  } else {
    userCart = [];
    activeCartUserId = null;
  }
  updateCartCount();
  if (!document.getElementById('cart-tab').classList.contains('hidden')) {
    renderCart();
  }
}

function clearUserCart() {
  userCart = [];
  activeCartUserId = null;
  updateCartCount();
}

(window as any).clearUserCart = clearUserCart;

async function addToCart(product, buttonElement) {
  if (!currentUser) return showMessage("You must be logged in.");
  fetchCart();
  const originalButtonText = buttonElement.innerHTML;
  buttonElement.disabled = true;

  try {
    if (userCart.find(item => item._id === product._id)) {
      throw new Error("Product already in cart");
    }
    userCart.push(product);
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
    const emptyState = document.createElement('p');
    emptyState.className = 'text-center text-gray-500';
    emptyState.textContent = 'No items.';
    cont.replaceChildren(emptyState);
    summaryEl.classList.add('hidden');
    return;
  }

  summaryEl.classList.remove('hidden');
  let total = 0;
  userCart.forEach(item => {
    const itemPrice = Number(item.price);
    if (Number.isFinite(itemPrice)) total += itemPrice;
    const el = document.createElement('div');
    el.className = 'flex items-center space-x-4 bg-gray-800 p-4 rounded-xl card-neon-border';
    el.innerHTML = `
      <div class="cart-image-gallery-slot"></div>
      <div class="flex-grow">
        <h4 class="text-lg font-bold text-neon-blue">${escapeHtml(item.name)}</h4><p>${(Number.isFinite(itemPrice) ? itemPrice : 0).toFixed(4)} ETH</p>
      </div>
      <button class="remove-from-cart-btn text-red-500 hover:text-red-400 transition-colors" data-product-id="${escapeHtml(item._id)}">✖</button>`;
    el.querySelector('.cart-image-gallery-slot').replaceWith(createProductImageGallery(item.imageUrl, item.name, 'cart'));
    cont.appendChild(el);
  });
  totalEl.textContent = `${total.toFixed(4)} ETH`;
  document.querySelectorAll('.remove-from-cart-btn').forEach(btn =>
    btn.addEventListener('click', () => removeFromCart((btn as HTMLButtonElement).dataset.productId))
  );
}

async function removeFromCart(productId, showMsg = true) {
  if (!currentUser) return;
  try {
    userCart = userCart.filter(item => item._id !== productId);
    if (showMsg) showMessage("Item removed from cart.");
    renderCart();
    updateCartCount();
  } catch (error) {
    showMessage(error.message);
  }
}

async function checkout(buttonElement) {
  if (userCart.length === 0) return showMessage('Your cart is empty.');
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");

  const total = userCart.reduce((sum, item) => sum + item.price, 0);
  const message = `Buy <strong>${userCart.length} item(s)</strong> for a total of <strong>${total.toFixed(4)} ETH</strong>? Each payment will be held in escrow until you release it or request a refund.`;

  showConfirmationModal(message, async () => {
    showMessage("Please approve each transaction in your wallet.");
    const itemsToCheckout = [...userCart];
    if (buttonElement) setButtonLoading(buttonElement, true, 'Processing...');

    try {
      for (const item of itemsToCheckout) {
        try {
          await buyNow(item, null);
          removeFromCart(item._id, false);
        } catch (e) {
          console.error(`Skipping ${item.name} due to transaction failure.`, e);
        }
      }
      await fetchCart();
      showMessage("Checkout process finished.");
    } catch (error) {
      showMessage(error.message || "An unexpected error occurred during checkout.");
    } finally {
      if (buttonElement) setButtonLoading(buttonElement, false);
    }
  });
}

function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (currentUser && userCart.length > 0) {
    el.textContent = String(userCart.length);
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function handleRealTimeCartRemoval(productId, productName) {
  if (!currentUser) return;
  fetchCart();
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
