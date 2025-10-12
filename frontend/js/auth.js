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
    // Clear any previous error messages when toggling
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}


async function handleLogin(identifier, password, buttonElement) {
  setButtonLoading(buttonElement, true, 'Logging in...');
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
  } finally {
    setButtonLoading(buttonElement, false);
  }
}

async function handleSignup(name, email, password, buttonElement) {
    // Clear previous errors
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    setButtonLoading(buttonElement, true, 'Signing up...');
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            // Handle inline validation errors
            if (data.errors) {
                data.errors.forEach(err => {
                    const errorEl = document.getElementById(`signup-${err.path}-error`);
                    if (errorEl) errorEl.textContent = err.msg;
                });
            }
            const generalError = data.errors ? 'Please correct the errors above.' : data.msg;
            throw new Error(generalError || 'Signup failed');
        }
        await handleLogin(email, password, buttonElement);
    } catch (error) {
        showMessage(error.message);
    } finally {
        setButtonLoading(buttonElement, false);
    }
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
        fetchCart();
        filterAndSortProducts();
    } catch (error) {
        showMessage(error.message);
    } finally {
        setButtonLoading(buttonElement, false);
    }
}