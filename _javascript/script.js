
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const current = location.pathname.split('/').pop() || 'index.html';

    // Navigation: highlights the link for the page the visitor is on.
    document.querySelectorAll('nav a').forEach((link) => {
        if (link.getAttribute('href') === current) {
            link.setAttribute('aria-current', 'page');
        }
    });

    // Header: adds a shadow and a smaller size once the page is scrolled.
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Scroll reveal: headings, text, cards and forms fade in as they scroll into view.
    const targets = document.querySelectorAll(
        'main section > h1, main section > h2, main section > p, main article, main form, main > h1, main > h2, main > p'
    );
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Skip the animation for visitors who prefer reduced motion or on old browsers.
    if (reduceMotion || !('IntersectionObserver' in window)) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    // Small staggered delay so items in a group appear one after another.
    targets.forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = `${(i % 4) * 90}ms`;
        observer.observe(el);
    });
});


// Helper: builds an element with attributes/text/children (no innerHTML used).
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'text') node.textContent = value;
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value);
    });
    children.forEach((child) => node.append(child));
    return node;
}

const rand = (n) => 'R ' + n.toLocaleString('en-US');

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return [h ? `${h} hr` : '', m ? `${m} mins` : ''].filter(Boolean).join(' ') || '0 mins';
}

// Reusable modal built on the native <dialog> element (focus trap, Esc to close).
let modal;
function openModal({ title, image, content = [], actions = [] }) {
    if (!modal) {
        const close = el('button', { type: 'button', class: 'modal-close', 'aria-label': 'Close', text: '×' });
        modal = { dialog: el('dialog', { class: 'modal', 'aria-labelledby': 'modal-title' }), close, opener: null };
        modal.dialog.addEventListener('click', (e) => {
            if (e.target === modal.dialog) modal.dialog.close();
        });
        modal.dialog.addEventListener('close', () => {
            document.body.classList.remove('modal-open');
            if (modal.opener && document.contains(modal.opener)) modal.opener.focus();
        });
        close.addEventListener('click', () => modal.dialog.close());
        document.body.append(modal.dialog);
    }
    modal.opener = document.activeElement;
    const body = el('div', { class: 'modal-body' });
    if (image) body.append(el('img', { src: image.src, alt: image.alt }));
    body.append(el('h2', { id: 'modal-title', text: title }), ...content);
    if (actions.length) body.append(el('div', { class: 'modal-actions' }, ...actions));
    modal.dialog.replaceChildren(modal.close, body);
    document.body.classList.add('modal-open');
    modal.dialog.showModal();
}

// About page: stylist cards open a profile modal. Placeholder bios, edit as needed.
const stylistBios = {
    'Elena Rostova': 'Elena has spent over a decade perfecting colour and precision cutting for straight and wavy hair. She is known for seamless blondes, rich glosses and volume-boosting cuts.',
    'Amina Diallo': 'Amina specialises in curl-by-curl shaping, protective styling and moisture-first care for curly and coily hair. She builds routines that keep natural texture healthy at home.'
};

function initStylists() {
    document.querySelectorAll('.about-section article').forEach((card) => {
        const name = card.querySelector('h3')?.textContent.trim();
        if (!name || !stylistBios[name]) return;
        const img = card.querySelector('img');
        const button = el('button', { type: 'button', class: 'btn add-btn', text: 'View profile' });
        button.addEventListener('click', () => openModal({
            title: name,
            image: { src: img.getAttribute('src'), alt: img.alt },
            content: [
                el('p', { class: 'modal-role', text: card.querySelector('p').textContent }),
                el('p', { text: stylistBios[name] })
            ],
            actions: [el('a', { class: 'btn', href: 'enquiry.html', text: 'Book a consultation' })]
        }));
        card.append(button);
    });
}

// Reads name, price (and duration in minutes) from a product/service card.
function readCard(card) {
    const text = card.textContent;
    const price = Number((text.match(/R\s*([\d,]+)/) || [0, '0'])[1].replace(/,/g, ''));
    const hrs = Number((text.match(/(\d+)\s*hrs?/) || [0, 0])[1]);
    const mins = Number((text.match(/(\d+)\s*mins?/) || [0, 0])[1]);
    return { name: card.querySelector('h2').textContent.trim(), price, minutes: hrs * 60 + mins };
}

// Adds a search box and sort menu that filter/reorder the cards live.
function addToolbar(grid, cards, extraSorts = []) {
    const original = [...cards];
    const search = el('input', { type: 'search', placeholder: 'Search…', 'aria-label': 'Search' });
    const sort = el('select', { 'aria-label': 'Sort by' },
        el('option', { value: 'default', text: 'Sort: Default' }),
        el('option', { value: 'price-asc', text: 'Price: Low to High' }),
        el('option', { value: 'price-desc', text: 'Price: High to Low' }),
        el('option', { value: 'name', text: 'Name: A to Z' }),
        ...extraSorts
    );
    const empty = el('p', { class: 'empty-state', text: 'No matches found.', hidden: '' });
    const status = el('p', { class: 'sr-only', 'aria-live': 'polite' });

    const update = () => {
        const term = search.value.trim().toLowerCase();
        const data = (c) => readCard(c);
        const sorters = {
            default: (a, b) => original.indexOf(a) - original.indexOf(b),
            'price-asc': (a, b) => data(a).price - data(b).price,
            'price-desc': (a, b) => data(b).price - data(a).price,
            name: (a, b) => data(a).name.localeCompare(data(b).name),
            'time-asc': (a, b) => data(a).minutes - data(b).minutes
        };
        let shown = 0;
        [...original].sort(sorters[sort.value]).forEach((card) => {
            grid.append(card);
            const match = card.textContent.toLowerCase().includes(term);
            card.hidden = !match;
            if (match) shown++;
        });
        empty.hidden = shown > 0;
        status.textContent = `${shown} result${shown === 1 ? '' : 's'} shown`;
    };

    search.addEventListener('input', update);
    sort.addEventListener('change', update);
    grid.before(el('div', { class: 'toolbar' }, search, sort), empty, status);
}

// Floating panel used by both the basket and the quote builder.
function createPanel(title, id) {
    const list = el('ul', { class: 'panel-list' });
    const total = el('p', { class: 'panel-total' });
    const clear = el('button', { type: 'button', class: 'btn-link', text: 'Clear all' });
    const body = el('div', { class: 'panel-body', hidden: '' }, list, total, clear);
    const count = el('span', { class: 'panel-count', text: '0' });
    const toggle = el('button', {
        type: 'button', class: 'panel-toggle', 'aria-expanded': 'false', 'aria-controls': id
    }, `${title} `, count);
    toggle.addEventListener('click', () => {
        const open = body.hidden;
        body.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
    });
    const panel = el('aside', { class: 'panel', id }, toggle, body);
    document.body.append(panel);
    return { panel, body, list, total, clear, count };
}

// Products page: search, sort and a basket saved in localStorage.
function initProducts() {
    const grid = document.querySelector('.product-grid');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('article')];
    addToolbar(grid, cards);

    const ui = createPanel('Basket', 'basket');
    let basket = {};
    try { basket = JSON.parse(localStorage.getItem('vs-basket')) || {}; } catch (e) { basket = {}; }

    const render = () => {
        localStorage.setItem('vs-basket', JSON.stringify(basket));
        ui.list.replaceChildren();
        let sum = 0;
        let items = 0;
        Object.entries(basket).forEach(([name, item]) => {
            sum += item.price * item.qty;
            items += item.qty;
            const change = (delta) => {
                item.qty += delta;
                if (item.qty <= 0) delete basket[name];
                render();
            };
            ui.list.append(el('li', {},
                el('span', { text: `${name} × ${item.qty}` }),
                el('span', { class: 'panel-actions' },
                    el('button', { type: 'button', 'aria-label': `Remove one ${name}`, text: '−', onclick: () => change(-1) }),
                    el('button', { type: 'button', 'aria-label': `Add one ${name}`, text: '+', onclick: () => change(1) })
                )
            ));
        });
        if (!items) ui.list.append(el('li', { text: 'Your basket is empty.' }));
        ui.total.textContent = `Total: ${rand(sum)}`;
        ui.count.textContent = items;
        ui.count.classList.remove('bump');
        void ui.count.offsetWidth;
        ui.count.classList.add('bump');
    };

    cards.forEach((card) => {
        const { name, price } = readCard(card);
        const button = el('button', { type: 'button', class: 'btn add-btn', text: 'Add to basket' });
        button.addEventListener('click', () => {
            basket[name] = basket[name] || { price, qty: 0 };
            basket[name].qty++;
            render();
            button.textContent = 'Added ✓';
            setTimeout(() => { button.textContent = 'Add to basket'; }, 1000);
        });
        card.append(button);
    });

    ui.clear.addEventListener('click', () => { basket = {}; render(); });
    render();
}

// Services page: search, sort and a quote builder with running price and time.
function initServices() {
    const grid = document.querySelector('.service-list');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('article')];
    addToolbar(grid, cards, [el('option', { value: 'time-asc', text: 'Duration: Shortest first' })]);

    const ui = createPanel('Your quote', 'quote');
    const selected = new Map();
    const review = el('button', { type: 'button', class: 'btn add-btn', text: 'Review quote' });
    review.addEventListener('click', () => {
        if (!selected.size) return;
        let price = 0;
        let minutes = 0;
        const rows = [...selected.values()].map((s) => {
            price += s.price;
            minutes += s.minutes;
            return el('li', {}, el('span', { text: s.name }), el('span', { text: rand(s.price) }));
        });
        openModal({
            title: 'Your quote',
            content: [
                el('ul', { class: 'panel-list' }, ...rows),
                el('p', { class: 'panel-total', text: `Total: ${rand(price)} | Time: ${formatTime(minutes)}` }),
                el('p', { text: 'Send us an enquiry to turn this quote into a booking.' })
            ],
            actions: [
                el('a', {
                    class: 'btn',
                    href: 'enquiry.html',
                    text: 'Go to enquiry',
                    onclick: () => sessionStorage.setItem('vs-quote', JSON.stringify([...selected.keys()]))
                }),
                el('button', { type: 'button', class: 'btn-link', text: 'Keep browsing', onclick: () => modal.dialog.close() })
            ]
        });
    });
    ui.body.append(review);

    const render = () => {
        ui.list.replaceChildren();
        let price = 0;
        let minutes = 0;
        selected.forEach((s, name) => {
            price += s.price;
            minutes += s.minutes;
            ui.list.append(el('li', {}, el('span', { text: name }), el('span', { text: rand(s.price) })));
        });
        if (!selected.size) ui.list.append(el('li', { text: 'Select services to build a quote.' }));
        ui.total.textContent = `Total: ${rand(price)} | Time: ${formatTime(minutes)}`;
        ui.count.textContent = selected.size;
        ui.count.classList.remove('bump');
        void ui.count.offsetWidth;
        ui.count.classList.add('bump');
    };

    cards.forEach((card) => {
        const info = readCard(card);
        const box = el('input', { type: 'checkbox' });
        box.addEventListener('change', () => {
            card.classList.toggle('selected', box.checked);
            if (box.checked) selected.set(info.name, info);
            else selected.delete(info.name);
            render();
        });
        card.append(el('label', { class: 'select-label' }, box, ' Add to quote'));
    });

    ui.clear.addEventListener('click', () => {
        selected.clear();
        cards.forEach((card) => {
            card.classList.remove('selected');
            card.querySelector('input[type="checkbox"]').checked = false;
        });
        render();
    });
    render();
}

// Shared form handling: each `.field[data-name]` wrapper holds its control(s) and an `.error` span.
// Validates on blur/change, shows errors, then submits asynchronously (simulated, no backend).
function sendForm(data) {
    // Stand-in for fetch('/api/...', { method: 'POST', body: JSON.stringify(data) }).
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true, data }), 1200));
}

function setupForm(form, rules, { successText, onSuccess = () => {} }) {
    const status = form.querySelector('.form-status');
    const submit = form.querySelector('button[type="submit"]');
    const label = submit.textContent;
    const wraps = [...form.querySelectorAll('.field[data-name]')];
    const controls = (w) => [...w.querySelectorAll('input, select, textarea')];

    const valueOf = (w) => {
        const list = controls(w);
        if (list[0].type === 'checkbox') return list.filter((c) => c.checked).map((c) => c.value);
        return list[0].value.trim();
    };

    const validate = (w) => {
        const error = rules[w.dataset.name](valueOf(w));
        w.querySelector('.error').textContent = error;
        controls(w).forEach((c) => {
            c.classList.toggle('invalid', Boolean(error));
            c.setAttribute('aria-invalid', String(Boolean(error)));
        });
        return !error;
    };

    wraps.forEach((w) => {
        const isGroup = controls(w)[0].type === 'checkbox';
        w.addEventListener(isGroup ? 'change' : 'focusout', () => validate(w));
        w.addEventListener('input', () => {
            if (controls(w)[0].classList.contains('invalid')) validate(w);
            const counter = w.querySelector('.counter');
            if (counter) counter.textContent = `${controls(w)[0].value.length} / ${controls(w)[0].maxLength}`;
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.className = 'form-status';
        const results = wraps.map(validate);
        const bad = wraps[results.indexOf(false)];
        if (bad) {
            controls(bad)[0].focus();
            status.textContent = 'Please fix the highlighted fields.';
            status.classList.add('error-text');
            return;
        }

        submit.disabled = true;
        submit.textContent = 'Sending…';
        status.textContent = '';
        try {
            const data = Object.fromEntries(wraps.map((w) => [w.dataset.name, valueOf(w)]));
            const response = await sendForm(data);
            if (!response.ok) throw new Error('Request failed');
            form.reset();
            form.querySelectorAll('.counter').forEach((c) => { c.textContent = `0 / ${c.previousElementSibling.maxLength}`; });
            onSuccess();
            status.textContent = successText(data);
            status.classList.add('success-text');
        } catch (e) {
            status.textContent = 'Sorry, something went wrong. Please try again.';
            status.classList.add('error-text');
        } finally {
            submit.disabled = false;
            submit.textContent = label;
        }
    });
}

const commonRules = {
    name: (v) => (v.length < 2 ? 'Please enter your full name.' : /^[\p{L}\s'.-]+$/u.test(v) ? '' : 'Name contains invalid characters.'),
    email: (v) => (!v ? 'Please enter your email address.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address.'),
    phone: (v) => (!v || /^\+?[\d\s()-]{7,15}$/.test(v) ? '' : 'Please enter a valid phone number.'),
    message: (v) => (v.length < 10 ? 'Message must be at least 10 characters.' : '')
};

// Contact page: general queries form.
function initQueryForm() {
    const form = document.getElementById('query-form');
    if (!form) return;
    setupForm(form, {
        ...commonRules,
        topic: (v) => (v ? '' : 'Please choose a topic.')
    }, {
        successText: (d) => `Thank you, ${d.name.split(' ')[0]}! Your message has been sent. We'll be in touch soon.`
    });
}

// Enquiry page: consultation form, pre-filled with services chosen in the quote builder.
function initEnquiryForm() {
    const form = document.getElementById('enquiry-form');
    if (!form) return;

    const date = form.querySelector('input[type="date"]');
    const today = new Date();
    date.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    setupForm(form, {
        ...commonRules,
        hair: (v) => (v ? '' : 'Please choose your hair type.'),
        services: (v) => (v.length ? '' : 'Please select at least one service.'),
        date: (v) => {
            if (!v) return 'Please choose a preferred date.';
            const [y, m, d] = v.split('-').map(Number);
            const chosen = new Date(y, m - 1, d);
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            if (chosen < start) return 'Please choose a date in the future.';
            return [0, 1].includes(chosen.getDay()) ? 'We are open Tuesday to Saturday only.' : '';
        }
    }, {
        successText: (d) => `Thank you, ${d.name.split(' ')[0]}! We've received your enquiry and will contact you to confirm your consultation.`,
        onSuccess: () => form.querySelector('.prefill-note')?.remove()
    });

    let saved = [];
    try { saved = JSON.parse(sessionStorage.getItem('vs-quote')) || []; } catch (e) { saved = []; }
    sessionStorage.removeItem('vs-quote');
    const boxes = [...form.querySelectorAll('input[name="services"]')].filter((b) => saved.includes(b.value));
    if (boxes.length) {
        boxes.forEach((b) => { b.checked = true; });
        form.querySelector('.field[data-name="services"] legend').after(
            el('small', { class: 'prefill-note', text: 'Pre-selected from your quote.' })
        );
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProducts();
    initServices();
    initStylists();
    initQueryForm();
    initEnquiryForm();
});
