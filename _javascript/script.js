
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
    return { panel, list, total, clear, count };
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
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        ui.total.textContent = `Total: ${rand(price)} | Time: ${h ? h + ' hr ' : ''}${m ? m + ' mins' : h ? '' : '0 mins'}`.trim();
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

document.addEventListener('DOMContentLoaded', () => {
    initProducts();
    initServices();
});
