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
  let autoSwitchedToDisputedEscrow = false;
  let profileViewManuallySelected = false;
  let historyWallet = '';
  let historyRequestWallet = '';
  let historyFreshWallet = '';
  let historyUpdatedAt = 0;
  const historyLoadPromises = new Map<string, Promise<any>>();
  let listingsLoadPromise = null;
  let lastActivitySignature = '';
  let activityUpdateVersion = 0;
  const PROFILE_HISTORY_CACHE_MS = 30_000;

  function isEscrowView() {
    return view === 'escrow';
  }

  function getActivityRecords(activityHistory, selectedView) {
    if (selectedView === 'sold') {
      return activityHistory.sold;
    }
    if (selectedView === 'escrow') {
      return [
        ...activityHistory.purchased.filter(item => item.escrowId),
        ...activityHistory.sold.filter(item => item.escrowId && Number(item.escrowState) === 4)
      ];
    }
    return activityHistory.purchased.filter(item => !item.refunded
      && !activityHistory.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
  }

  function shouldAutoOpenDisputeEscrow(hasSellerDispute, selectedView, manuallySelected) {
    return hasSellerDispute && !manuallySelected
      && (selectedView === 'sold' || selectedView === 'purchased');
  }

  function shouldRefreshProfileHistory(hasCachedHistory, lastUpdatedAt, now = Date.now()) {
    return !hasCachedHistory || now - lastUpdatedAt >= PROFILE_HISTORY_CACHE_MS;
  }

  function getDisputeVoteView(votes: number, isBuyer: boolean): {
    myVote: 'release' | 'refund' | null;
    otherVote: 'release' | 'refund' | null;
    choices: Array<'release' | 'refund'>;
  } {
    const buyerVote = votes & 3;
    const sellerVote = votes & 12;
    const myBits = isBuyer ? buyerVote : sellerVote;
    const otherBits = isBuyer ? sellerVote : buyerVote;
    const decodeVote = (bits: number, releaseMask: number): 'release' | 'refund' | null => {
      if (!bits) return null;
      return bits & releaseMask ? 'release' : 'refund';
    };
    const myVote = decodeVote(myBits, isBuyer ? 2 : 8);
    const otherVote = decodeVote(otherBits, isBuyer ? 8 : 2);

    return {
      myVote,
      otherVote,
      choices: ['release', 'refund']
    };
  }

  function syncSellerDisputeView() {
    if (!history || !currentUser) return;
    const hasSellerDispute = history.sold.some(item =>
      Number(item.escrowState) === 4
      && String(item.seller).toLowerCase() === currentUser.walletAddress.toLowerCase()
    );
    if (shouldAutoOpenDisputeEscrow(hasSellerDispute, view, profileViewManuallySelected)) {
      view = 'escrow';
      autoSwitchedToDisputedEscrow = true;
    } else if (!hasSellerDispute && !historyLoading && autoSwitchedToDisputedEscrow && view === 'escrow') {
      view = 'sold';
      autoSwitchedToDisputedEscrow = false;
    }
  }

  function paintActivityRows() {
    syncSellerDisputeView();
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
    const data = getActivityRecords(history, view);
    const loadingState = data.length === 0 && historyLoading ? 'loading' : 'ready';
    const activitySignature = `${view}:${loadingState}:${activityUpdateVersion}:${data.map(item =>
      `${item.transactionHash || item._id}:${item.escrowState}:${item.refunded ? 1 : 0}:${item.imageUrl}:${item.name}:${item.soldAt}`
    ).join('|')}`;
    if (activitySignature === lastActivitySignature) return;
    lastActivitySignature = activitySignature;
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
      priceCell.textContent = `${window.PeerLoopMoney.formatEth(item.price)} ETH`;
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
  }

  async function refreshClaimableBalance() {
    const panel = document.getElementById('profile-claimable-payments');
    const balanceElement = document.getElementById('profile-claimable-balance');
    if (!panel || !balanceElement || !currentUser) return;
    try {
      await readOnlyProviderReady;
      if (!readOnlyContract?.pendingWithdrawals) return;
      const amount = await readOnlyContract.pendingWithdrawals(currentUser.walletAddress);
      const amountWei = BigInt(amount.toString());
      balanceElement.textContent = window.PeerLoopMoney.fromWei(amountWei) + ' ETH';
      panel.classList.toggle('hidden', amountWei === 0n);
    } catch (error) {
      console.warn('Could not load claimable escrow payments:', error);
    }
  }

  async function withdrawClaimablePayments(button) {
    if (!marketplaceContract || !signer) {
      showMessage('Connect your wallet again to withdraw escrow payments.');
      return;
    }
    setButtonLoading(button, true, 'Withdrawing...');
    try {
      await ensureSepoliaNetwork();
      const tx = await marketplaceContract.withdrawPayments();
      showMessage('Withdrawal submitted. Waiting for wallet confirmation...');
      await tx.wait();
      showMessage('Escrow payment withdrawn to your wallet.');
      await refreshClaimableBalance();
    } catch (error) {
      console.error('Could not withdraw escrow payments:', error);
      showMessage(error.reason || error.message || 'Could not withdraw escrow payments.');
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function renderDashboard() {
    if (!currentUser) return showAuthModal();
    const name = currentUser.name || 'PeerLoop member';
    const wallet = currentUser.walletAddress || '';
    const address = wallet.toLowerCase();
    if (historyLoading && historyRequestWallet === address) {
      paintActivityRows();
      return;
    }

    const currentRequestId = ++requestId;
    const avatarText = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
    document.getElementById('profile-display-name').textContent = name;
    document.getElementById('profile-avatar').textContent = avatarText;
    void refreshClaimableBalance();
    const cachedHistory = address === historyWallet ? history : getCachedWalletTransactionHistory(wallet);
    const hasCachedHistory = Boolean(optimisticHistory || cachedHistory);
    if (!hasCachedHistory) {
      document.getElementById('profile-activity-rows').innerHTML = '<tr><td colspan="7" class="profile-empty">Checking Sepolia for your activity…</td></tr>';
      document.getElementById('profile-owned-value').textContent = '—';
      document.getElementById('profile-sold-count').textContent = '—';
    }
    if (view === 'listings' && listings === null) {
      document.getElementById('profile-listings-grid').innerHTML = '<p class="profile-empty col-span-full">Loading your listings…</p>';
    }
    history = optimisticHistory || cachedHistory;
    if (history) historyWallet = address;
    optimisticHistory = null;
    historyError = null;
    const refreshHistory = shouldRefreshProfileHistory(
      hasCachedHistory && historyFreshWallet === address,
      historyUpdatedAt
    );
    historyLoading = refreshHistory;
    document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(button => {
      button.classList.toggle('active', button.dataset.profileTable === view);
    });

    if (history) {
      const ownedItems = history.purchased.filter(item => !item.refunded);
      const ownedValue = window.PeerLoopMoney.sumEth(ownedItems.map(item => item.price));
      document.getElementById('profile-owned-value').textContent = `${window.PeerLoopMoney.fromWei(ownedValue)} ETH`;
      document.getElementById('profile-sold-count').textContent = String(history.sold.filter(item => !item.refunded).length);
      paintActivityRows();
    }

    const historyPromise = refreshHistory
      ? loadHistory(wallet, address, currentRequestId)
      : Promise.resolve(history);
    const listingPromise = view === 'listings' && listings === null
      ? loadListings(currentRequestId)
      : Promise.resolve(listings);
    const [historyResult, listingResult] = await Promise.allSettled([historyPromise, listingPromise]);
    if (currentRequestId !== requestId) return;
    historyLoading = false;
    if (history && view !== 'listings') paintActivityRows();
    const historyOk = historyResult.status === 'fulfilled';
    if (refreshHistory && historyOk) {
      historyFreshWallet = address;
      historyUpdatedAt = Date.now();
    }
    const listingOk = view !== 'listings' || listingResult.status === 'fulfilled';
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

  function loadHistory(wallet, address, currentRequestId) {
    const existingPromise = historyLoadPromises.get(address);
    if (existingPromise) return existingPromise;
    historyLoading = true;
    historyRequestWallet = address;
    const historyPromise = getWalletTransactionHistory(wallet, partialHistory => {
      if (currentRequestId !== requestId) return;
      if (history) return;
      history = partialHistory;
      historyWallet = address;
      paintHistoryStats(partialHistory);
    }).then(walletHistory => {
      if (currentRequestId !== requestId) return walletHistory;
      history = walletHistory;
      historyWallet = address;
      historyError = null;
      paintHistoryStats(walletHistory);
      if (hasUnenrichedHistory(walletHistory)) {
        void enrichWalletTransactionHistory(wallet, walletHistory).then(enrichedHistory => {
          if (currentRequestId !== requestId || history !== walletHistory) return;
          history = enrichedHistory;
          paintActivityRows();
        }).catch(error => {
          console.warn('Could not enrich profile transaction history:', error);
        });
      }
      return walletHistory;
    }).finally(() => {
      historyLoadPromises.delete(address);
      if (historyRequestWallet === address) historyLoading = false;
    });
    historyLoadPromises.set(address, historyPromise);
    return historyPromise;
  }

  function paintHistoryStats(walletHistory) {
    const ownedItems = walletHistory.purchased.filter(item => !item.refunded
      && !walletHistory.sold.some(sold => sold._id === item._id && Number(sold.blockNumber) > Number(item.blockNumber)));
    const ownedValue = window.PeerLoopMoney.sumEth(ownedItems.map(item => item.price));
    document.getElementById('profile-owned-value').textContent = `${window.PeerLoopMoney.fromWei(ownedValue)} ETH`;
    document.getElementById('profile-sold-count').textContent = String(walletHistory.sold.filter(item => !item.refunded).length);
    paintActivityRows();
  }

  function hasUnenrichedHistory(walletHistory) {
    return [...walletHistory.purchased, ...walletHistory.sold].some(item =>
      (!item.imageUrl || !item.description) && Number(item.blockNumber) > 0
    );
  }

  function loadListings(currentRequestId) {
    if (listingsLoadPromise) return listingsLoadPromise;
    listingsLoading = true;
    listingsError = null;
    listingsLoadPromise = loadProductsFromChain().then(products => {
      if (currentRequestId === requestId) updateListings(products);
      return products;
    }).finally(() => {
      listingsLoadPromise = null;
      listingsLoading = false;
    });
    return listingsLoadPromise;
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
    activityUpdateVersion += 1;
    for (const item of [...history.purchased, ...history.sold]) {
      if (item._id !== String(productId) || String(item.escrowId) !== String(escrowId)) continue;
      item.escrowState = Number(state);
      item.refunded = Number(state) === 3;
    }
    const ownedItems = history.purchased.filter(item => !item.refunded
      && !history.sold.some(sold => sold._id === item._id
        && !sold.refunded && Number(sold.blockNumber) > Number(item.blockNumber)));
    const ownedValue = window.PeerLoopMoney.sumEth(ownedItems.map(item => item.price));
    document.getElementById('profile-owned-value').textContent = `${window.PeerLoopMoney.fromWei(ownedValue)} ETH`;
    document.getElementById('profile-sold-count').textContent = String(
      history.sold.filter(item => !item.refunded).length
    );
    paintActivityRows();
  }

  function invalidateHistory() {
    historyUpdatedAt = 0;
    historyFreshWallet = '';
  }

  function setView(nextView) {
    view = nextView;
    profileViewManuallySelected = true;
    autoSwitchedToDisputedEscrow = false;
    paintActivityRows();
    if (view === 'listings' && listings === null && currentUser) {
      void loadListings(requestId).catch(error => {
        listingsError = error;
        listingsLoading = false;
        if (!document.getElementById('user-profile-tab').classList.contains('hidden')) paintActivityRows();
      });
    }
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
        <span class="text-neon-pink font-bold">${window.PeerLoopMoney.formatEth(product.price)} ETH</span>
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
          await window.PeerLoopApi.listingMetadata.saveCategory(String(product._id), category);
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
    if (historyRecord?.escrowId && [2, 3].includes(Number(historyRecord.escrowState))) {
      const completedStatus = document.createElement('p');
      completedStatus.className = 'text-sm text-gray-400 mb-2';
      completedStatus.textContent = Number(historyRecord.escrowState) === 2
        ? 'Payment released to seller'
        : 'Payment refunded';
      container.appendChild(completedStatus);
      return;
    }
    if (historyLoading && historyRecord && !historyRecord.escrowId) {
      container.textContent = 'Checking escrow status…';
      return;
    }

    try {
      await readOnlyProviderReady;
      if (!readOnlyContract) throw new Error('Marketplace contract is not connected.');
      let escrow;
      if (historyRecord?.escrowId && readOnlyContract.escrowHistory) {
        try {
          escrow = await readOnlyContract.escrowHistory(historyRecord.escrowId);
        } catch (error) {
          if (error.code !== 'CALL_EXCEPTION') throw error;
          escrow = await readOnlyContract.getEscrow(productId);
        }
      } else {
        escrow = await readOnlyContract.getEscrow(productId);
      }
      const escrowId = escrow.id.toString();
      const status = document.createElement('p');
      status.className = 'text-sm text-gray-400 mb-2';

      if (historyRecord && !historyRecord.escrowId) {
        status.textContent = 'No escrow recorded for this purchase.';
        container.appendChild(status);
        return;
      }
      if (historyRecord?.escrowId && escrowId !== String(historyRecord.escrowId)) {
        const historicalState = Number(escrow.state);
        const labels = {
          1: 'Payment held in escrow',
          2: 'Payment released to seller',
          3: 'Payment refunded',
          4: 'Escrow disputed'
        };
        status.textContent = `${labels[historicalState] || 'Escrow history'} (historical record)`;
        container.appendChild(status);
        return;
      }
      if (escrowId === '0') {
        status.textContent = 'No escrow recorded for this purchase.';
        container.appendChild(status);
        return;
      }

      const escrowState = confirmedState ?? Number(escrow.state);
      const stateLabels = {
        1: 'Payment held in escrow',
        2: 'Payment released to seller',
        3: 'Payment refunded',
        4: 'Escrow disputed'
      };
      status.textContent = stateLabels[escrowState] || 'Unknown escrow state';
      container.appendChild(status);
      if (!currentUser) return;

      const wallet = currentUser.walletAddress.toLowerCase();
      const isBuyer = String(escrow.buyer).toLowerCase() === wallet;
      const isSeller = String(escrow.seller).toLowerCase() === wallet;
      if (!isBuyer && !isSeller) return;
      const buttons = document.createElement('div');
      buttons.className = 'escrow-actions';
      const addAction = (label, method, args, confirmation, className = 'modern-button-secondary') => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', () => showConfirmationModal(
          confirmation,
          () => submitEscrowAction(productId, escrowId, method, button, container, ...args)
        ));
        buttons.appendChild(button);
        return button;
      };

      if (escrowState === 1) {
        if (isBuyer) {
          addAction(
            'Release payment', 'releaseEscrow', [],
            'Release escrow payment to the seller? This transfer is final.'
          );
          addAction(
            'Refund to me', 'refundEscrow', [],
            'Refund this escrow payment to your wallet? This action is final.',
            'modern-button-secondary !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white'
          );
          addAction(
            'Open dispute', 'disputeEscrow', [],
            'Open a dispute? Escrow settlement will pause until both buyer and seller agree on a resolution. There is no automatic timeout.'
          );
        }
      } else if (escrowState === 4) {
        status.append(document.createElement('br'), 'Both parties must choose the same resolution. Funds remain locked until then.');
        let votes = 0;
        try {
          votes = Number(await readOnlyContract.disputeResolutionVotes(escrowId));
        } catch (error) {
          if (error.code !== 'CALL_EXCEPTION') throw error;
          console.warn('Mutual voting is unavailable on this older marketplace deployment.');
        }
        const voteView = getDisputeVoteView(votes, isBuyer);
        const otherParty = isBuyer ? 'Seller' : 'Buyer';
        if (voteView.myVote) {
          status.append(document.createElement('br'), 'You selected ' + (voteView.myVote === 'release' ? 'Release to seller' : 'Refund to buyer') + '.');
        }
        if (voteView.otherVote) {
          status.append(document.createElement('br'), otherParty + ' selected ' + (voteView.otherVote === 'release' ? 'Release to seller' : 'Refund to buyer') + '.');
        }
        if (voteView.myVote && !voteView.otherVote) {
          status.append(document.createElement('br'), 'Waiting for the ' + (isBuyer ? 'seller' : 'buyer') + ' to choose.');
        } else if (!voteView.myVote && voteView.otherVote) {
          status.append(document.createElement('br'), 'Choose either outcome. Settlement happens only if you both agree.');
        } else if (voteView.myVote && voteView.otherVote && voteView.myVote !== voteView.otherVote) {
          status.append(document.createElement('br'), 'Your choices differ. Funds remain locked; either party may change their choice.');
        }
        for (const choice of voteView.choices) {
          const releaseToSeller = choice === 'release';
          addAction(
            (voteView.myVote ? 'Change my choice to ' : 'Agree to ') + (releaseToSeller ? 'Release' : 'Refund'),
            'voteDisputeResolution', [releaseToSeller],
            releaseToSeller
              ? 'Select release to the seller? If both parties agree, the seller receives a claimable payout.'
              : 'Select refund to the buyer? If both parties agree, the buyer receives a claimable refund.',
            releaseToSeller
              ? 'modern-button-secondary'
              : 'modern-button-secondary !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white'
          );
        }
      }
      if (buttons.childElementCount > 0) container.appendChild(buttons);
    } catch (error) {
      console.error(`Could not load escrow status for product ${productId}:`, error);
      container.textContent = 'Escrow status unavailable. Please try again later.';
    }
  }

  async function submitEscrowAction(productId, escrowId, method, button, container, ...args) {
    if (!marketplaceContract || !signer) {
      showMessage('Connect your wallet again to manage escrow.');
      return;
    }

    setButtonLoading(button, true, 'Processing...');
    try {
      await ensureSepoliaNetwork();
      const tx = await marketplaceContract[method](productId, ...args);
      showMessage('Escrow transaction submitted. Waiting for confirmation...');
      await tx.wait();
      invalidateWalletTransactionHistory();
      invalidateHistory();
      let latestEscrow;
      try {
        latestEscrow = await readOnlyContract.escrowHistory(escrowId);
      } catch (error) {
        if (error.code !== 'CALL_EXCEPTION') throw error;
        latestEscrow = await readOnlyContract.getEscrow(productId);
      }
      const confirmedState = Number(latestEscrow.state);
      if (confirmedState === 2 || confirmedState === 3) {
        updateConfirmedEscrowState(productId, escrowId, confirmedState, currentUser?.walletAddress || '');
        refreshEscrowState(productId, escrowId, confirmedState);
      } else if (confirmedState === 4) {
        updateConfirmedEscrowState(productId, escrowId, confirmedState, currentUser?.walletAddress || '');
      }
      if (confirmedState === 3) {
        const refundedProduct = [...(history?.purchased || []), ...(history?.sold || [])]
          .find(item => item._id === String(productId) && String(item.escrowId) === String(escrowId));
        markProductAvailable(productId, refundedProduct);
        await fetchProducts(false, 0, false);
      }
      const outcomeMessage = confirmedState === 2
        ? 'Payment settled. The seller can withdraw the credited balance.'
        : confirmedState === 3
          ? "Refund settled. The buyer can withdraw the credited balance; the listing is available again."
          : method === 'disputeEscrow'
            ? 'Dispute opened. Both parties must agree on a resolution; funds remain locked until then.'
            : method === 'voteDisputeResolution'
              ? 'Your dispute resolution choice was recorded.'
              : 'Your action was recorded. Check the escrow status for the next step.';
      showMessage(outcomeMessage);
      await refreshClaimableBalance();
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
  document.getElementById('profile-withdraw-payments-btn')?.addEventListener('click', event =>
    void withdrawClaimablePayments(event.currentTarget)
  );
  document.querySelectorAll<HTMLElement>('[data-profile-table]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.profileTable));
  });

  global.PeerLoopAccount = {
    renderDashboard,
    setView,
    showEscrowDashboard,
    refreshEscrowState,
    updateListings,
    removeListing,
    getActivityRecords,
    shouldAutoOpenDisputeEscrow,
    getDisputeVoteView,
    invalidateHistory,
    shouldRefreshProfileHistory
  };
})(window);
