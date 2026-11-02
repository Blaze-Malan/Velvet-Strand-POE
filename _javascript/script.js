// Marks the page as JavaScript-enabled so the CSS only hides content for the
// scroll animation when this script is actually running.
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
