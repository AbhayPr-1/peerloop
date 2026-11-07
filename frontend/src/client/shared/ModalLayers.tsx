export function ModalLayers() {
  return (
    <>
      <div id="auth-modal" className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden z-50">
        <div className="auth-modal-content rounded-3xl p-8 w-11/12 max-w-md transform transition-all duration-500 scale-95 opacity-0 modal-content">
          <button id="close-modal-btn" className="absolute top-4 right-4 text-neon-pink hover:text-red-500 text-4xl">&times;</button>
          <h2 id="auth-title" className="text-3xl font-bold mb-6 text-center text-neon-blue">Login</h2>
          <p className="text-center text-gray-300 mb-8">Please connect your wallet to log in or create an account.</p>
          <button id="metamask-login-btn" className="w-full modern-button text-lg mt-4">Login with Wallet</button>
        </div>
      </div>
      <div id="quick-view-modal" className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden z-50">
        <div id="quick-view-content" className="auth-modal-content rounded-3xl p-8 w-11/12 max-w-3xl transform transition-all duration-500 scale-95 opacity-0 modal-content relative" />
      </div>
      <div id="confirmation-modal" className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden z-50">
        <div className="auth-modal-content rounded-3xl p-8 w-11/12 max-w-md transform transition-all duration-500 scale-95 opacity-0 modal-content">
          <h2 className="text-3xl font-bold mb-4 text-center text-neon-blue">Confirm Action</h2>
          <p id="confirmation-message" className="text-center text-gray-300 mb-8">Are you sure?</p>
          <div className="flex justify-center gap-4">
            <button id="confirm-cancel-btn" className="modern-button-secondary">Cancel</button>
            <button id="confirm-action-btn" className="modern-button">Confirm</button>
          </div>
        </div>
      </div>
      <div id="message-box" className="fixed bottom-8 right-8 bg-gray-800 text-white p-4 rounded-xl shadow-xl hidden z-50" />
    </>
  );
}
