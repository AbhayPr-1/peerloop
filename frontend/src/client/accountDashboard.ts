(function (global) {
  'use strict';

  let history = null;
  let historyError = null;
  let historyLoading = false;
  let listings = null;
  let listingsError = null;
  let listingsLoading = false;
  let view = 'purchased';
  let requestId = 0;
  let optimisticHistory = null;

  function isEscrowView() {
    return view === 'escrow';
  }

  function paintActivityRows() {
    const tbody = document.getElementById('profile-activity-rows');
    const listingGrid = document.getElementById('profile-listings-grid');
    const tableWrap = document.querySelector('#user-profile-tab .profile-table-wrap');
    if (!tbody || !listingGrid || !tableWrap) return;
    const isListings = view === 'listings';
    listingGrid.classList.toggle('hidden', !isListings);
    tableWrap.classList.toggle('hidden', isListings);
    document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.profileTable === view);
    });

    const heading = document.getElementById('profile-activity-heading');
    const counterpartyHeading = document.getElementById('profile-counterparty-heading');
    if (heading) {
      heading.textContent = isListings ? 'My Listings'
        : view === 'sold' ? 'Sold History'
          : isEscrowView() ? 'Escrow' : 'My Purchases';
    }
    if (counterpartyHeading) counterpartyHeading.textContent = view === 'sold' ? 'Buyer' : 'Seller';

    if (isListings) {
      listingGrid.replaceChildren();
      if (listings === null) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'profile-empty col-span-full';
        errorMessage.textContent = listingsLoading
          ? 'Loading your listings…'
          : `Could not load listings: ${listingsError?.message || 'Please try again.'}`;
        listingGrid.appendChild(errorMessage);
        return;
      }
      if (!listings.length) {
        const emptyState = document.createElement('p');
        emptyState.className = 'profile-empty col-span-full';
        emptyState.textContent = 'You have no active listings.';
        listingGrid.appendChild(emptyState);
        return;
      }
      listings.forEach(product => {
        listingGrid.appendChild(createProfileProductCard({
          _id: product._id,
          name: product.name,
          description: product.description,
          price: product.price,
          seller: product.seller,
          imageUrl: product.imageUrl,
          category: product.category,
          isSold: product.isSold
        }, 'listings'));
      });
      return;
    }

    if (!history) {
      tbody.replaceChildren();
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'profile-empty';
      if (!historyError) {
        cell.textContent = 'Checking Sepolia for your activity…';
      } else {
        cell.textContent = 'Could not load transaction history. Check your connection and retry.';
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'modern-button-secondary ml-3';
        retryButton.textContent = 'Retry';
        retryButton.addEventListener('click', () => renderDashboard());
        cell.append(' ', retryButton);
      }
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    const isSold = view === 'sold';
    const escrowView = isEscrowView();
    const data = isSold
      ? history.sold.filter(item => !item.refunded)
      : escrowView
        ? history.purchased.filter(item => item.escrowId)
        : history.purchased.filter(item => !item.refunded
          && !history.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
    tbody.replaceChildren();
    if (!data.length) {
      const row = document.createElement('tr');
      const emptyMessage = historyLoading
        ? 'Continuing to sync on-chain activity…'
        : isSold
          ? 'No completed sales found for this wallet.'
          : escrowView ? 'No escrow purchases found for this wallet.' : 'No purchased items found for this wallet.';
      row.innerHTML = `<td colspan="7" class="profile-empty">${emptyMessage}</td>`;
      tbody.appendChild(row);
      return;
    }

    data.forEach(item => {
      const row = document.createElement('tr');
      const imageCell = document.createElement('td');
      const itemCell = document.createElement('div');
      itemCell.className = 'profile-item';
      const imageGallery = createProductImageGallery(item.imageUrl, item.name || 'Marketplace item', 'compact');
      const title = document.createElement('span');
      title.textContent = item.name || 'Marketplace item';
      itemCell.append(imageGallery, title);
      imageCell.appendChild(itemCell);
      const nameCell = document.createElement('td');
      nameCell.textContent = item.name || 'Marketplace item';
      const walletCell = document.createElement('td');
      walletCell.className = 'profile-wallet-cell';
      walletCell.textContent = isSold ? (item.buyer || '') : (item.seller || '');
      walletCell.title = walletCell.textContent;
      const dateCell = document.createElement('td');
      const soldDate = item.soldAt ? new Date(item.soldAt) : null;
      dateCell.textContent = soldDate && !Number.isNaN(soldDate.getTime())
        ? soldDate.toLocaleDateString()
        : Number(item.blockNumber) ? `Block ${item.blockNumber}` : '-';
      const priceCell = document.createElement('td');
      priceCell.textContent = `${(Number(item.price) || 0).toFixed(4)} ETH`;
      const linkCell = document.createElement('td');
      if (/^0x[a-f0-9]{64}$/i.test(item.transactionHash || '')) {
        const link = document.createElement('a');
        link.href = `https://sepolia.etherscan.io/tx/${item.transactionHash}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View';
        linkCell.appendChild(link);
      } else {
        linkCell.textContent = '-';
      }
      const escrowCell = document.createElement('td');
      const escrowStatus = document.createElement('div');
      escrowStatus.className = 'escrow-status';
      escrowCell.appendChild(escrowStatus);
      renderEscrowStatus(String(item._id), escrowStatus, null, item);
      row.append(imageCell, nameCell, walletCell, dateCell, priceCell, linkCell, escrowCell);
      tbody.appendChild(row);
    });
    if (historyLoading) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'profile-empty';
      cell.textContent = 'Continuing to sync on-chain activity…';
      row.appendChild(cell);
      tbody.appendChild(row);
    }
  }

  async function renderDashboard() {
    if (!currentUser) return showAuthModal();
    const currentRequestId = ++requestId;
    const name = currentUser.name || 'PeerLoop member';
    const wallet = currentUser.walletAddress || '';
    const avatarText = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
    document.getElementById('profile-display-name').textContent = name;
    document.getElementById('profile-avatar').textContent = avatarText;
    document.getElementById('profile-activity-rows').innerHTML = '<tr><td colspan="7" class="profile-empty">Checking Sepolia for your activity…</td></tr>';
    document.getElementById('profile-owned-value').textContent = '—';
    document.getElementById('profile-sold-count').textContent = '—';
    document.getElementById('profile-listings-grid').replaceChildren();
    history = optimisticHistory || getCachedWalletTransactionHistory(wallet);
    optimisticHistory = null;
    historyError = null;
    listings = null;
    listingsError = null;
    listingsLoading = true;
    historyLoading = true;
    document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(button => {
      button.classList.toggle('active', button.dataset.profileTable === view);
    });

    const address = wallet.toLowerCase();
    if (history) {
      const ownedItems = history.purchased.filter(item => !item.refunded);
      const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
      document.getElementById('profile-owned-value').textContent = `${ownedValue.toFixed(4)} ETH`;
      document.getElementById('profile-sold-count').textContent = String(history.sold.filter(item => !item.refunded).length);
      paintActivityRows();
    }

    const historyPromise = getWalletTransactionHistory(wallet, partialHistory => {
      if (currentRequestId !== requestId) return;
      history = partialHistory;
      const ownedItems = partialHistory.purchased.filter(item => !item.refunded
        && !partialHistory.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
      const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
      document.getElementById('profile-owned-value').textContent = `${ownedValue.toFixed(4)} ETH`;
      document.getElementById('profile-sold-count').textContent = String(partialHistory.sold.filter(item => !item.refunded).length);
      paintActivityRows();
    }).then(walletHistory => {
      if (currentRequestId !== requestId) return;
      history = walletHistory;
      historyError = null;
      const ownedItems = walletHistory.purchased.filter(item => !item.refunded
        && !walletHistory.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
      const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
      document.getElementById('profile-owned-value').textContent = `${ownedValue.toFixed(4)} ETH`;
      document.getElementById('profile-sold-count').textContent = String(walletHistory.sold.filter(item => !item.refunded).length);
      paintActivityRows();
      void enrichWalletTransactionHistory(wallet, walletHistory).then(enrichedHistory => {
        if (currentRequestId !== requestId || history !== walletHistory) return;
        history = enrichedHistory;
        paintActivityRows();
      }).catch(error => {
        console.warn('Could not enrich profile transaction history:', error);
      });
    });
    const listingPromise = loadProductsFromChain().then(products => {
      if (currentRequestId !== requestId) return;
      updateListings(products);
    });
    const [historyResult, listingResult] = await Promise.allSettled([historyPromise, listingPromise]);
    if (currentRequestId !== requestId) return;
    historyLoading = false;
    if (history) paintActivityRows();
    const historyOk = historyResult.status === 'fulfilled';
    const listingOk = listingResult.status === 'fulfilled';
    if (!historyOk && !history) {
      document.getElementById('profile-owned-value').textContent = 'Unavailable';
      document.getElementById('profile-sold-count').textContent = 'Unavailable';
      historyError = historyResult.reason;
      console.error('Could not load profile transaction history:', historyResult.reason);
      paintActivityRows();
    }
    if (!listingOk) {
      listings = null;
      listingsError = listingResult.reason;
      listingsLoading = false;
      document.getElementById('profile-listing-count').textContent = 'Unavailable';
      if (view === 'listings') paintActivityRows();
    }
    if (!historyOk || !listingOk) {
      const issues = [];
      if (!historyOk) issues.push('transaction history');
      if (!listingOk) issues.push('active listings');
      showMessage(`Some profile data could not be loaded (${issues.join(' and ')}).`, 4500);
    }
  }

  function updateListings(products) {
    if (!currentUser) return;
    listings = products.filter(item =>
      item.seller.toLowerCase() === currentUser.walletAddress.toLowerCase() && !item.isSold
    );
    listingsError = null;
    listingsLoading = false;
    document.getElementById('profile-listing-count').textContent = String(listings.length);
    if (view === 'listings'
      && !document.getElementById('user-profile-tab').classList.contains('hidden')) {
      paintActivityRows();
    }
  }

  function removeListing(productId) {
    if (!Array.isArray(listings)) return;
    listings = listings.filter(product => String(product._id) !== String(productId));
    document.getElementById('profile-listing-count').textContent = String(listings.length);
    if (view === 'listings'
      && !document.getElementById('user-profile-tab').classList.contains('hidden')) {
      paintActivityRows();
    }
  }

  function refreshEscrowState(productId, escrowId, state) {
    if (!history) return;
    for (const item of [...history.purchased, ...history.sold]) {
      if (item._id !== String(productId) || String(item.escrowId) !== String(escrowId)) continue;
      item.escrowState = Number(state);
      item.refunded = Number(state) === 3;
    }
    const ownedItems = history.purchased.filter(item => !item.refunded
      && !history.sold.some(sold => sold._id === item._id
        && !sold.refunded && Number(sold.blockNumber) > Number(item.blockNumber)));
    const ownedValue = ownedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
    document.getElementById('profile-owned-value').textContent = `${ownedValue.toFixed(4)} ETH`;
    document.getElementById('profile-sold-count').textContent = String(
      history.sold.filter(item => !item.refunded).length
    );
    paintActivityRows();
  }

  function setView(nextView) {
    view = nextView;
    paintActivityRows();
  }

  function showEscrowDashboard(purchase = null) {
    if (!currentUser) return showAuthModal();
    view = 'escrow';
    optimisticHistory = purchase ? { purchased: [purchase], sold: [] } : null;
    showSection('user-profile-tab');
  }

  function createProfileProductCard(product, context) {
    const card = document.createElement('div');
    card.className = 'theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col';
    let contextInfo = '';
    let actionButtons = '';

    const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';
    let historyInfo = '';
    if (context === 'sold' || context === 'purchased') {
      const completedAt = product.soldAt
        ? new Date(product.soldAt).toLocaleString()
        : `Block ${Number(product.blockNumber) || 'unknown'}`;
      const transactionLink = /^0x[a-f0-9]{64}$/i.test(product.transactionHash || '')
        ? `<a class="text-neon-blue underline text-sm" href="https://sepolia.etherscan.io/tx/${product.transactionHash}" target="_blank" rel="noopener noreferrer">View transaction</a>`
        : '';
      historyInfo = `<p class="text-xs text-gray-500 mb-2">${context === 'purchased' ? 'Purchase recorded' : 'Sale recorded'} ${escapeHtml(completedAt)}</p>${transactionLink}`;
    }

    const sellerAddressDisplay = formatAddress(product.seller);
    const buyerAddressDisplay = formatAddress(product.buyer);
    if (context === 'sold' && product.buyer) {
      contextInfo = `<p class="text-sm text-green-400 mb-2" style="overflow-wrap: break-word;">Sold to: ${escapeHtml(product.buyer.name || buyerAddressDisplay)}</p>`;
    } else if (context === 'purchased' && product.seller) {
      contextInfo = `<p class="text-sm text-yellow-400 mb-2" style="overflow-wrap: break-word;">Purchased from: ${escapeHtml(product.seller.name || sellerAddressDisplay)}</p>`;
    } else if (context === 'listings') {
      contextInfo = '<p class="text-sm text-blue-400 mb-2">Status: Listed for sale</p>';
      actionButtons = `
        <div class="grid grid-cols-1 gap-3 mt-4">
          <label class="text-sm text-gray-400">
            Category
            <select class="listing-category-select w-full mt-1 p-2 rounded-xl auth-input">
              ${Object.entries(categoryDisplayMap).map(([value, label]) => `<option value="${value}"${product.category === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
            </select>
          </label>
          <button class="modern-button-secondary save-listing-category-btn">Save Category</button>
          <button class="modern-button-secondary delete-listing-btn !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white">Delete</button>
        </div>`;
    }

    card.innerHTML = `
      <div class="profile-image-gallery-slot"></div>
      <h3 class="text-2xl font-bold text-neon-blue mb-2">${escapeHtml(product.name)}</h3>
      ${contextInfo}
      ${historyInfo}
      <p class="text-gray-400 flex-1 mb-4">${escapeHtml(product.description)}</p>
      <div class="flex items-center justify-between">
        <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
        <span class="category-label text-xs px-2 py-1 rounded bg-gray-700">${escapeHtml(displayCategory)}</span>
      </div>
      ${actionButtons}
      ${context === 'purchased' ? `<div class="escrow-status mt-4 text-sm" data-product-id="${escapeHtml(product._id)}">Loading escrow status...</div>` : ''}`;
    card.querySelector('.profile-image-gallery-slot').replaceWith(
      createProductImageGallery(product.imageUrl, product.name, 'profile')
    );

    if (context === 'purchased') {
      renderEscrowStatus(String(product._id), card.querySelector('.escrow-status'));
    }

    if (context === 'listings') {
      const saveCategoryBtn = card.querySelector('.save-listing-category-btn');
      saveCategoryBtn?.addEventListener('click', async () => {
        const category = (card.querySelector('.listing-category-select') as HTMLSelectElement).value;
        setButtonLoading(saveCategoryBtn, true, 'Saving...');
        try {
          const response = await fetch(`${API_URL}/api/listing-metadata`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId: product._id, category })
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.msg || 'Could not save the category.');
          }
          product.category = category;
          const currentProduct = allProducts.find(item => item._id === product._id);
          if (currentProduct) currentProduct.category = category;
          (card.querySelector('.listing-category-select') as HTMLSelectElement).value = category;
          card.querySelector('.category-label').textContent = categoryDisplayMap[category];
          showMessage('Listing category updated.');
        } catch (error) {
          console.error('Could not update listing category:', error);
          showMessage(error.message || 'Could not save the category.');
        } finally {
          setButtonLoading(saveCategoryBtn, false);
        }
      });

      const deleteBtn = card.querySelector('.delete-listing-btn');
      deleteBtn?.addEventListener('click', event => {
        const button = event.currentTarget;
        showConfirmationModal(
          'Are you sure you want to permanently delete this listing from the blockchain? This action cannot be undone.',
          () => deleteProduct(product._id, button)
        );
      });
    }

    return card;
  }

  async function renderEscrowStatus(productId, container, confirmedState = null, historyRecord = null) {
    if (!container) return;
    container.replaceChildren();
    if (historyLoading && historyRecord && !historyRecord.escrowId) {
      container.textContent = 'Checking escrow status…';
      return;
    }

    try {
      await readOnlyProviderReady;
      if (!readOnlyContract) throw new Error('Marketplace contract is not connected.');
      const escrow = await readOnlyContract.getEscrow(productId);
      const escrowId = escrow.id.toString();
      const status = document.createElement('p');
      status.className = 'text-sm text-gray-400 mb-2';

      if (historyRecord && !historyRecord.escrowId) {
        status.textContent = 'No escrow recorded for this purchase.';
        container.appendChild(status);
        return;
      }
      if (escrowId === '0') {
        status.textContent = 'No escrow recorded for this purchase.';
        container.appendChild(status);
        return;
      }

      const escrowState = confirmedState
        ?? (historyRecord ? Number(historyRecord.escrowState) : Number(escrow.state));
      const stateLabels = {
        1: 'Payment held in escrow',
        2: 'Payment released to seller',
        3: 'Payment refunded',
        4: 'Escrow disputed'
      };
      status.textContent = stateLabels[escrowState] || 'Unknown escrow state';
      container.appendChild(status);
      if (historyRecord && historyRecord.escrowId !== escrowId) return;
      if ((escrowState !== 1 && escrowState !== 4)
        || !currentUser
        || String(escrow.buyer).toLowerCase() !== currentUser.walletAddress.toLowerCase()) return;

      const buttons = document.createElement('div');
      buttons.className = 'escrow-actions';
      if (escrowState === 1) {
        const releaseButton = document.createElement('button');
        releaseButton.type = 'button';
        releaseButton.className = 'modern-button-secondary';
        releaseButton.textContent = 'Release payment';
        releaseButton.addEventListener('click', () => showConfirmationModal(
          'Release escrow payment to the seller? This transfer cannot be undone.',
          () => submitEscrowAction(productId, escrowId, 'releaseEscrow', releaseButton, container)
        ));
        buttons.appendChild(releaseButton);
      } else {
        status.textContent = 'Escrow disputed; release is unavailable. You may refund the funds.';
      }

      const refundButton = document.createElement('button');
      refundButton.type = 'button';
      refundButton.className = 'modern-button-secondary !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white';
      refundButton.textContent = 'Refund to me';
      buttons.appendChild(refundButton);
      container.appendChild(buttons);
      refundButton.addEventListener('click', () => showConfirmationModal(
        'Refund this escrow payment to your wallet? The contract will return the funds immediately if the transaction succeeds.',
        () => submitEscrowAction(productId, escrowId, 'refundEscrow', refundButton, container)
      ));
    } catch (error) {
      console.error(`Could not load escrow status for product ${productId}:`, error);
      container.textContent = 'Escrow status unavailable. Please try again later.';
    }
  }

  async function submitEscrowAction(productId, escrowId, method, button, container) {
    if (!marketplaceContract || !signer) {
      showMessage('Connect your wallet again to manage escrow.');
      return;
    }

    setButtonLoading(button, true, 'Processing...');
    try {
      await ensureSepoliaNetwork();
      const tx = await marketplaceContract[method](productId);
      showMessage('Escrow transaction submitted. Waiting for confirmation...');
      await tx.wait();
      invalidateWalletTransactionHistory();
      const confirmedState = method === 'releaseEscrow' ? 2 : 3;
      updateConfirmedEscrowState(productId, escrowId, confirmedState, currentUser?.walletAddress || '');
      refreshEscrowState(productId, escrowId, confirmedState);
      if (method === 'refundEscrow') {
        const refundedProduct = [...(history?.purchased || []), ...(history?.sold || [])]
          .find(item => item._id === String(productId) && String(item.escrowId) === String(escrowId));
        markProductAvailable(productId, refundedProduct);
        await fetchProducts(false, 0, false);
      }
      showMessage(method === 'releaseEscrow'
        ? 'Payment released to the seller.'
        : "Escrow funds refunded and the item returned to the seller's active listings.");
      await renderEscrowStatus(productId, container, confirmedState);
    } catch (error) {
      console.error(`Could not ${method} for product ${productId}:`, error);
      showMessage(error.reason || error.message || 'Escrow transaction failed.');
      setButtonLoading(button, false);
    }
  }

  document.getElementById('nav-profile-btn').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('profile-dropdown-menu').classList.add('hidden');
    if (!currentUser) return showAuthModal();
    showSection('user-profile-tab');
  });
  document.getElementById('nav-escrow-btn').addEventListener('click', () => showEscrowDashboard());
  document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.profileTable));
  });

  global.PeerLoopAccount = {
    renderDashboard,
    setView,
    showEscrowDashboard,
    refreshEscrowState,
    updateListings,
    removeListing
  };
})(window);
