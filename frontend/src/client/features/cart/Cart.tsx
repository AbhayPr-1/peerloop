export function Cart() {
  return (
    <section id="cart-tab" className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 hidden-section hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-semibold text-emerald-400 mb-2">
            <span className="network-dot pulse" />
            <span>DECENTRALIZED CHECKOUT</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">SHOPPING BAG</h2>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-xl mx-auto leading-relaxed">
            Review your selected listings. Each purchase creates an on-chain escrow with buyer-controlled
            release, refund, and dispute actions.
          </p>
        </div>

        {/* Cart Items Container */}
        <div id="cart-items-container" className="space-y-4 mb-8" />

        {/* Live Announcements / Checkout Results */}
        <div id="checkout-results" className="space-y-2 mb-6" aria-live="polite" />

        {/* Cart Summary */}
        <div id="cart-summary" className="glass-panel rounded-2xl p-6 sm:p-8 card-neon-border hidden">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-700/50 flex-wrap gap-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400 block mb-1">Total Investment</span>
              <span className="text-xl sm:text-2xl font-bold text-neon-blue">Order Total:</span>
            </div>
            <span id="cart-total" className="text-2xl sm:text-3xl font-extrabold text-neon-pink font-mono">0 ETH</span>
          </div>

          <div className="flex items-start gap-3 mb-6 text-xs text-gray-400 bg-gray-700/20 p-4 rounded-xl border border-gray-600/30">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <strong className="text-gray-200 block mb-0.5">Payment handled by the marketplace contract</strong>
              <span>After purchase, the buyer can release or refund an active escrow, or open a dispute. Check the connected network and transaction details before signing.</span>
            </div>
          </div>

          <button id="checkout-btn" className="w-full modern-button text-lg py-4">
            <span>Proceed to Escrow Checkout</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </section>
  );
}
