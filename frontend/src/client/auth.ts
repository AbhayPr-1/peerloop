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
    setButtonLoading(buttonElement, true, 'Detecting wallet...');

    // Use robust detection so async-injected wallets (Rabby, Brave Wallet,
    // Phantom, Coinbase, and MetaMask in some setups) are found reliably.
    const detected = await window.WalletDetection.detectWalletProvider();
    const walletProvider = (detected && detected.provider) || window.ethereum;

    if (!walletProvider) {
        setButtonLoading(buttonElement, false);
        const msg = await window.WalletDetection.getNoWalletMessage();
        return showMessage(msg);
    }

    try {
        const provider = new ethers.providers.Web3Provider(walletProvider, "any");
        await provider.send("eth_requestAccounts", []);
        await ensureSepoliaNetwork(walletProvider);
        const signer = provider.getSigner();
        const walletAddress = await signer.getAddress();

        if (!walletAddress) {
            throw new Error("Could not get wallet address.");
        }

        const challenge = await window.PeerLoopApi.auth.createChallenge(walletAddress);

        const signature = await signer.signMessage(challenge.message);
        const data = await window.PeerLoopApi.auth.signIn(walletAddress, signature);
        
        currentUser = { 
          id: data.user.id, 
          name: data.user.name, 
          walletAddress: data.user.walletAddress 
        };
        
        showMessage('Wallet connected successfully!');
        closeAuthModal();
        
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
