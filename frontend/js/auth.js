// frontend/js/auth.js
function showAuthModal() {
  const modal = document.getElementById('auth-modal');
  const content = modal.querySelector('.modal-content');
  modal.classList.remove('hidden');
  setTimeout(() => {
    content.classList.remove('scale-95', 'opacity-0');
  }, 10);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  const content = modal.querySelector('.modal-content');
  content.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

async function handleMetaMaskLogin(buttonElement) {
    if (typeof window.ethereum === 'undefined') {
        return showMessage('MetaMask is not installed!');
    }
    setButtonLoading(buttonElement, true, 'Connecting...');
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const walletAddress = accounts[0];

        const response = await fetch(`${API_URL}/api/auth/metamask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'MetaMask login failed');
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.name);
        currentUser = data.user;
        
        showMessage('Logged in with MetaMask!');
        closeAuthModal();
        renderUI();
        await fetchCart();
        filterAndSortProducts();
    } catch (error) {
        showMessage(error.message);
    } finally {
        setButtonLoading(buttonElement, false);
    }
}