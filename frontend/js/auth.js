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
        return showMessage('No browser wallet detected!');
    }
    
    setButtonLoading(buttonElement, true, 'Connecting...');
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const walletAddress = await signer.getAddress();

        if (!walletAddress) {
            throw new Error("Could not get wallet address.");
        }

        const response = await fetch(`${API_URL}/api/auth/metamask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'Login failed');
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.name);
        currentUser = { 
          id: data.user.id, 
          name: data.user.name, 
          walletAddress: data.user.walletAddress 
        };
        
        showMessage('Wallet connected successfully!');
        closeAuthModal();
        
        // *** UPDATED: Connect the contract to the signer ***
        await connectContractToSigner(signer); 
        
        renderUI(); // Render UI after contract is connected
        await fetchCart();
        await fetchProducts(); // Fetch products again
        
    } catch (error) {
        showMessage(error.message);
    } finally {
        setButtonLoading(buttonElement, false);
    }
}