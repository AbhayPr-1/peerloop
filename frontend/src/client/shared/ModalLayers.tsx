export function ModalLayers() {
  return (
    <>
      <div id="auth-modal" className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center hidden z-50 transition-opacity duration-200">
        <div className="auth-modal-content rounded-3xl p-8 w-11/12 max-w-md transform transition-all duration-200 scale-95 opacity-0 modal-content relative shadow-2xl">
          <button id="close-modal-btn" className="absolute top-4 right-4 text-gray-400 hover:text-rose-400 text-3xl transition-colors" aria-label="Close modal">&times;</button>
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-700/30 flex items-center justify-center text-neon-blue">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          </div>
          <h2 id="auth-title" className="text-3xl font-bold mb-2 text-center text-neon-blue">Connect Wallet</h2>
          <p className="text-center text-gray-300 text-sm mb-6 leading-relaxed">Connect your web3 wallet to list gears, manage escrow, and purchase on Sepolia network.</p>
          <button id="metamask-login-btn" className="w-full modern-button text-base py-3.5 flex items-center justify-center gap-2">
            <span>Connect Wallet</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      <div id="quick-view-modal" className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center hidden z-50 transition-opacity duration-200">
        <div id="quick-view-content" className="auth-modal-content rounded-3xl p-8 w-11/12 max-w-3xl transform transition-all duration-200 scale-95 opacity-0 modal-content relative shadow-2xl" />
      </div>
      <div id="confirmation-modal" className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center hidden z-50 transition-opacity duration-200">
        <div className="auth-modal-content rounded-3xl p-8 w-11/12 max-w-md transform transition-all duration-200 scale-95 opacity-0 modal-content relative shadow-2xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-center text-neon-blue">Confirm Action</h2>
          <p id="confirmation-message" className="text-center text-gray-300 text-sm mb-6 leading-relaxed">Are you sure?</p>
          <div className="flex justify-center gap-3">
            <button id="confirm-cancel-btn" className="modern-button-secondary px-6 py-2.5 text-sm">Cancel</button>
            <button id="confirm-action-btn" className="modern-button px-6 py-2.5 text-sm">Confirm</button>
          </div>
        </div>
      </div>
      <div id="message-box" className="fixed bottom-6 right-6 z-50 max-w-md px-5 py-3.5 rounded-2xl glass-panel shadow-2xl border border-glass-border hidden pointer-events-auto backdrop-blur-xl transition-all" />
    </>
  );
}
