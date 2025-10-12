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

function toggleAuthForm() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('signup-form').classList.toggle('hidden');
    const title = document.getElementById('auth-title');
    const toggleBtn = document.getElementById('toggle-form-btn');
    if (title.textContent === 'Login') {
        title.textContent = 'Sign Up';
        toggleBtn.textContent = 'Already have an account? Login';
    } else {
        title.textContent = 'Login';
        toggleBtn.textContent = 'Don\'t have an account? Sign up';
    }
}

async function handleLogin(identifier, password) {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Login failed');

    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.name);
    currentUser = data.user;

    showMessage('Login successful!');
    closeAuthModal();
    renderUI();
    fetchCart();
    filterAndSortProducts();
  } catch (error) {
    showMessage(error.message);
  }
}

async function handleSignup(name, email, password) {
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.errors ? data.errors[0].msg : data.msg;
            throw new Error(errorMsg || 'Signup failed');
        }
        await handleLogin(email, password);
    } catch (error) {
        showMessage(error.message);
    }
}

async function handleMetaMaskLogin() {
    if (typeof window.ethereum === 'undefined') {
        return showMessage('MetaMask is not installed!');
    }
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
        fetchCart();
        filterAndSortProducts();
    } catch (error) {
        showMessage(error.message);
    }
}