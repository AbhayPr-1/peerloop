// frontend/js/custom-select.js
function initializeCustomSelect(containerId, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const button = container.querySelector('.custom-select-btn');
    const optionsContainer = container.querySelector('.dropdown-menu');
    const options = optionsContainer.querySelectorAll('a');
    const displaySpan = button.querySelector('span');

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = containerId;
    hiddenInput.value = options.length > 0 ? options[0].dataset.value : '';
    container.appendChild(hiddenInput);

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            if (menu !== optionsContainer) {
                menu.classList.add('hidden');
            }
        });
        optionsContainer.classList.toggle('hidden');
    });

    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            hiddenInput.value = option.dataset.value;
            displaySpan.textContent = option.textContent;
            optionsContainer.classList.add('hidden');

            // Add/Remove active class for visual feedback
            if (hiddenInput.value !== 'all' && containerId === 'category-filter') {
                button.classList.add('active-filter');
            } else {
                button.classList.remove('active-filter');
            }

            if (onChangeCallback) {
                onChangeCallback(hiddenInput.value);
            }
        });
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
});