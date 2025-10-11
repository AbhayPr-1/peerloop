// frontend/js/custom-select.js
function initializeCustomSelect(containerId, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const button = container.querySelector('.custom-select-btn');
    const optionsContainer = container.querySelector('.dropdown-menu'); // Updated class name
    const options = optionsContainer.querySelectorAll('a');
    const displaySpan = button.querySelector('span');

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = containerId;
    hiddenInput.value = options.length > 0 ? options[0].dataset.value : '';
    container.appendChild(hiddenInput);

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other open dropdowns first
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            if (menu !== optionsContainer) {
                menu.classList.add('hidden');
            }
        });
        // Then toggle the current one
        optionsContainer.classList.toggle('hidden');
    });

    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            hiddenInput.value = option.dataset.value;
            displaySpan.textContent = option.textContent;
            optionsContainer.classList.add('hidden');

            if (onChangeCallback) {
                onChangeCallback(hiddenInput.value);
            }
        });
    });
}

// Global listener to close all dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
});