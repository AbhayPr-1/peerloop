async function handleLogin(identifier, password) {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Invalid credentials');
    
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.name);
    currentUser = data.user;

    await fetchCart();

    closeAuthModal();
    renderUI();
    showMessage(`Welcome back, ${currentUser.name}`);
    showSection("marketplace");
    
    await fetchProducts(); // Re-fetch products to update the view with buy buttons

  } catch (error) { 
    showMessage(`Login Failed: ${error.message}`); 
  }
}

async function handleSignup(name, email, password) {
   try {
    
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'An error occurred');

    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.name);
    currentUser = data.user;

    await fetchCart();

    closeAuthModal();
    renderUI();
    showMessage(`Registration Complete, ${currentUser.name}`);
    showSection("marketplace");
    
    await fetchProducts(); // Re-fetch products to update the view with buy buttons

  } catch (error) { 
    showMessage(`Registration Failed: ${error.message}`); 
  }
}

async function handleMetaMaskLogin() {
  if (typeof window.ethereum === "undefined") return showMessage("MetaMask is not installed.");

  try {
    showLoadingMessage("🦊 Opening MetaMask…");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    hideLoadingMessage();

    if (!accounts || accounts.length === 0) return showMessage("No MetaMask account selected.");
    
    const walletAddress = accounts[0].toLowerCase();
    const response = await fetch(`${API_URL}/api/auth/metamask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Server error');

    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.name);
    currentUser = data.user;

    await fetchCart();

    closeAuthModal();
    renderUI();
    showMessage(`Welcome, ${currentUser.name}`);
    showSection("marketplace");

    await fetchProducts(); // Re-fetch products to update the view with buy buttons

  } catch (err) {
    hideLoadingMessage();
    showMessage(`MetaMask Login Failed: ${err.message}`);
  }
}

// --- The rest of the file (showAuthModal, closeAuthModal, toggleAuthForm) remains unchanged ---

function showAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.querySelector('.modal-content').classList.remove('opacity-0', 'scale-95');
    modal.querySelector('.modal-content').classList.add('opacity-100', 'scale-100');
  }, 10);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal.classList.contains('hidden')) return;

  modal.querySelector('.modal-content').classList.add('opacity-0', 'scale-95');
  modal.querySelector('.modal-content').classList.remove('opacity-100', 'scale-100');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

function toggleAuthForm() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authTitle = document.getElementById('auth-title');
  const toggleBtn = document.getElementById('toggle-form-btn');
  
  const isLoginVisible = !loginForm.classList.contains('hidden');
  loginForm.classList.toggle('hidden', isLoginVisible);
  signupForm.classList.toggle('hidden', !isLoginVisible);
  authTitle.textContent = isLoginVisible ? 'Sign Up' : 'Login';
  toggleBtn.textContent = isLoginVisible ? "Already have an account? Login" : "Don't have an account? Sign up";
}