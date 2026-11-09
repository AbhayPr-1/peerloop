function UserProfile() {
  return (
    <section id="user-profile-tab" className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 hidden-section hidden">
      <div className="max-w-7xl mx-auto profile-dashboard">
        {/* Cover & Identity Banner */}
        <div className="profile-cover glass-panel">
          <div className="profile-identity">
            <div id="profile-avatar" className="profile-avatar font-mono">P</div>
            <div>
              <span className="account-banner-eyebrow">YOUR PEERLOOP ACCOUNT</span>
              <h2 id="profile-display-name">Your Dashboard</h2>
            </div>
          </div>
          <div className="profile-network">
            <span className="network-dot pulse" />
            <span className="font-mono">Sepolia Escrow Protocol</span>
          </div>
        </div>

        {/* Statistics Cards */}
        <div id="profile-stats" className="profile-stats">
          <article className="profile-stat-card">
            <span>Total Value Owned</span>
            <strong id="profile-owned-value">—</strong>
            <small>Active holdings from on-chain history</small>
          </article>
          <article className="profile-stat-card">
            <span>Active Listings</span>
            <strong id="profile-listing-count">—</strong>
            <small>Your gears currently on marketplace</small>
          </article>
          <article className="profile-stat-card">
            <span>Items Sold</span>
            <strong id="profile-sold-count">—</strong>
            <small>Settled on-chain transactions</small>
          </article>
        </div>

        {/* Claimable Escrow Payouts */}
        <div id="profile-claimable-payments" className="profile-collection glass-panel hidden">
          <div className="profile-collection-heading profile-payout-heading">
            <div>
              <span className="account-banner-eyebrow text-neon-pink">SETTLED ESCROW FUNDS</span>
              <h3 className="text-xl font-bold">Available to Withdraw</h3>
            </div>
            <strong id="profile-claimable-balance">0 ETH</strong>
            <button id="profile-withdraw-payments-btn" type="button" className="modern-button text-sm py-2 px-6">
              <span>Withdraw to Wallet</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="profile-payout-description text-sm text-gray-400 mt-2">
            Settled escrow funds from completed sales are credited to your claimable balance on the
            Peerloop smart contract. Withdraw anytime directly to your connected wallet.
          </p>
        </div>

        {/* Activity & History View */}
        <div className="profile-collection glass-panel">
          <div className="profile-collection-heading">
            <div>
              <span className="account-banner-eyebrow">PORTFOLIO ACTIVITY</span>
              <h3 id="profile-activity-heading">My Purchases</h3>
            </div>
            <div className="profile-view-tabs">
              <button type="button" data-profile-table="listings">My Listings</button>
              <button type="button" data-profile-table="purchased">My Purchases</button>
              <button type="button" data-profile-table="sold">Sold History</button>
              <button type="button" data-profile-table="escrow">Escrow Dashboard</button>
            </div>
          </div>

          {/* Listings Card Grid (shown when view === 'listings') */}
          <div id="profile-listings-grid" className="hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4" />

          {/* Activity Table (shown for purchased, sold, escrow) */}
          <div className="profile-table-wrap">
            <table className="profile-table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Item Title</th>
                  <th id="profile-counterparty-heading">Counterparty</th>
                  <th>Timestamp</th>
                  <th>Price</th>
                  <th>Inspect</th>
                  <th>Escrow Lifecycle</th>
                </tr>
              </thead>
              <tbody id="profile-activity-rows">
                <tr>
                  <td colSpan={7} className="profile-empty">
                    Loading blockchain activity…
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function SellerProfile() {
  return (
    <section id="seller-profile-tab" className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 hidden-section hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center sm:text-left">
          <span className="account-banner-eyebrow">SELLER PROFILE</span>
          <h2 id="seller-profile-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1" />
        </div>
        <div id="seller-profile-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" />
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
