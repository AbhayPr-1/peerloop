// frontend/js/custom-select.js
function initializeCustomSelect(containerId, onChangeCallback = null) {
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
            if (menu !== optionsContainer) menu.classList.add('hidden');
        });
        const opening = optionsContainer.classList.contains('hidden');
        optionsContainer.classList.toggle('hidden', !opening);
        button.setAttribute('aria-expanded', String(opening));
        if (opening) {
            const buttonBounds = button.getBoundingClientRect();
            const availableBelow = window.innerHeight - buttonBounds.bottom - 12;
            const menuHeight = Math.min(optionsContainer.scrollHeight, 280);
            const openUp = availableBelow < menuHeight && buttonBounds.top > menuHeight + 12;
            optionsContainer.classList.toggle('open-up', openUp);
        } else {
            optionsContainer.classList.remove('open-up');
        }
    });
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            hiddenInput.value = option.dataset.value;
            displaySpan.textContent = option.textContent;
            optionsContainer.classList.add('hidden');
            optionsContainer.classList.remove('open-up');
            button.setAttribute('aria-expanded', 'false');
            if (hiddenInput.value !== 'all' && containerId === 'category-filter') {
                button.classList.add('active-filter');
            } else {
                button.classList.remove('active-filter');
            }
            if (onChangeCallback) onChangeCallback(hiddenInput.value);
        });
    });
}
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
        menu.classList.remove('open-up');
        menu.closest('.relative')?.querySelector('.custom-select-btn')?.setAttribute('aria-expanded', 'false');
    });
});