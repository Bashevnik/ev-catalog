/* Поведінка сайту. Без збірки й фреймворків: сторінка має працювати і тоді,
   коли скрипт не завантажився - усе критичне є в HTML.
   Рух вимикається одним прапорцем prefers-reduced-motion. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = (navigator.connection && navigator.connection.saveData) === true;
  var narrow = window.matchMedia('(max-width: 860px)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  /* ------------------------------------------------- плавна прокрутка
     Lenis лише там, де рух доречний: на тач-екранах рідна інерція краща,
     а при reduced motion плавність взагалі не потрібна. */

  var lenis = null;
  if (!reduced && !coarse && window.Lenis) {
    try {
      // anchors: інакше посилання на якір всередині сторінки конфліктує з
      // власною прокруткою Lenis і сторінка просто смикається
      lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9, anchors: true });
      window.__lenis = lenis;
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } catch (e) { lenis = null; }
  }

  var scrollY = function () { return window.scrollY || document.documentElement.scrollTop; };

  /* ------------------------------------------------------- поява секцій */

  var revealables = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (revealables.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          ro.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      revealables.forEach(function (el) { ro.observe(el); });
    }
  }

  /* ------------------------------------------------------------ паралакс
     Кадр рухається повільніше за сторінку. Рахуємо в rAF і лише для тих
     блоків, що зараз у полі зору. */

  var layers = [].slice.call(document.querySelectorAll('.parallax'));
  if (layers.length && !reduced) {
    var visible = [];
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = visible.indexOf(e.target);
        if (e.isIntersecting && i < 0) visible.push(e.target);
        if (!e.isIntersecting && i > -1) visible.splice(i, 1);
      });
    }, { rootMargin: '10% 0px' });
    layers.forEach(function (l) { pio.observe(l); });

    var tick = function () {
      var vh = window.innerHeight;
      for (var i = 0; i < visible.length; i++) {
        var el = visible[i];
        var host = el.parentElement;
        var r = host.getBoundingClientRect();
        var speed = Number(el.dataset.speed || 0.18);
        // 0 у центрі екрана, ±1 на краях
        var progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        el.style.transform = 'translate3d(0,' + (progress * speed * r.height).toFixed(1) + 'px,0)';
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------- навігація */

  var nav = document.querySelector('.nav');
  var burger = document.querySelector('.nav__burger');

  if (nav) {
    var onScroll = function () {
      var y = scrollY();
      if (nav.classList.contains('nav--over')) nav.classList.toggle('is-solid', y > 40);
      // Шапка закреплена на всех устройствах: навигация всегда доступна,
      // а при уходе от hero меняется только её фон.
      nav.classList.remove('nav--hidden');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      burger.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (lenis) { open ? lenis.start() : lenis.stop(); }
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.setAttribute('data-open', 'false');
        burger.setAttribute('aria-expanded', 'false');
        if (lenis) lenis.start();
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || nav.getAttribute('data-open') !== 'true') return;
      nav.setAttribute('data-open', 'false');
      burger.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();
      burger.focus();
    });
  }

  /* -------------------------------------------------------------- відео
     Відео вмикаємо лише там, де воно доречне: на вузькому екрані, при
     economy-режимі чи reduced motion лишається постер. Грає тільки той
     кліп, що у полі зору. */

  var holders = [].slice.call(document.querySelectorAll('[data-video]'));
  var players = [];

  if (holders.length && !reduced && !saveData) {
    holders.forEach(function (holder) {
      var v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'none';
      v.setAttribute('aria-hidden', 'true');
      v.setAttribute('tabindex', '-1');
      // на телефоні беремо легший рендишн: той самий кадр, менший файл
      var small = holder.getAttribute('data-video-sm');
      v.src = (narrow && small) ? small : holder.getAttribute('data-video');
      v.addEventListener('loadeddata', function () { v.classList.add('is-ready'); });
      holder.appendChild(v);
      players.push(v);
    });

    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && e.intersectionRatio > 0.25) {
          if (v.dataset.paused !== 'true') v.play().catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: [0, 0.25, 0.6] });
    players.forEach(function (v) { vio.observe(v); });

    var toggle = document.querySelector('.hero__toggle');
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', function () {
        var v = players[0];
        if (!v) return;
        var paused = v.paused;
        v.dataset.paused = paused ? 'false' : 'true';
        if (paused) { v.play().catch(function () {}); } else { v.pause(); }
        toggle.setAttribute('aria-label', paused ? 'Зупинити відео' : 'Відтворити відео');
        toggle.innerHTML = paused
          ? '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>'
          : '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3l8 5-8 5z"/></svg>';
      });
    }
  }

  /* ------------------------------------------------------------ фільтри */

  var list = document.querySelector('[data-list]');
  if (list) {
    var cards = [].slice.call(list.querySelectorAll('[data-item]'));
    var countEl = document.querySelector('[data-count]');
    var emptyEl = document.querySelector('[data-empty]');
    var resetEls = [].slice.call(document.querySelectorAll('[data-reset]'));
    var controls = [].slice.call(document.querySelectorAll('[data-filter], [data-sort]'));

    // Фільтрів на сторінці два набори: рядок на широкому екрані й діалог на
    // телефоні. Значення тримаємо однакові, інакше вибір у діалозі нічого
    // не змінює.
    // Імена фільтрів беремо з розмітки: на /avto це марка й привід,
    // у каталозі товарів - категорія. Логіка одна.
    var names = [];
    document.querySelectorAll('[data-filter]').forEach(function (el) {
      if (names.indexOf(el.dataset.filter) < 0) names.push(el.dataset.filter);
    });
    var state = { sort: 'default' };
    names.forEach(function (n) { state[n] = ''; });

    var sync = function () {
      document.querySelectorAll('[data-filter]').forEach(function (el) {
        el.value = state[el.dataset.filter] || '';
      });
      document.querySelectorAll('[data-sort]').forEach(function (el) { el.value = state.sort; });
    };

    var apply = function () {
      var sort = state.sort;
      var shown = 0;

      cards.forEach(function (c) {
        var ok = names.every(function (n) {
          return !state[n] || c.dataset[n] === state[n];
        });
        c.hidden = !ok;
        if (ok) shown++;
      });

      // Порядок за замовчуванням зберігаємо: інакше картки стрибають
      // щоразу, коли фільтр скидають.
      var sorted = cards.slice();
      if (sort === 'price-asc' || sort === 'price-desc') {
        sorted.sort(function (a, b) {
          var pa = a.dataset.price === '' ? null : Number(a.dataset.price);
          var pb = b.dataset.price === '' ? null : Number(b.dataset.price);
          if (pa === null && pb === null) return Number(a.dataset.order) - Number(b.dataset.order);
          if (pa === null) return 1;            // без ціни - у кінець, завжди
          if (pb === null) return -1;
          return sort === 'price-asc' ? pa - pb : pb - pa;
        });
      } else if (sort === 'year-desc') {
        sorted.sort(function (a, b) {
          return (Number(b.dataset.year) || 0) - (Number(a.dataset.year) || 0)
            || Number(a.dataset.order) - Number(b.dataset.order);
        });
      } else {
        sorted.sort(function (a, b) { return Number(a.dataset.order) - Number(b.dataset.order); });
      }
      sorted.forEach(function (c) { list.appendChild(c); });

      if (countEl) {
        var word = countEl.dataset.count || 'позицій';
        countEl.textContent = shown === cards.length
          ? shown + ' ' + word
          : shown + ' з ' + cards.length;
      }
      if (emptyEl) emptyEl.hidden = shown !== 0;
      var dirty = names.some(function (n) { return !!state[n]; }) || sort !== 'default';
      resetEls.forEach(function (r) { r.hidden = !dirty; });
    };

    controls.forEach(function (el) {
      el.addEventListener('change', function () {
        if (el.dataset.filter) state[el.dataset.filter] = el.value;
        else state.sort = el.value;
        sync();
        apply();
      });
    });
    resetEls.forEach(function (r) {
      r.addEventListener('click', function () {
        state = { sort: 'default' };
        names.forEach(function (n) { state[n] = ''; });
        sync();
        apply();
      });
    });
    sync();
    apply();

    var sheet = document.querySelector('dialog.sheet');
    var openBtn = document.querySelector('[data-open-filters]');
    if (sheet && openBtn && typeof sheet.showModal === 'function') {
      var mq = window.matchMedia('(max-width: 860px)');
      var syncBtn = function () { openBtn.hidden = !mq.matches; };
      syncBtn();
      mq.addEventListener('change', syncBtn);
      openBtn.addEventListener('click', function () { sheet.showModal(); });
      sheet.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () { sheet.close(); });
      });
    }
  }

  /* ------------------------------------------------------------ галерея */

  var gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    var stage = gallery.querySelector('[data-stage]');
    var thumbs = [].slice.call(gallery.querySelectorAll('[data-thumb]'));
    var box = document.querySelector('dialog.lightbox');

    var show = function (btn) {
      var kind = btn.dataset.kind;
      var src = btn.dataset.src;
      var poster = btn.dataset.poster || '';
      var alt = btn.dataset.alt || '';
      stage.innerHTML = kind === 'video'
        ? '<video src="' + src + '" poster="' + poster + '" controls muted playsinline loop preload="metadata"></video>'
        : '<img src="' + src + '" alt="' + alt + '">';
      thumbs.forEach(function (t) { t.setAttribute('aria-current', String(t === btn)); });
    };

    thumbs.forEach(function (t) { t.addEventListener('click', function () { show(t); }); });

    if (box) {
      stage.addEventListener('click', function (e) {
        var img = e.target.closest('img');
        if (!img) return;
        var big = box.querySelector('[data-lightbox-img]');
        big.src = img.src;
        big.alt = img.alt;
        box.showModal();
        if (lenis) lenis.stop();
      });
      box.addEventListener('close', function () { if (lenis) lenis.start(); });
      box.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () { box.close(); });
      });
    }
  }

  /* ------------------------------------------------- текст оголошення
     Він відкритий одразу. Підрізаємо лише справді довгий і розкриваємо
     кліком по самому тексту. */

  var source = document.querySelector('[data-source]');
  if (source) {
    var pre = source.querySelector('pre');
    var more = source.querySelector('[data-source-more]');
    var long = pre.scrollHeight > pre.clientHeight + 4;
    if (!long) {
      source.dataset.clamp = 'false';
      if (more) more.hidden = true;
    } else {
      var open = function () {
        source.dataset.clamp = 'false';
        if (more) more.hidden = true;
      };
      pre.addEventListener('click', open);
      if (more) more.addEventListener('click', open);
    }
  }

  /* --------------------------------------------------------------- форма
     Поки не підключено жодного каналу, не брешемо «надіслано»: показуємо,
     що саме сталося, і даємо скопіювати текст. */

  var form = document.querySelector('form[data-form]');
  if (form) {
    var done = document.querySelector('[data-form-done]');

    var q = new URLSearchParams(location.search);
    var item = q.get('item');
    var sel = form.querySelector('[name="item"]');
    if (item && sel) {
      var has = [].slice.call(sel.options).some(function (o) { return o.value === item; });
      if (has) sel.value = item;
    }
    if (q.get('topic') === 'spec') {
      var msg = form.querySelector('[name="message"]');
      if (msg && !msg.value) msg.value = 'Уточніть, будь ласка, комплектацію та що саме входить у ціну під ключ.';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var endpoint = form.getAttribute('data-endpoint');
      var data = new FormData(form);
      var text = 'Запит із сайту\n'
        + 'Товар: ' + (data.get('item') || '-') + '\n'
        + 'Імʼя: ' + (data.get('name') || '-') + '\n'
        + 'Контакт: ' + (data.get('contact') || '-') + '\n'
        + 'Питання: ' + (data.get('message') || '-');

      if (endpoint) {
        fetch(endpoint, { method: 'POST', body: data })
          .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r; })
          .then(function () { form.hidden = true; done.hidden = false; done.dataset.state = 'sent'; })
          .catch(function () { done.hidden = false; done.dataset.state = 'error'; });
        return;
      }

      form.hidden = true;
      done.hidden = false;
      done.dataset.state = 'demo';
      var copy = done.querySelector('[data-copy]');
      if (copy) {
        copy.addEventListener('click', function () {
          navigator.clipboard.writeText(text).then(function () {
            copy.querySelector('span').textContent = 'Скопійовано';
          }, function () {
            copy.querySelector('span').textContent = 'Не вийшло скопіювати';
          });
        });
      }
    });
  }
})();
