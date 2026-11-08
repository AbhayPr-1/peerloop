export function Cart() {
  return (
    <section id="cart-tab" className="min-h-screen p-8 hidden-section hidden">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="account-banner-eyebrow">Decentralized Checkout</span>
          <h2 className="text-4xl sm:text-5xl font-bold mt-1 text-center">SHOPPING BAG</h2>
        </div>
        <div id="cart-items-container" className="space-y-4 mb-8" />
        <div id="checkout-results" className="space-y-2 mb-6" aria-live="polite" />
        <div id="cart-summary" className="glass-panel rounded-2xl p-8 card-neon-border hidden">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-700/50">
            <div>
              <span className="text-sm text-gray-400 block">Total Investment</span>
              <span className="text-2xl font-bold text-neon-blue">Order Total:</span>
            </div>
            <span id="cart-total" className="text-3xl font-bold text-neon-pink">0 ETH</span>
          </div>
          <div className="flex items-center gap-2 mb-6 text-xs text-gray-400 bg-gray-700/20 p-3 rounded-xl">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span>All purchases are secured by PeerLoop smart contract escrow. Funds are only released upon your confirmation.</span>
          </div>
          <button id="checkout-btn" className="w-full modern-button text-lg py-3.5">Proceed to Escrow Checkout</button>
        </div>
      </div>
    </section>
  );
}
