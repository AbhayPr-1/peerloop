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

window.clearUserCart = clearUserCart;

async function processCartItems(items, purchaseItem) {
  const results = [];
  for (const item of items) {
    try {
      const purchase = await purchaseItem(item);
      results.push({
        item,
        status: 'success',
        transactionHash: purchase.transactionHash
      });
    } catch (error) {
      results.push({
        item,
        status: 'failed',
        error: error && typeof error === 'object' && 'message' in error
          ? String(error.message) : String(error)
      });
    }
  }
  return results;
}

window.PeerLoopCheckout = { processItems: processCartItems };

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
    buttonElement.innerHTML = '<span class="inline-flex items-center gap-1.5"><svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Added</span>';
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
    const emptyState = document.createElement('div');
    emptyState.className = 'text-center py-16 px-6 glass-panel rounded-2xl';
    emptyState.innerHTML = `
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/30 flex items-center justify-center text-neon-blue">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
      </div>
      <h3 class="text-2xl font-bold mb-2">Your Bag is Empty</h3>
      <p class="text-gray-400 mb-6 max-w-sm mx-auto text-sm leading-relaxed">Discover gears with built-in decentralized escrow security in our marketplace.</p>
      <button type="button" class="modern-button mx-auto px-6 py-2.5" onclick="showSection('marketplace')">Explore Marketplace</button>
    `;
    cont.replaceChildren(emptyState);
    summaryEl.classList.add('hidden');
    return;
  }

  summaryEl.classList.remove('hidden');
  const totalWei = window.PeerLoopMoney.sumEth(userCart.map(item => item.price));
  userCart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item-card flex items-center space-x-4 bg-gray-800 p-4 rounded-xl card-neon-border transition-all duration-200';
    el.innerHTML = `
      <div class="cart-image-gallery-slot"></div>
      <div class="flex-grow">
        <h4 class="text-lg font-bold text-neon-blue">${escapeHtml(item.name)}</h4>
        <p class="text-neon-pink font-semibold mt-0.5">${window.PeerLoopMoney.formatEth(item.price)} ETH</p>
      </div>
      <button class="remove-from-cart-btn p-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" data-product-id="${escapeHtml(item._id)}" aria-label="Remove item">
        <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>`;
    el.querySelector('.cart-image-gallery-slot').replaceWith(createProductImageGallery(item.imageUrl, item.name, 'cart'));
    cont.appendChild(el);
  });
  totalEl.textContent = `${window.PeerLoopMoney.fromWei(totalWei)} ETH`;
  document.querySelectorAll('.remove-from-cart-btn').forEach(btn =>
    btn.addEventListener('click', () => removeFromCart((btn as HTMLButtonElement).dataset.productId))
  );
}

async function removeFromCart(productId, showMsg = true) {
  if (!currentUser) return;
  try {
    const itemCard = document.querySelector(`.remove-from-cart-btn[data-product-id="${productId}"]`)?.closest('.cart-item-card') as HTMLElement | null;
    if (itemCard) {
      itemCard.style.opacity = '0';
      itemCard.style.transform = 'scale(0.95)';
    }
    userCart = userCart.filter(item => item._id !== productId);
    if (showMsg) showMessage("Item removed from cart.");
    setTimeout(() => {
      renderCart();
      updateCartCount();
    }, 120);
  } catch (error) {
    showMessage(error.message);
  }
}

async function checkout(buttonElement) {
  if (userCart.length === 0) return showMessage('Your cart is empty.');
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");

  const totalWei = window.PeerLoopMoney.sumEth(userCart.map(item => item.price));
  const total = window.PeerLoopMoney.fromWei(totalWei);
  const message = `Buy <strong>${userCart.length} item(s)</strong> for a total of <strong>${total} ETH</strong>? Each payment will be held in escrow until you release it or request a refund.`;

  showConfirmationModal(message, async () => {
    showMessage("Please approve each transaction in your wallet.");
    const itemsToCheckout = [...userCart];
    const resultsContainer = document.getElementById('checkout-results');
    resultsContainer.replaceChildren();
    if (buttonElement) setButtonLoading(buttonElement, true, 'Processing...');

    try {
      const results = await window.PeerLoopCheckout.processItems(itemsToCheckout, buyNow);
      let succeeded = 0;
      let failed = 0;
      for (const checkoutResult of results) {
        const { item } = checkoutResult;
        const result = document.createElement('p');
        if (checkoutResult.status === 'success') {
          removeFromCart(item._id, false);
          succeeded += 1;
          result.append(`${item.name}: successful`);
          if (/^0x[a-f0-9]{64}$/i.test(checkoutResult.transactionHash || '')) {
            const link = document.createElement('a');
            link.href = `https://sepolia.etherscan.io/tx/${checkoutResult.transactionHash}`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = ' View transaction';
            result.appendChild(link);
          }
        } else {
          console.error(`Checkout failed for ${item.name}: ${checkoutResult.error}`);
          failed += 1;
          result.textContent = `${item.name}: failed - ${checkoutResult.error}`;
        }
        resultsContainer.appendChild(result);
      }
      await fetchCart();
      showMessage(`Checkout finished: ${succeeded} successful, ${failed} failed. See item results below.`);
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
    el.classList.add('cart-count-pop');
    setTimeout(() => el.classList.remove('cart-count-pop'), 400);
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
