function initializeCustomSelect(containerId, onChangeCallback = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const button = container.querySelector('.custom-select-btn');
    const optionsContainer = container.querySelector('.dropdown-menu');
    if (!button || !optionsContainer) return;
    const options = Array.from(optionsContainer.querySelectorAll('button[data-value]') as NodeListOf<HTMLButtonElement>);
    if (options.length === 0) return;
    const displaySpan = button.querySelector('span');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = containerId;
    hiddenInput.value = options[0].dataset.value || '';
    container.appendChild(hiddenInput);
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        document.querySelectorAll('.dropdown-menu').forEach((menu) => {
            if (menu !== optionsContainer) {
                menu.classList.add('hidden');
                menu.closest('.relative')?.querySelector('.custom-select-btn')?.setAttribute('aria-expanded', 'false');
            }
        });
        const opening = optionsContainer.classList.contains('hidden');
        optionsContainer.classList.toggle('hidden', !opening);
        button.setAttribute('aria-expanded', String(opening));
        if (opening) {
            const bounds = button.getBoundingClientRect();
            const availableBelow = window.innerHeight - bounds.bottom - 12;
            const menuHeight = Math.min(optionsContainer.scrollHeight, 280);
            optionsContainer.classList.toggle('open-up', availableBelow < menuHeight && bounds.top > menuHeight + 12);
            const selected = options.find((option) => option.getAttribute('aria-checked') === 'true');
            (selected || options[0]).focus();
        } else {
            optionsContainer.classList.remove('open-up');
        }
    });
    options.forEach((option, index) => {
        option.addEventListener('click', () => {
            hiddenInput.value = option.dataset.value || '';
            if (displaySpan) displaySpan.textContent = option.textContent || '';
            options.forEach((item) => item.setAttribute('aria-checked', String(item === option)));
            optionsContainer.classList.add('hidden');
            optionsContainer.classList.remove('open-up');
            button.setAttribute('aria-expanded', 'false');
            if (containerId === 'category-filter' && hiddenInput.value !== 'all') {
                button.classList.add('active-filter');
            } else {
                button.classList.remove('active-filter');
            }
            button.focus();
            if (onChangeCallback) onChangeCallback(hiddenInput.value);
        });
        option.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                optionsContainer.classList.add('hidden');
                optionsContainer.classList.remove('open-up');
                button.setAttribute('aria-expanded', 'false');
                button.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const offset = event.key === 'ArrowDown' ? 1 : -1;
                options[(index + offset + options.length) % options.length].focus();
            } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                options[event.key === 'Home' ? 0 : options.length - 1].focus();
            }
        });
    });
}
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
        menu.classList.add('hidden');
        menu.classList.remove('open-up');
        menu.closest('.relative')?.querySelector('.custom-select-btn')?.setAttribute('aria-expanded', 'false');
    });
});