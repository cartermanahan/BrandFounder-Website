/* =====================================================================
   site.js — BrandFounder
   IntersectionObserver for reveals and the demo; Web Animations for
   the FAQ. Scroll is only read for the hero transition and the
   parallax, once per frame. No third-party libraries.
   ===================================================================== */
(() => {
    'use strict';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hasIO = 'IntersectionObserver' in window;

    /* -----------------------------------------------------------
       Reveal on appear
       ----------------------------------------------------------- */
    function initReveals() {
        const items = document.querySelectorAll('[data-r], [data-r-group]');
        if (!items.length) return;

        document.querySelectorAll('[data-r-group]').forEach(group => {
            [...group.children].forEach((child, i) => child.style.setProperty('--i', String(i)));
        });

        if (reduced.matches || !hasIO) {
            items.forEach(el => el.classList.add('is-in'));
            return;
        }

        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

        items.forEach(el => {
            const d = el.getAttribute('data-r-d');
            if (d) el.style.setProperty('--rd', d);
            io.observe(el);
        });

        // The hero is above the fold by definition — play it on load.
        window.requestAnimationFrame(() => {
            document.querySelectorAll('.hero [data-r]').forEach(el => {
                el.classList.add('is-in');
                io.unobserve(el);
            });
        });
    }

    /* -----------------------------------------------------------
       "How it works" — the idea types itself in, then the brand
       builds around it. Without JS (or with reduced motion) the
       built state is simply shown.
       ----------------------------------------------------------- */
    function initDemo() {
        const demo = document.querySelector('[data-demo]');
        if (!demo) return;

        const box = demo.querySelector('.tbox');
        const field = demo.querySelector('.tbox-text');
        const source = demo.querySelector('[data-full]');
        if (!box || !field || !source) return;

        const full = source.textContent.trim();

        if (reduced.matches || !hasIO) {
            field.textContent = full;
            demo.classList.add('is-built');
            return;
        }

        demo.classList.add('is-armed');
        field.textContent = '';

        const CPS = 46;

        function type() {
            box.classList.add('is-typing');
            let start = 0;

            const step = (now) => {
                if (!start) start = now;
                const n = Math.min(full.length, Math.round(((now - start) / 1000) * CPS));
                field.textContent = full.slice(0, n);
                if (n < full.length) {
                    window.requestAnimationFrame(step);
                    return;
                }
                window.setTimeout(() => {
                    box.classList.remove('is-typing');
                    demo.classList.add('is-built');
                }, 280);
            };
            window.requestAnimationFrame(step);
        }

        const io = new IntersectionObserver((entries) => {
            if (!entries.some(e => e.isIntersecting)) return;
            io.disconnect();
            window.setTimeout(type, 220);
        }, { rootMargin: '0px 0px -18% 0px', threshold: 0.2 });
        io.observe(demo);

        // idle the floating chips while the section is off-screen
        const idle = new IntersectionObserver((entries) => {
            for (const entry of entries) entry.target.toggleAttribute('data-paused', !entry.isIntersecting);
        }, { rootMargin: '120px 0px' });
        idle.observe(demo);
    }

    /* -----------------------------------------------------------
       Tabs — shared by the example switcher and the pack tabs.
       Panels stay in the DOM (stacked in one grid cell) so the
       switch can cross-fade; inactive ones are inert.
       ----------------------------------------------------------- */
    function makeTabs(tablist, tabs, panels, onChange) {
        let index = Math.max(0, tabs.findIndex(t => t.classList.contains('is-active')));
        const leaveTimers = new WeakMap();

        panels.forEach((panel, i) => {
            panel.hidden = false;
            panel.inert = i !== index;
        });

        function centreTab(tab) {
            if (tablist.scrollWidth <= tablist.clientWidth + 1) return;
            const left = tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2;
            tablist.scrollTo({ left, behavior: reduced.matches ? 'auto' : 'smooth' });
        }

        function select(next, opts = {}) {
            if (next === index || next < 0 || next >= tabs.length) return;
            const prevPanel = panels[index];

            tabs[index].classList.remove('is-active');
            tabs[index].setAttribute('aria-selected', 'false');
            tabs[index].tabIndex = -1;
            prevPanel.classList.remove('is-active');
            prevPanel.classList.add('is-leaving');
            prevPanel.inert = true;
            window.clearTimeout(leaveTimers.get(prevPanel));
            leaveTimers.set(prevPanel, window.setTimeout(() => prevPanel.classList.remove('is-leaving'), 650));

            index = next;
            const tab = tabs[index];
            const panel = panels[index];
            tab.classList.add('is-active');
            tab.setAttribute('aria-selected', 'true');
            tab.tabIndex = 0;
            panel.classList.remove('is-leaving');
            panel.classList.add('is-active');
            panel.inert = false;
            if (opts.focus) tab.focus();
            centreTab(tab);
            onChange && onChange(index, opts);
        }

        tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i, { user: true })));

        tablist.addEventListener('keydown', (event) => {
            const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
            if (!(event.key in keys)) return;
            event.preventDefault();
            const next = (keys[event.key] + tabs.length) % tabs.length;
            select(next, { user: true, focus: true });
        });

        return { select, get index() { return index; } };
    }

    /* -----------------------------------------------------------
       Examples: a looping carousel. The centred card is in focus and
       its neighbours peek either side. Every slide gets an offset from
       the active one, wrapped to -2..2, so the loop never runs out;
       a slide that wraps round the back jumps without animating while
       it's out of view. Autoplay is paced by the pill's progress bar.
       Below 900px it becomes a native swipe row instead: the cards
       scroll with the finger, and the chips and dots follow along.
       ----------------------------------------------------------- */
    function initExamples() {
        const root = document.querySelector('[data-ex]');
        if (!root) return;
        const tabs = [...root.querySelectorAll('[role="tab"]')];
        const slides = [...root.querySelectorAll('[data-ex-slide]')];
        const tablist = root.querySelector('[role="tablist"]');
        const viewport = root.querySelector('.ex-viewport');
        const n = slides.length;
        if (!n || tabs.length !== n) return;

        // swatch labels: white text, black on the near-white tones
        root.querySelectorAll('.ex-pal i').forEach((sw) => {
            const hex = (sw.style.getPropertyValue('--c') || '').trim();
            if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
            const lum = [1, 3, 5].map(k => {
                const c = parseInt(hex.slice(k, k + 2), 16) / 255;
                return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
            sw.classList.toggle('is-light', L > 0.58);
        });

        let index = 0;
        let offscreen = true;
        let hovering = false;
        const swipe = window.matchMedia('(max-width: 899px)');

        // dots under the swipe row (hidden by CSS on desktop)
        const dots = document.createElement('div');
        dots.className = 'ex-dots';
        dots.setAttribute('aria-hidden', 'true');
        slides.forEach(() => dots.appendChild(document.createElement('i')));
        if (viewport) viewport.after(dots);

        const wrap = (d) => {
            let o = ((d % n) + n) % n;
            if (o > n / 2) o -= n;
            return o;
        };

        // Every move is continuous: a slide slides by the step size (even
        // a jump of two), and only teleports while it is invisible, either
        // after leaving past the edge or before entering from beyond it.
        let settle = null;

        function place(slide, off, instant) {
            if (instant) slide.classList.add('no-anim');
            slide.style.setProperty('--off', String(off));
            slide.dataset.off = String(off);
            slide.classList.toggle('is-active', off === 0);
            slide.classList.toggle('is-near', Math.abs(off) === 1);
            slide.classList.toggle('is-far', Math.abs(off) > 1);
        }

        function flushSettle() {
            if (!settle) return;
            clearTimeout(settle.timer);
            settle.list.forEach(([slide, off]) => place(slide, off, true));
            void root.offsetWidth;
            settle.list.forEach(([slide]) => slide.classList.remove('no-anim'));
            settle = null;
        }

        function markTabs(first) {
            tabs.forEach((tab, i) => {
                const on = i === index;
                tab.classList.toggle('is-active', on);
                tab.setAttribute('aria-selected', on ? 'true' : 'false');
                tab.tabIndex = on ? 0 : -1;
            });
            [...dots.children].forEach((dot, i) => dot.classList.toggle('is-on', i === index));
            const tab = tabs[index];
            if (tablist && tablist.scrollWidth > tablist.clientWidth + 1) {
                tablist.scrollTo({ left: tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2, behavior: first || reduced.matches ? 'auto' : 'smooth' });
            }
        }

        function markSlides() {
            slides.forEach((slide, i) => {
                // in the swipe row every card is real content; in the
                // carousel the side cards stay clickable but out of the
                // tab order and the accessibility tree
                const on = swipe.matches || i === index;
                slide.setAttribute('aria-hidden', on ? 'false' : 'true');
                slide.querySelectorAll('a, button').forEach(el => { el.tabIndex = on ? 0 : -1; });
            });
        }

        function layout(first, step) {
            flushSettle();
            const later = [];
            const entering = [];
            slides.forEach((slide, i) => {
                const off = wrap(i - index);
                if (first) { place(slide, off, true); return; }
                const from = Number(slide.dataset.off);
                const path = from - step;
                if (path === off) return place(slide, off, false);
                if (Math.abs(off) <= 1) {
                    // comes in from beyond the far edge
                    place(slide, off + step, true);
                    entering.push([slide, off]);
                } else {
                    // leaves past the edge, then quietly wraps round
                    place(slide, path, false);
                    later.push([slide, off]);
                }
            });
            if (entering.length || first) {
                void root.offsetWidth;
                slides.forEach(slide => slide.classList.remove('no-anim'));
                entering.forEach(([slide, off]) => place(slide, off, false));
            }
            if (later.length) settle = { list: later, timer: setTimeout(flushSettle, 950) };

            markSlides();
            markTabs(first);
        }

        // swipe row: scroll a card to the centre; the scroll handler
        // below then updates the index
        function scrollToSlide(i, instant) {
            if (!viewport) return;
            const slide = slides[i];
            const left = slide.offsetLeft - (viewport.clientWidth - slide.offsetWidth) / 2;
            viewport.scrollTo({ left, behavior: instant || reduced.matches ? 'auto' : 'smooth' });
        }

        function go(next) {
            const target = ((next % n) + n) % n;
            if (swipe.matches) { scrollToSlide(target); return; }
            const step = wrap(target - index);
            if (!step) return;
            index = target;
            layout(false, step);
        }

        // slides stay clickable while inert content is skipped: a click on a
        // peeking card brings it to the centre
        slides.forEach((slide, i) => {
            slide.hidden = false;
            slide.addEventListener('click', () => { if (i !== index && !swipe.matches) go(i); });
        });
        tabs.forEach((tab, i) => tab.addEventListener('click', () => go(i)));
        if (tablist) {
            tablist.addEventListener('keydown', (event) => {
                const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: n - 1 };
                if (!(event.key in keys)) return;
                event.preventDefault();
                go(keys[event.key]);
                tabs[index].focus();
            });
        }

        // swipe on touch
        if (viewport) {
            let x0 = null;
            viewport.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && !swipe.matches) x0 = e.clientX; }, { passive: true });
            viewport.addEventListener('pointerup', (e) => {
                if (x0 === null) return;
                const dx = e.clientX - x0;
                x0 = null;
                if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            }, { passive: true });
            viewport.addEventListener('pointercancel', () => { x0 = null; }, { passive: true });
        }

        layout(true);

        // swipe row: the card nearest the centre is the active one
        if (viewport) {
            let raf = 0;
            viewport.addEventListener('scroll', () => {
                if (!swipe.matches || raf) return;
                raf = window.requestAnimationFrame(() => {
                    raf = 0;
                    const mid = viewport.scrollLeft + viewport.clientWidth / 2;
                    let best = 0;
                    let bestD = Infinity;
                    slides.forEach((slide, i) => {
                        const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid);
                        if (d < bestD) { bestD = d; best = i; }
                    });
                    if (best !== index) { index = best; markTabs(false); }
                });
            }, { passive: true });
        }

        // autoplay forever on desktop; pause only while hovered or out of
        // view. The swipe row never moves by itself.
        const setPaused = () => root.toggleAttribute('data-paused', offscreen || hovering);
        const setMode = () => {
            root.classList.toggle('is-auto', !reduced.matches && !swipe.matches);
            markSlides();
            if (swipe.matches) {
                scrollToSlide(index, true);
            } else {
                if (viewport) viewport.scrollLeft = 0;
                layout(true);
            }
        };
        if (!reduced.matches) {
            root.addEventListener('animationend', (event) => {
                if (event.animationName === 'ex-progress' && !swipe.matches) go(index + 1);
            });
        }
        setMode();
        if (typeof swipe.addEventListener === 'function') swipe.addEventListener('change', setMode);
        if (viewport) {
            viewport.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; setPaused(); } });
            viewport.addEventListener('pointerleave', () => { hovering = false; setPaused(); });
        }
        if (hasIO) {
            new IntersectionObserver((entries) => {
                for (const entry of entries) { offscreen = !entry.isIntersecting; setPaused(); }
            }, { threshold: 0.3 }).observe(viewport || root);

            const warm = new IntersectionObserver((entries) => {
                if (!entries.some(e => e.isIntersecting)) return;
                warm.disconnect();
                root.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
            }, { rootMargin: '700px 0px' });
            warm.observe(root);
        } else {
            offscreen = false;
        }
        setPaused();
    }

    /* -----------------------------------------------------------
       Logo marquee: clone each row so the loop is seamless and
       pace it by width. It loops forever, never pausing.
       ----------------------------------------------------------- */
    function initMarquee() {
        const root = document.querySelector('[data-mq]');
        if (!root || reduced.matches) return;

        root.querySelectorAll('.mq-row').forEach(row => {
            const track = row.querySelector('[data-mq-track]');
            if (!track) return;
            const width = track.scrollWidth;
            if (!width) return;
            const copies = Math.max(1, Math.ceil((window.innerWidth * 1.2) / width));
            for (let i = 0; i < copies; i++) {
                const clone = track.cloneNode(true);
                clone.removeAttribute('data-mq-track');
                clone.setAttribute('aria-hidden', 'true');
                row.appendChild(clone);
            }
            // a slow, steady drift that never stops
            row.style.setProperty('--mq-dur', `${Math.round(width / 18)}s`);
        });
        root.classList.add('is-ready');
    }

    /* -----------------------------------------------------------
       What you get — tabs with a sliding indicator
       ----------------------------------------------------------- */
    function initPack() {
        const root = document.querySelector('[data-pk]');
        if (!root) return;
        const tablist = root.querySelector('[role="tablist"]');
        const tabs = [...root.querySelectorAll('[role="tab"]')];
        const panels = [...root.querySelectorAll('[data-pk-panel]')];
        const ind = root.querySelector('.pk-ind');
        if (!tablist || !ind || tabs.length !== panels.length) return;

        const place = (tab) => {
            ind.style.setProperty('--x', `${tab.offsetLeft}px`);
            ind.style.setProperty('--w', `${tab.offsetWidth}px`);
        };

        const ctl = makeTabs(tablist, tabs, panels, (i) => place(tabs[i]));

        // phones: each tab ends with a button to the next, which brings
        // the tabs back into view so the switch is visible
        panels.forEach((panel, i) => {
            const copy = panel.querySelector('.pk-copy');
            const next = tabs[(i + 1) % tabs.length];
            if (!copy || !next) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pk-next';
            btn.innerHTML = `<span><small>${i + 1 < tabs.length ? 'Next' : 'Back to'}</small>${next.textContent.trim()}</span>` +
                '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
            btn.addEventListener('click', () => {
                ctl.select((i + 1) % tabs.length, { user: true });
                const top = tablist.getBoundingClientRect().top;
                if (top < 0) window.scrollBy({ top: top - 90, behavior: reduced.matches ? 'auto' : 'smooth' });
            });
            copy.appendChild(btn);
        });

        // first placement without the slide
        ind.style.transition = 'none';
        place(tabs[ctl.index]);
        void ind.offsetWidth;
        ind.style.transition = '';
        root.classList.add('is-ready');

        let raf = 0;
        const replace = () => {
            window.cancelAnimationFrame(raf);
            raf = window.requestAnimationFrame(() => place(tabs[ctl.index]));
        };
        window.addEventListener('resize', replace, { passive: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    }

    /* -----------------------------------------------------------
       FAQ — <details> that animates open and closed
       ----------------------------------------------------------- */
    function initFaq() {
        const EASE_OPEN = 'cubic-bezier(0.22, 1, 0.36, 1)';
        const EASE_CLOSE = 'cubic-bezier(0.4, 0, 0.2, 1)';

        document.querySelectorAll('.q').forEach(details => {
            const summary = details.querySelector('summary');
            const body = details.querySelector('.q-body');
            if (!summary || !body || typeof body.animate !== 'function') return;

            let anim = null;

            summary.addEventListener('click', (event) => {
                if (reduced.matches) return;          // let the browser do it plainly
                event.preventDefault();

                // Pick up from wherever an in-flight animation has got to.
                // A closed <details> still reports its content's layout
                // height in Chrome, so only measure while it's open.
                const from = details.open ? body.getBoundingClientRect().height : 0;
                if (anim) { anim.cancel(); anim = null; }

                const closing = details.open && !details.classList.contains('is-closing');

                if (closing) {
                    details.classList.add('is-closing');
                    anim = body.animate(
                        [{ height: `${from}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
                        { duration: 320, easing: EASE_CLOSE }
                    );
                    anim.onfinish = () => {
                        details.open = false;
                        details.classList.remove('is-closing');
                        anim = null;
                    };
                    return;
                }

                details.classList.remove('is-closing');
                details.open = true;
                const to = body.scrollHeight;
                anim = body.animate(
                    [{ height: `${from}px`, opacity: from ? 1 : 0 }, { height: `${to}px`, opacity: 1 }],
                    { duration: 420, easing: EASE_OPEN }
                );
                anim.onfinish = () => { anim = null; };
            });
        });
    }

    /* -----------------------------------------------------------
       Hero transition (desktop): the hero is a screen taller than
       the viewport and its contents stick while that screen scrolls
       past. Progress through it is mapped straight onto CSS
       variables (no smoothing, so nothing lags the wheel): the
       headline lifts away, the pieces fly out, and the scene's clip
       closes bottom → sides → top into a card around the box.
       ----------------------------------------------------------- */
    function initHeroTransition() {
        const hero = document.querySelector('.hero');
        const pin = hero && hero.querySelector('.hero-pin');
        const set = hero && hero.querySelector('.hero-set');
        const box = hero && hero.querySelector('.hl-box');
        const navbar = document.querySelector('.navbar');
        const cta = navbar && navbar.querySelector('.navbar-cta');
        const how = document.querySelector('.how');
        if (!pin || !set || !box) return;
        window.requestAnimationFrame(() => set.classList.add('is-in'));
        if (reduced.matches) return;

        const desktop = window.matchMedia('(min-width: 761px)');
        const clamp01 = v => Math.min(1, Math.max(0, v));
        const span = (p, a, b) => clamp01((p - a) / (b - a));
        const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const out = t => 1 - Math.pow(1 - t, 3);

        let geo = null;
        let raf = 0;
        let condensed = false;
        let ctaOnPage = false;
        let eased = -1;

        // The card's final rectangle: a little above centre, so How it
        // works has room to arrive beneath it, with the box carried up
        // into it. Layout sizes only, so the entrance scale and --bs
        // never skew it.
        const measure = () => {
            const vw = pin.clientWidth;
            const vh = pin.clientHeight;
            const boxW = box.offsetWidth;
            const boxCy = (vh - set.offsetHeight) / 2 + box.offsetTop + box.offsetHeight / 2;
            const h = Math.min(boxW * 1.36, vh * 0.6);
            const w = h * 0.88;
            const cy = Math.max(vh * 0.42, h / 2 + 88);
            geo = {
                vw,
                vh,
                top: cy - h / 2,
                bottom: vh - cy - h / 2,
                side: (vw - w) / 2,
                radius: Math.min(48, w * 0.09),
                boxScale: Math.min(0.84, (w * 0.72) / boxW),
                boxShift: cy - boxCy
            };
            // pull How it works up so its first line lands just under
            // the finished card while the hero is still holding
            if (how) {
                how.style.marginTop = '';
                const padTop = parseFloat(getComputedStyle(how).paddingTop) || 0;
                how.style.marginTop = Math.round(cy + h / 2 + 56 - padTop - vh) + 'px';
            }
            // ...and let it rise slower than the page during the hold, so
            // its first line is already on screen by about halfway, while
            // the scene is still closing (it lands in the same spot)
            const range = hero.offsetHeight - vh;
            geo.howLead = Math.max(0, range - 2 * (vh - 80 - (cy + h / 2 + 56)));
        };

        const setCondensed = value => {
            if (value === condensed) return;
            condensed = value;
            hero.classList.toggle('is-condensed', value);
            window.dispatchEvent(new Event('hero:state'));
        };

        // The navbar's CTA turns purple as soon as its centre is over
        // the page rather than the purple scene.
        const setCtaOnPage = value => {
            if (value === ctaOnPage || !navbar) return;
            ctaOnPage = value;
            navbar.classList.toggle('cta-on-page', value);
        };

        const apply = () => {
            raf = 0;
            if (!desktop.matches) {
                if (geo && how) {
                    how.style.marginTop = '';
                    how.style.translate = '';
                    how.style.opacity = '';
                }
                geo = null;
                setCondensed(false);
                setCtaOnPage(false);
                return;
            }
            if (!geo) measure();
            const range = hero.offsetHeight - geo.vh;
            const target = range > 0 ? clamp01(-hero.getBoundingClientRect().top / range) : 0;
            // ease towards the scroll position, so one flick of the wheel
            // glides instead of jumping the whole scene
            eased = eased < 0 ? target : eased + (target - eased) * 0.1;
            if (Math.abs(target - eased) < 0.0005) eased = target;
            else raf = window.requestAnimationFrame(apply);
            const p = eased;

            const tp = out(span(p, 0, 0.3));
            const sp = inOut(span(p, 0, 0.72));
            const eb = inOut(span(p, 0.02, 0.6));
            const es = inOut(span(p, 0.12, 0.74));
            const et = inOut(span(p, 0.22, 0.82));
            const bp = inOut(span(p, 0.1, 0.82));
            const bs = 1 - (1 - geo.boxScale) * bp;
            const top = geo.top * et;
            const bottom = geo.bottom * eb;
            const side = geo.side * es;
            const r = cta && cta.offsetParent ? cta.getBoundingClientRect() : null;

            const st = hero.style;
            st.setProperty('--tp', tp.toFixed(4));
            st.setProperty('--sp', sp.toFixed(4));
            st.setProperty('--bs', bs.toFixed(4));
            if (how) {
                how.style.translate = '0 ' + (-geo.howLead * (1 - p)).toFixed(1) + 'px';
                // fades in with the transition, fully there once the card is done
                how.style.opacity = inOut(span(p, 0.25, 0.82)).toFixed(3);
            }
            st.setProperty('--by', (geo.boxShift * bp).toFixed(1) + 'px');
            st.setProperty('--ep', es.toFixed(4));
            st.setProperty('--ct', top.toFixed(1) + 'px');
            st.setProperty('--cb', bottom.toFixed(1) + 'px');
            st.setProperty('--cs', side.toFixed(1) + 'px');
            st.setProperty('--cr', (geo.radius * es).toFixed(1) + 'px');
            hero.classList.toggle('is-text-gone', tp > 0.999);
            // once the page shows behind the navbar, it should style
            // itself for the page, not the hero
            const navBottom = r ? r.bottom + 8 : 96;
            setCondensed(top > navBottom);
            if (r) {
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                setCtaOnPage(cy < top || cy > geo.vh - bottom || cx > geo.vw - side || cx < side);
            }
        };

        const queue = () => {
            if (!raf) raf = window.requestAnimationFrame(apply);
        };
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', () => {
            geo = null;
            queue();
        });
        apply();
    }

    /* -----------------------------------------------------------
       Hero overscroll: when Safari rubber-bands past the top, the
       hero image stretches up from its bottom edge to fill the gap
       rather than exposing the page background. Browsers that
       don't report a negative scroll simply never trigger it.
       ----------------------------------------------------------- */
    function initHeroStretch() {
        const hero = document.querySelector('.hero');
        const frame = hero && hero.querySelector('.hero-frame');
        if (!frame || reduced.matches) return;

        let raf = 0;
        let stretched = false;

        const apply = () => {
            raf = 0;
            const y = window.scrollY;
            if (y < 0) {
                const scale = 1 + (-y) / Math.max(1, hero.offsetHeight);
                frame.style.transform = `scale(${scale.toFixed(4)})`;
                stretched = true;
            } else if (stretched) {
                frame.style.transform = '';
                stretched = false;
            }
        };

        window.addEventListener('scroll', () => {
            if (window.scrollY >= 0 && !stretched) return;
            if (!raf) raf = window.requestAnimationFrame(apply);
        }, { passive: true });
    }

    /* -----------------------------------------------------------
       Parallax: every [data-parallax] element gets --py, from 1 as it
       enters at the bottom of the screen to -1 as it leaves at the
       top. CSS turns that into a few pixels of drift. Only elements
       on screen are measured; reduced motion skips it.
       ----------------------------------------------------------- */
    function initParallax() {
        const items = document.querySelectorAll('[data-parallax]');
        if (!items.length || reduced.matches || !hasIO) return;

        const live = new Set();
        let raf = 0;
        const update = () => {
            raf = 0;
            const vh = window.innerHeight;
            live.forEach(el => {
                const r = el.getBoundingClientRect();
                const p = (r.top + r.height / 2 - vh / 2) / ((vh + r.height) / 2);
                el.style.setProperty('--py', Math.max(-1, Math.min(1, p)).toFixed(4));
            });
        };
        const queue = () => { if (!raf && live.size) raf = window.requestAnimationFrame(update); };

        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => (e.isIntersecting ? live.add(e.target) : live.delete(e.target)));
            queue();
        }, { rootMargin: '10% 0px' });
        items.forEach(el => io.observe(el));
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue, { passive: true });
    }

    /* -----------------------------------------------------------
       Free preview — the typed idea becomes the brand
       ----------------------------------------------------------- */
    /* While the phone is on screen it loops: hold the idea, sweep to
       the brand, hold, fade back. Steps 1 and 2 light up with it and
       can be clicked to jump. Reduced motion just shows the brand. */
    function initPreviewMorph() {
        const phone = document.querySelector('.pv-phone[data-pv]');
        if (!phone) return;
        const steps = phone.closest('.pv').querySelectorAll('.pv-step');
        const HOLD_IDEA = 2600, SWEEP = 1700, HOLD_BRAND = 4200, FADE = 700;
        let timer = 0, visible = false;

        const set = (state) => {
            phone.dataset.pv = state;
            steps.forEach((s, i) => s.classList.toggle('is-on', i === (state === 'idea' ? 0 : 1)));
        };
        const later = (fn, ms) => { window.clearTimeout(timer); timer = window.setTimeout(fn, ms); };

        const toBrand = () => {
            phone.classList.remove('is-resetting');
            phone.classList.add('is-sweeping');
            set('brand');
            later(toIdea, SWEEP + HOLD_BRAND);
        };
        const toIdea = () => {
            phone.classList.add('is-resetting');
            later(() => {
                phone.classList.remove('is-sweeping');
                set('idea');
                void phone.offsetWidth;   // land the reset before the fade is lifted
                phone.classList.remove('is-resetting');
                later(toBrand, HOLD_IDEA);
            }, FADE);
        };

        set('idea');
        if (reduced.matches || !hasIO) { set('brand'); return; }

        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible) later(phone.dataset.pv === 'idea' ? toBrand : toIdea, phone.dataset.pv === 'idea' ? 1400 : HOLD_BRAND);
            else window.clearTimeout(timer);
        }, { threshold: 0.45 }).observe(phone);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) window.clearTimeout(timer);
            else if (visible) later(phone.dataset.pv === 'idea' ? toBrand : toIdea, 1400);
        });

        steps.forEach((step, i) => {
            if (i > 1) return;
            step.addEventListener('click', () => (i === 0 ? toIdea() : toBrand()));
        });
    }

    /* -----------------------------------------------------------
       Anchors — navbar.js calls this if it exists
       ----------------------------------------------------------- */
    /* Sections carry their own top padding, which already clears the
       navbar, so a jump lands the section's edge exactly at the top of
       the viewport. Once the scroll settles it's re-measured, in case
       anything above (late images, fonts) shifted the layout mid-flight. */
    function targetY(target) {
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
        return Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - margin));
    }

    window.BrandFounderScrollToTarget = function (target, hash, behavior) {
        if (!target) return;
        const smooth = !reduced.matches && behavior !== 'auto';
        window.scrollTo({ top: targetY(target), behavior: smooth ? 'smooth' : 'instant' });

        if (smooth) {
            let done = false;
            const settle = () => {
                if (done) return;
                done = true;
                window.removeEventListener('scrollend', settle);
                const y = targetY(target);
                if (Math.abs(y - window.scrollY) > 2) window.scrollTo({ top: y, behavior: 'smooth' });
            };
            window.addEventListener('scrollend', settle, { once: true });
            window.setTimeout(settle, 1400);   // browsers without scrollend
        }

        if (hash) {
            try { history.replaceState(null, '', hash); } catch (e) { /* ignore */ }
        }
    };

    function initAnchors() {
        document.querySelectorAll('main a[href^="#"], .site-foot a[href^="#"], .foot a[href^="#"]').forEach(link => {
            link.addEventListener('click', (event) => {
                const hash = link.getAttribute('href');
                const target = hash && hash.length > 1 && document.querySelector(hash);
                if (!target) return;
                event.preventDefault();
                window.BrandFounderScrollToTarget(target, hash, 'smooth');
            });
        });
    }

    /* -----------------------------------------------------------
       How it works: the glow behind the demo fades in once
       ----------------------------------------------------------- */
    function initHowGlow() {
        const how = document.querySelector('.how');
        if (!how) return;
        if (!hasIO) { how.classList.add('is-lit'); return; }
        const io = new IntersectionObserver((entries) => {
            if (!entries.some(e => e.isIntersecting)) return;
            io.disconnect();
            how.classList.add('is-lit');
        }, { threshold: 0.2 });
        io.observe(how);
    }

    /* -----------------------------------------------------------
       Legal pages: highlight the section being read in the contents
       ----------------------------------------------------------- */
    function initLegalToc() {
        const links = [...document.querySelectorAll('.legal-toc a[href^="#"]')];
        if (!links.length) return;
        const pairs = links.map(a => [a, document.getElementById(a.getAttribute('href').slice(1))]).filter(([, h]) => h);
        let ticking = false;
        function mark() {
            ticking = false;
            // the last heading above the upper third of the screen wins
            let current = pairs[0];
            for (const pair of pairs) if (pair[1].getBoundingClientRect().top < window.innerHeight * 0.33) current = pair;
            pairs.forEach(([a]) => a.classList.toggle('is-current', a === current[0]));
        }
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(mark); }
        }, { passive: true });
        mark();
    }

    /* -----------------------------------------------------------
       Boot
       ----------------------------------------------------------- */
    function boot() {
        const year = document.getElementById('year');
        if (year) year.textContent = String(new Date().getFullYear());

        initReveals();
        initHeroStretch();
        initHeroTransition();
        initDemo();
        initHowGlow();
        initExamples();
        initMarquee();
        initPack();
        initParallax();
        initPreviewMorph();
        initFaq();
        initAnchors();
        initLegalToc();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
