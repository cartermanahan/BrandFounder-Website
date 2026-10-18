(() => {
    'use strict';

    // There's no mail server behind the site, so Send hands the message
    // to the visitor's own mail app, addressed and ready to go.
    const form = document.getElementById('contact-form');
    if (!form) return;
    const field = form.querySelector('textarea');
    const address = 'support@brandfounder.ai';

    form.addEventListener('submit', event => {
        event.preventDefault();
        const message = field.value.trim();
        if (!message) {
            field.focus();
            return;
        }
        const subject = encodeURIComponent('Hello from brandfounder.ai');
        window.location.href = `mailto:${address}?subject=${subject}&body=${encodeURIComponent(message)}`;
    });
})();
