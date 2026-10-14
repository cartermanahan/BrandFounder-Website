(() => {
    'use strict';

    const form = document.getElementById('contact-form');
    const status = document.getElementById('contact-status');
    const draftLink = document.getElementById('contact-draft-link');
    if (!form || !status || !draftLink) return;

    form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        const name = String(data.get('name') || '').trim();
        const email = String(data.get('email') || '').trim();
        const message = String(data.get('message') || '').trim();

        // Native validation handles missing or invalid fields. Also reject whitespace-only input.
        for (const [id, value] of [['contact-name', name], ['contact-message', message]]) {
            const field = document.getElementById(id);
            field.setCustomValidity(value ? '' : 'Please fill in this field.');
        }
        if (!form.reportValidity()) return;

        const subject = `BrandFounder — ${data.get('topic') || 'General'}`;
        const body = `${message}\r\n\r\nFrom: ${name}\r\nReply to: ${email}`;
        const draft = `mailto:support@brandfounder.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        draftLink.href = draft;
        status.hidden = false;
        // Opening a draft is a handoff to the visitor's email app, not a sent-message confirmation.
        window.location.href = draft;
    });

    form.addEventListener('input', event => {
        if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
        status.hidden = true;
    });
})();
