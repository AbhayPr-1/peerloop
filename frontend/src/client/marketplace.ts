// frontend/js/marketplace.js

const realtimeRemovedProductIds = new Set();
let productRefreshVersion = 0;
const escrowPurchaseInterface = new ethers.utils.Interface([
    'event EscrowCreated(uint256 escrowId, uint256 productId, address seller, address buyer, uint256 amount)'
]);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col";
  
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

  card.innerHTML = `
    <div class="product-gallery-slot"></div>
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${escapeHtml(product.name)}</h3>
    <p class="text-gray-400 flex-1 mb-4">${escapeHtml(product.description)}</p>
    <div class="text-sm mb-2" style="overflow-wrap: break-word;">
      Seller: <a href="#" class="seller-link">${escapeHtml(sellerDisplay)}</a>
    </div>
    <div class="product-card-meta mb-4">
      <span class="product-card-price text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
      <span class="product-card-category text-xs px-2 py-1 rounded bg-gray-700">${escapeHtml(displayCategory)}</span>
    </div><div class="product-card-actions grid grid-cols-2 gap-3">${actionButtons}</div>`;
  const imageGallery = createProductImageGallery(product.imageUrl, product.name, 'marketplace', () => showQuickView(product));
  card.querySelector('.product-gallery-slot').replaceWith(imageGallery);

  const buyNowBtn = card.querySelector(".buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal(); // Still need to be logged in to buy
      const message = `Buy <strong>${escapeHtml(product.name)}</strong> for <strong>${Number(product.price).toFixed(4)} ETH</strong>? Payment will be held in escrow until you release it or request a refund.`;
      showConfirmationModal(message, () => buyNow(product, e.currentTarget));
    });
  }

  const addToCartBtn = card.querySelector(".add-to-cart-btn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal(); // Still need to be logged in to add
      addToCart(product, e.currentTarget);
    });
  }

  const sellerLink = card.querySelector(".seller-link");
  if (sellerLink) {
    sellerLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderSellerProfile(product.seller, sellerDisplay);
    });
  }
  
  return card;
}

function renderProducts(list) {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No products match your filters.</p>`;
    return;
  }
  list.forEach(p => grid.appendChild(createProductCard(p)));
}

async function loadProductsFromChain() {
    const productsFromChain = await readMarketplaceProducts();
    let categories = {};
    try {
        const categoryResponse = await fetchWithTimeout(
            `${API_URL}/api/listing-metadata`,
            { cache: 'no-store' },
            1500
        );
        if (!categoryResponse.ok) {
            throw new Error(`Category service returned HTTP ${categoryResponse.status}.`);
        }
        const categoryData = await categoryResponse.json();
        if (!categoryData || typeof categoryData !== 'object' || Array.isArray(categoryData)) {
            throw new Error('Category service returned invalid data.');
        }
        categories = categoryData;
    } catch (error) {
        console.warn('Listing categories are unavailable; showing products with their default category.', error.message);
    }

    return productsFromChain
        .filter(p => !realtimeRemovedProductIds.has(p.id.toString()))
        .map(p => ({
            _id: p.id.toString(),
            name: String(p.name || ''),
            description: String(p.description || ''),
            price: Number(ethers.utils.formatEther(p.price)),
            seller: String(p.seller || ''),
            imageUrl: String(p.imageUrl || ''),
            category: categories[p.id.toString()] || 'data',
            isSold: Boolean(p.isSold)
        }));
}

async function fetchProducts(waitForSync = false, retryCount = 0) {
    const grid = document.getElementById("product-grid");
    const refreshVersion = ++productRefreshVersion;
    if (!waitForSync) {
        const loadingMessage = document.createElement('p');
        loadingMessage.className = 'text-center text-gray-500 col-span-full';
        loadingMessage.textContent = 'Loading Explore Gears...';
        grid.replaceChildren(loadingMessage);
    }

    try {
        if (waitForSync) {
            await delay(1000);
        }

        const products = await loadProductsFromChain();
        if (refreshVersion !== productRefreshVersion) return;
        allProducts = products;
        filterAndSortProducts();
        
    } catch (error) {
        if (refreshVersion !== productRefreshVersion) return;
        console.error("Failed to fetch products:", error);
        if (retryCount < 2) {
            const retryMessage = document.createElement('p');
            retryMessage.className = 'text-center text-gray-500 col-span-full';
            retryMessage.textContent = 'Marketplace is taking longer than usual. Retrying...';
            grid.replaceChildren(retryMessage);
            setTimeout(() => {
                if (refreshVersion === productRefreshVersion
                    && !document.getElementById('marketplace').classList.contains('hidden')) {
                    fetchProducts(false, retryCount + 1);
                }
            }, 1000 * (retryCount + 1));
            return;
        }
        const details = error.shortMessage
            || error.reason
            || error.error?.message
            || error.message
            || 'Unknown error';
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-center text-red-500 col-span-full';
        errorMessage.textContent = `Could not load Explore Gears after retrying: ${details}`;
        grid.replaceChildren(errorMessage);
    }
}

function filterAndSortProducts() {
  const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  const cat = (document.querySelector("#category-filter input[type='hidden']") as HTMLInputElement | null)?.value || "all";
  const sortBy = (document.querySelector("#sort-by input[type='hidden']") as HTMLInputElement | null)?.value || "date-desc";
  const priceControl = document.getElementById('price-filter');
  if (priceControl && allProducts.length) {
    const highest = Math.max(0.001, ...allProducts.map(p => Number(p.price) || 0));
    const bound = Math.ceil(highest * 1000) / 1000;
    const oldBound = Number(priceControl.dataset.bound || priceControl.max);
    if (!priceControl.dataset.bound || Number(priceControl.value) >= oldBound - 0.001) priceControl.value = String(bound);
    priceControl.max = String(bound);
    priceControl.dataset.bound = String(bound);
    document.getElementById('price-filter-max-label').textContent = `${bound.toFixed(3)} ETH`;
    const output = document.getElementById('price-filter-value');
    output.textContent = Number(priceControl.value) >= bound - 0.001 ? 'Any price' : `${Number(priceControl.value).toFixed(3)} ETH`;
  }
  let list = [...allProducts];
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (cat !== "all") list = list.filter(p => p.category === cat);
  if (document.getElementById('available-only')?.checked) list = list.filter(p => !p.isSold);
  if (priceControl) list = list.filter(p => Number(p.price) <= Number(priceControl.value) + 1e-9);
  switch (sortBy) {
    case "price-asc": list.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case "price-desc": list.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "name-desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
    default: break;
  }
  const count = document.getElementById('product-count');
  if (count) count.textContent = `${list.length} ${list.length === 1 ? 'listing' : 'listings'}`;
  renderProducts(list);
}async function buyNow(product, buttonElement = null) {
  if (!currentUser) return showAuthModal();
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");

  if (buttonElement) setButtonLoading(buttonElement, true, 'Paying...');

  try {
    await ensureSepoliaNetwork();
    const priceInWei = ethers.utils.parseEther(product.price.toString());
    showMessage("Sending transaction... Please check your wallet.");
    
    const tx = await marketplaceContract.buyProductWithEscrow(product._id, { value: priceInWei });
    
    if (buttonElement) setButtonLoading(buttonElement, true, 'Confirming...');
    const receipt = await tx.wait();
    invalidateWalletTransactionHistory();
    let escrowId = null;
    for (const log of receipt.logs || []) {
        try {
            const parsed = escrowPurchaseInterface.parseLog(log);
            if (parsed.name === 'EscrowCreated' && parsed.args.productId.toString() === String(product._id)) {
                escrowId = parsed.args.escrowId.toString();
                break;
            }
        } catch (_) {
            // Ignore logs emitted by other contracts in the same transaction.
        }
    }
    if (!escrowId) throw new Error('Purchase was confirmed, but its escrow record could not be read.');

    const confirmedPurchase = recordConfirmedEscrowPurchase({
        productId: product._id,
        name: product.name,
        price: product.price,
        seller: product.seller,
        buyer: currentUser.walletAddress,
        imageUrl: product.imageUrl,
        description: product.description,
        category: product.category,
        escrowId,
        transactionHash: receipt.transactionHash || tx.hash,
        blockNumber: receipt.blockNumber
    });
    
    showEscrowDashboard(confirmedPurchase);
    showMessage("Purchase secured in escrow. Review its status and release or refund it from Escrow.");

    fetchProducts(true); 
    
  } catch (error) {
    console.error("Purchase failed:", error);
    let errorMessage = "Transaction failed. Please check console for details.";

    if (error.reason) {
        errorMessage = error.reason;
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT' && error.error && error.error.message) {
        errorMessage = error.error.message.replace('execution reverted: ', '');
    } else if (error.code === -32603 && error.data && error.data.message) {
        errorMessage = error.data.message;
    } else if (error.code === 'USER_REJECTED_TRANSACTION' || error.message.includes("user rejected transaction")) {
        errorMessage = "Payment was cancelled by the user.";
    }

    showMessage(errorMessage);
    throw error;
  } finally {
    if (buttonElement) setButtonLoading(buttonElement, false);
  }
}

async function deleteProduct(productId, buttonElement) {
  if (!currentUser) return showAuthModal();
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");

  setButtonLoading(buttonElement, true, 'Deleting...');

  try {
      showMessage("Sending transaction... Please check your wallet.");
      await ensureSepoliaNetwork();
      const tx = await marketplaceContract.deleteProduct(productId);
      setButtonLoading(buttonElement, true, 'Confirming...');
      await tx.wait(); 
      
      showMessage("Listing deleted successfully!");
      
      if (Array.isArray(accountDashboardListings)) {
        accountDashboardListings = accountDashboardListings.filter((product) => String(product._id) !== String(productId));
        document.getElementById('profile-listing-count').textContent = String(accountDashboardListings.length);
      }

      buttonElement.closest('.card-neon-border').remove(); 

      fetchProducts(true); 
      
  } catch (error) {
      console.error("Product deletion failed:", error);
      let errorMessage = "Transaction failed. Please check console for details.";
      if (error.reason) {
          errorMessage = error.reason;
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT' && error.error && error.error.message) {
          errorMessage = error.error.message.replace('execution reverted: ', '');
      } else if (error.code === -32603 && error.data && error.data.message) {
          errorMessage = error.data.message;
      } else if (error.code === 'USER_REJECTED_TRANSACTION') {
          errorMessage = "Deletion was cancelled by the user.";
      }
      showMessage(errorMessage);
      throw error;
  } finally {
      if (buttonElement) setButtonLoading(buttonElement, false);
  }
}