function UserProfile() {
  return (
    <section id="user-profile-tab" className="min-h-screen p-8 hidden-section hidden">
      <div className="max-w-7xl mx-auto profile-dashboard">
        <div className="profile-cover glass-panel">
          <div className="profile-identity">
            <div id="profile-avatar" className="profile-avatar">P</div>
            <div>
              <span className="account-banner-eyebrow">PeerLoop member</span>
              <h2 id="profile-display-name">Your Profile</h2>
            </div>
          </div>
          <div className="profile-network"><span className="network-dot" />Sepolia marketplace</div>
        </div>
        <div id="profile-stats" className="profile-stats">
          <article className="profile-stat-card"><span>Total Value Owned</span><strong id="profile-owned-value">—</strong><small>Items currently held</small></article>
          <article className="profile-stat-card"><span>Active Listings</span><strong id="profile-listing-count">—</strong><small>Your live marketplace items</small></article>
          <article className="profile-stat-card"><span>Items Sold</span><strong id="profile-sold-count">—</strong><small>From on-chain history</small></article>
        </div>
        <div id="profile-claimable-payments" className="profile-collection glass-panel hidden">
          <div className="profile-collection-heading profile-payout-heading">
            <div><span className="account-banner-eyebrow">Escrow payouts</span><h3>Available to withdraw</h3></div>
            <strong id="profile-claimable-balance">0 ETH</strong>
            <button id="profile-withdraw-payments-btn" type="button" className="modern-button-secondary">Withdraw</button>
          </div>
          <p className="profile-payout-description text-sm text-gray-400">Settled escrow funds are credited here. Withdrawals are separate from settlement.</p>
        </div>
        <div className="profile-collection glass-panel">
          <div className="profile-collection-heading">
            <div><span className="account-banner-eyebrow">Your activity</span><h3 id="profile-activity-heading">My Purchases</h3></div>
            <div className="profile-view-tabs">
              <button type="button" data-profile-table="listings">My Listings</button>
              <button type="button" data-profile-table="purchased">My Purchases</button>
              <button type="button" data-profile-table="sold">Sold History</button>
              <button type="button" data-profile-table="escrow">Escrow</button>
            </div>
          </div>
          <div id="profile-listings-grid" className="hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 p-5" />
          <div className="profile-table-wrap">
            <table className="profile-table">
              <thead><tr><th>Item</th><th>Item name</th><th id="profile-counterparty-heading">Seller</th><th>Date</th><th>Price (ETH)</th><th>View</th><th>Escrow</th></tr></thead>
              <tbody id="profile-activity-rows"><tr><td colSpan={7} className="profile-empty">Loading account activity…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function SellerProfile() {
  return (
    <section id="seller-profile-tab" className="min-h-screen p-8 hidden-section hidden">
      <div className="max-w-7xl mx-auto">
        <h2 id="seller-profile-heading" className="text-4xl sm:text-5xl font-bold mb-8 text-center" />
        <div id="seller-profile-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8" />
      </div>
    </section>
  );
}

export function AccountPages() {
  return (
    <>
      <UserProfile />
      <SellerProfile />
    </>
  );
}
