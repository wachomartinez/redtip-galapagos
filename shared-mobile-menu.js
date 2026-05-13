document.addEventListener('DOMContentLoaded', function() {
    const openBtn = document.querySelector('.menu-mobile-btn');
    const closeBtn = document.querySelector('.menu-mobile .close-btn');
    const mobileMenu = document.querySelector('.menu-mobile');

    function setMenuState(isOpen) {
        if (!mobileMenu) {
            return;
        }

        mobileMenu.classList.toggle('active', isOpen);
        document.body.classList.toggle('mobile-menu-open', isOpen);

        if (openBtn) {
            openBtn.setAttribute('aria-expanded', String(isOpen));
        }
    }

    if (openBtn && mobileMenu) {
        openBtn.setAttribute('aria-expanded', 'false');

        openBtn.addEventListener('click', function() {
            setMenuState(true);
        });
    }

    if (closeBtn && mobileMenu) {
        closeBtn.addEventListener('click', function() {
            setMenuState(false);
        });
    }

    if (mobileMenu) {
        document.addEventListener('click', function(e) {
            if (!mobileMenu.classList.contains('active')) {
                return;
            }

            if (mobileMenu.contains(e.target) || (openBtn && openBtn.contains(e.target))) {
                return;
            }

            setMenuState(false);
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                setMenuState(false);
            }
        });

        mobileMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                setMenuState(false);
            });
        });
    }

    function wireToggle(buttonSelector, menuSelector) {
        const button = document.querySelector(buttonSelector);
        const menu = document.querySelector(menuSelector);
        if (!button || !menu) {
            return;
        }

        button.setAttribute('aria-expanded', 'false');

        button.addEventListener('click', function(e) {
            e.preventDefault();

            const isOpen = menu.classList.toggle('is-open');
            menu.style.display = isOpen ? 'flex' : 'none';
            button.classList.toggle('is-open', isOpen);
            button.setAttribute('aria-expanded', String(isOpen));
        });
    }

    wireToggle('.menu-mobile .submenu-toggle', '.menu-mobile .submenu-mobile');
    wireToggle('.menu-mobile .submenu-toggle-snorkel', '.menu-mobile .submenu-mobile-snorkel');
    wireToggle('.menu-mobile .submenu-toggle-blog', '.menu-mobile .submenu-mobile-blog');
});