document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const navbar = document.querySelector('.navbar');
    const brandToggle = document.getElementById('navbar-brand-toggle');
    const menuToggle = document.getElementById('menu-toggle');
    const navList = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-links a');
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleIcon = themeToggle?.querySelector('.theme-toggle-icon');
    const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const desktopMedia = window.matchMedia('(min-width: 921px)');
    const heroSection = document.querySelector('.hero-section');
    const themeKey = 'brandfounder-theme';
    const darkSourceMedia = '(prefers-color-scheme: dark)';
    let lastScrollY = window.scrollY;
    let forceExpanded = false;

    const moonIcon = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 15.2A8.6 8.6 0 1 1 12.8 4a6.9 6.9 0 0 0 7.2 11.2Z"></path>
        </svg>
    `;

    const sunIcon = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4.2"></circle>
            <path d="M12 2.5v2.2"></path>
            <path d="M12 19.3v2.2"></path>
            <path d="m4.9 4.9 1.6 1.6"></path>
            <path d="m17.5 17.5 1.6 1.6"></path>
            <path d="M2.5 12h2.2"></path>
            <path d="M19.3 12h2.2"></path>
            <path d="m4.9 19.1 1.6-1.6"></path>
            <path d="m17.5 6.5 1.6-1.6"></path>
        </svg>
    `;

    function getStoredTheme() {
        try {
            const storedTheme = window.localStorage.getItem(themeKey);
            return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
        } catch (error) {
            console.warn('Theme preference unavailable.', error);
            return null;
        }
    }

    function setStoredTheme(theme) {
        try {
            if (theme === 'light' || theme === 'dark') {
                window.localStorage.setItem(themeKey, theme);
            } else {
                window.localStorage.removeItem(themeKey);
            }
        } catch (error) {
            console.warn('Theme preference unavailable.', error);
        }
    }

    function getActiveTheme() {
        return getStoredTheme() || (darkModeMedia.matches ? 'dark' : 'light');
    }

    function syncThemeMedia(activeTheme, hasManualOverride) {
        document.querySelectorAll('source[data-theme-dark-source]').forEach(source => {
            source.media = hasManualOverride
                ? activeTheme === 'dark' ? 'all' : 'not all'
                : darkSourceMedia;
        });
    }

    function syncThemeToggle(activeTheme, hasManualOverride) {
        if (!themeToggle || !themeToggleIcon) return;

        const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';

        themeToggle.dataset.theme = activeTheme;
        themeToggle.dataset.mode = hasManualOverride ? 'manual' : 'system';
        themeToggle.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
        themeToggle.setAttribute('title', `Switch to ${nextTheme} mode`);
        themeToggle.setAttribute('aria-pressed', hasManualOverride ? 'true' : 'false');
        themeToggleIcon.innerHTML = nextTheme === 'dark' ? moonIcon : sunIcon;
    }

    function applyTheme() {
        const storedTheme = getStoredTheme();
        const activeTheme = storedTheme || (darkModeMedia.matches ? 'dark' : 'light');
        root.dataset.theme = activeTheme;

        syncThemeMedia(activeTheme, Boolean(storedTheme));
        syncThemeToggle(activeTheme, Boolean(storedTheme));
    }

    function closeMenu() {
        if (!navList || !navList.classList.contains('show')) return;

        navList.classList.remove('show');
        navList.classList.add('closing');

        window.setTimeout(() => {
            navList.classList.remove('closing');
        }, 200);

        navbar?.classList.remove('nav-open');
        root.classList.remove('nav-locked');
        menuToggle?.classList.remove('open');
        menuToggle?.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
        if (!navList || navList.classList.contains('show')) return;
        navList.classList.remove('closing');
        navList.classList.add('show');
        navbar?.classList.add('nav-open');
        root.classList.add('nav-locked');
        menuToggle?.classList.add('open');
        menuToggle?.setAttribute('aria-expanded', 'true');
    }

    function syncBrandToggle() {
        if (!brandToggle || !navbar) return;

        const desktopExpanded = desktopMedia.matches && !navbar.classList.contains('is-scrolled');
        const mobileExpanded = !desktopMedia.matches && Boolean(navList?.classList.contains('show'));
        const isExpanded = desktopMedia.matches ? desktopExpanded : mobileExpanded;

        brandToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        brandToggle.setAttribute('aria-label', isExpanded ? 'Navigation open' : 'Open navigation');
    }

    function updateHeroState() {
        if (!navbar) return;

        if (!heroSection) {
            navbar.classList.add('is-below-hero');
            navbar.classList.remove('is-over-hero');
            return;
        }

        const heroBottom = heroSection.getBoundingClientRect().bottom;
        const navbarHeight = navbar.getBoundingClientRect().height || 0;
        // the homepage hero sticks while it closes into a card; it flags
        // when the page already shows behind the navbar (site.js)
        const isOverHero = heroBottom > navbarHeight + 8 && !heroSection.classList.contains('is-condensed');

        navbar.classList.toggle('is-over-hero', isOverHero);
        navbar.classList.toggle('is-below-hero', !isOverHero);
    }

    function updateNavbarState() {
        if (!navbar) return;

        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;
        const scrollingDown = delta > 1;
        const scrollingUp = delta < -1;

        if (desktopMedia.matches) {
            if (currentScrollY <= 4) {
                forceExpanded = false;
                navbar.classList.remove('is-scrolled');
            } else {
                if (scrollingDown) {
                    forceExpanded = false;
                    navbar.classList.add('is-scrolled');
                } else if (scrollingUp || forceExpanded) {
                    navbar.classList.remove('is-scrolled');
                }
            }
        } else {
            forceExpanded = false;
            navbar.classList.remove('is-scrolled');
        }

        lastScrollY = currentScrollY;
        navbar.classList.toggle('has-scrim', currentScrollY > 8);
        updateHeroState();
        syncBrandToggle();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', event => {
            const href = link.getAttribute('href');

            if (href && href.startsWith('#')) {
                event.preventDefault();
                // unlock the page before scrolling, or the mobile menu's
                // scroll lock eats the first part of the jump
                closeMenu();
                const target = document.querySelector(href);
                if (target) {
                    if (typeof window.BrandFounderScrollToTarget === 'function') {
                        window.BrandFounderScrollToTarget(target, href, 'smooth');
                    } else {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        history.replaceState(null, '', href);
                    }
                }
            }

            closeMenu();
            syncBrandToggle();
        });
    });

    if (menuToggle && navList) {
        menuToggle.addEventListener('click', event => {
            event.stopPropagation();

            if (!navList.classList.contains('show')) {
                openMenu();
                syncBrandToggle();
                return;
            }

            closeMenu();
            syncBrandToggle();
        });

        document.addEventListener('click', event => {
            const clickInsideMenu = navList.contains(event.target);
            const clickOnToggle = menuToggle.contains(event.target);
            const clickOnBrand = brandToggle?.contains(event.target);

            if (!clickInsideMenu && !clickOnToggle && !clickOnBrand) {
                closeMenu();
                syncBrandToggle();
            }
        });
    }

    if (brandToggle) {
        brandToggle.addEventListener('click', event => {
            event.preventDefault();

            if (desktopMedia.matches) {
                forceExpanded = true;
                navbar?.classList.remove('is-scrolled');
                syncBrandToggle();
                return;
            }

            openMenu();
            syncBrandToggle();
        });
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeMenu();
            syncBrandToggle();
        }
    });

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const nextTheme = getActiveTheme() === 'dark' ? 'light' : 'dark';
            setStoredTheme(nextTheme);
            applyTheme();
        });
    }

    if (typeof darkModeMedia.addEventListener === 'function') {
        darkModeMedia.addEventListener('change', () => {
            if (!getStoredTheme()) {
                applyTheme();
            }
        });
    }

    if (typeof desktopMedia.addEventListener === 'function') {
        desktopMedia.addEventListener('change', event => {
            if (event.matches) {
                closeMenu();
            }
            lastScrollY = window.scrollY;
            updateNavbarState();
        });
    }

    window.addEventListener('scroll', updateNavbarState, { passive: true });
    window.addEventListener('resize', updateNavbarState, { passive: true });
    window.addEventListener('hero:state', updateHeroState);
    updateNavbarState();
    applyTheme();
});
