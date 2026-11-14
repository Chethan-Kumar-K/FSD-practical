'use strict';

/* =====================================================================
   Hero scroll effect (GSAP + ScrollTrigger). Hero only.
   Desktop: the hero pins and the receipt prints out of the slot as you
   scroll, then a stamp lands. Phones: no pinning, the receipt prints as
   it comes into view. Reduced motion: nothing moves.
   ===================================================================== */
(function () {
  const root = document.documentElement;
  const hero = document.getElementById('home');
  const ready = () => root.classList.remove('hero-prep');
  if (!hero) { ready(); return; }

  /* Optional photo: if img/hero-bg.jpg is missing, hide the slot and keep the drawn skyline */
  const photo = hero.querySelector('.hero-photo img');
  if (photo) {
    const hidePhoto = () => { photo.parentElement.hidden = true; };
    photo.addEventListener('error', hidePhoto);
    if (photo.complete && photo.naturalWidth === 0) hidePhoto();
  }

  /* If the GSAP scripts did not load (offline, blocked), the page simply stays static */
  if (!window.gsap || !window.ScrollTrigger) { ready(); return; }
  gsap.registerPlugin(ScrollTrigger);

  const $1 = (s) => hero.querySelector(s);
  const header = document.querySelector('header');
  const h1 = $1('h1');
  const wrap = $1('.hero-receipt-wrap');
  const receipt = $1('.receipt-paper');
  const stamp = $1('.hero-stamp');
  const photoPlane = $1('.hero-photo');
  const far = $1('.hero-far');
  const near = $1('.hero-near');
  const haze = $1('.hero-haze');
  const smoke = hero.querySelectorAll('.hero-smoke circle');
  const copy = $1('.hero-copy');

  /* Split the headline into words for the intro. aria-label keeps the heading readable as one phrase. */
  const text = h1.textContent.trim().replace(/\s+/g, ' ');
  h1.setAttribute('aria-label', text);
  h1.textContent = '';
  text.split(' ').forEach((w) => {
    const s = document.createElement('span');
    s.className = 'hero-word';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = w;
    h1.append(s, ' ');
  });
  const words = h1.querySelectorAll('.hero-word');

  const setHeaderHeight = () => hero.style.setProperty('--hh', (header ? header.offsetHeight : 68) + 'px');
  setHeaderHeight();

  const PRINT_HIDDEN = 'inset(0% 0% 52% 0%)'; // top part of the receipt is already out of the slot
  const PRINT_FULL = 'inset(0% 0% 0% 0%)';

  const mm = gsap.matchMedia();

  mm.add({
    desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
    phone: '(max-width: 1023px) and (prefers-reduced-motion: no-preference)',
    still: '(prefers-reduced-motion: reduce)'
  }, (ctx) => {
    const { desktop, phone, still } = ctx.conditions;
    if (still) { ready(); return; }

    /* Intro, plays once on load */
    gsap.from(words, { y: 34, opacity: 0, duration: .7, stagger: .06, ease: 'power3.out' });
    gsap.from(hero.querySelectorAll('.hero-copy > p, .hero-copy > div'), { y: 20, opacity: 0, duration: .6, delay: .45, stagger: .12, ease: 'power2.out' });
    gsap.from(wrap, { y: -24, opacity: 0, duration: .8, delay: .25, ease: 'power3.out' });
    ready();

    if (desktop) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: () => 'top ' + (header ? header.offsetHeight : 68),
          end: '+=110%',
          pin: true,
          scrub: .6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: setHeaderHeight
        }
      });
      tl.fromTo(receipt, { clipPath: PRINT_HIDDEN }, { clipPath: PRINT_FULL, duration: .7, ease: 'steps(20)' }, 0)
        .fromTo(stamp, { autoAlpha: 0, scale: 2.2, rotation: -26 }, { autoAlpha: 1, scale: 1, rotation: -12, duration: .12, ease: 'power4.in' }, .74)
        .to(photoPlane, { scale: 1.12, yPercent: -4, duration: 1 }, 0)
        .to(far, { scale: 1.07, duration: 1 }, 0)
        .to(near, { scale: 1.18, duration: 1 }, 0)
        .to(haze, { xPercent: -10, yPercent: -6, duration: 1 }, 0)
        .to(smoke, { y: -55, duration: 1 }, 0)
        .to(copy, { yPercent: -3, duration: 1 }, 0);
    }

    if (phone) {
      gsap.fromTo(receipt, { clipPath: PRINT_HIDDEN }, {
        clipPath: PRINT_FULL, ease: 'steps(20)',
        scrollTrigger: { trigger: wrap, start: 'top 85%', end: 'center 50%', scrub: .5 }
      });
      gsap.fromTo(stamp, { autoAlpha: 0, scale: 2.2, rotation: -26 }, {
        autoAlpha: 1, scale: 1, rotation: -12, duration: .25, ease: 'power4.in',
        scrollTrigger: { trigger: wrap, start: 'center 55%', toggleActions: 'play none none reverse' }
      });
      const drift = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to(near, { scale: 1.12, scrollTrigger: drift });
      gsap.to(far, { scale: 1.05, scrollTrigger: drift });
      gsap.to(haze, { xPercent: -8, scrollTrigger: drift });
    }
  });

  /* Tailwind (CDN) and web fonts both change sizes after first paint, so re-measure once they are in */
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  setTimeout(ready, 3000); // safety: never leave the hero hidden
})();
