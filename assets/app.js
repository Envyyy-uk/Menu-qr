/* ==========================================================================
   Покращення, а не основа. Меню вже в HTML і читається без цього файлу:
   мова перемикається на CSS, розділи — звичайні якорі, обʼєми — <details>.
   Скрипт додає пошук, підсвітку поточного розділу й памʼять про мову.
   ========================================================================== */
(function () {
  'use strict';

  var LANGS = ['ru', 'en', 'uk'];
  var STORAGE_KEY = 'menu-lang';
  /* Висоту панелі питаємо в неї самої: вона залежить від відступу під
     системний рядок, а той у кожного пристрою свій. */
  function barHeight() {
    var bar = document.querySelector('.topbar');
    return bar ? bar.getBoundingClientRect().height : 100;
  }

  document.documentElement.className += ' js';

  /* ------------------------------------------------------------- мова --- */
  /* Мову беремо тільки з посилання або з попереднього вибору гостя. Мову
     браузера навмисно не питаємо: основна мова меню — російська, і сторінка
     має відкриватися нею, поки гість сам не перемкнув. */
  function savedLang() {
    var url = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
    if (LANGS.indexOf(url) > -1) return url;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.indexOf(saved) > -1) return saved;
    } catch (err) { /* приватний режим */ }
    return null;
  }

  function applyLang(code) {
    var radio = document.getElementById('lang-' + code);
    if (radio) radio.checked = true;
    document.documentElement.lang = code;
  }

  /* Місце в меню при зміні мови. Сторінки трьох мов різної висоти, тож без
     цього гість, перемкнувши мову посеред вина, опинявся десь у коктейлях. */
  function anchorNow() {
    var bar = barHeight();
    var page = document.querySelector('.page:not([hidden])');
    var visible = [].slice.call(document.querySelectorAll('.page')).filter(function (el) {
      return el.offsetParent !== null;
    })[0] || page;
    if (!visible) return null;
    var found = null;
    [].slice.call(visible.querySelectorAll('.section')).forEach(function (section) {
      var top = section.getBoundingClientRect().top;
      if (top <= bar + 1) found = { cat: section.id.replace(/^.*cat-/, ''), top: top };
    });
    return found;
  }

  function restore(anchor, code) {
    if (!anchor) return;
    var section = document.getElementById(code + '-cat-' + anchor.cat);
    if (!section) return;
    window.scrollBy(0, Math.round(section.getBoundingClientRect().top - anchor.top));
  }

  LANGS.forEach(function (code) {
    var radio = document.getElementById('lang-' + code);
    if (!radio) return;
    var anchor = null;
    [].slice.call(document.querySelectorAll('.lang[for="lang-' + code + '"]')).forEach(function (label) {
      label.addEventListener('pointerdown', function () { anchor = anchorNow(); });
    });
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      document.documentElement.lang = code;
      restore(anchor, code);
      try { localStorage.setItem(STORAGE_KEY, code); } catch (err) { /* ігноруємо */ }
    });
  });

  var start = savedLang();
  if (start) applyLang(start);

  /* ------------------------------------------------------------ пошук --- */
  function fold(text) {
    return (text || '').toLowerCase().replace(/ё/g, 'е').replace(/['’`]/g, 'ʼ').trim();
  }

  /* Стрічка розділів живе в нижній панелі, тож шукаємо її за мовою сторінки */
  function chipsOf(page) {
    var box = document.getElementById('chips-' + page.getAttribute('lang'));
    return box ? [].slice.call(box.querySelectorAll('.chip[data-cat]')) : [];
  }

  function wireSearch(page) {
    var input = page.querySelector('.field input');
    var clear = page.querySelector('.field__clear');
    var count = page.querySelector('.toolbar__count');
    var empty = page.querySelector('.empty');
    var sections = [].slice.call(page.querySelectorAll('.section'));
    var items = [].slice.call(page.querySelectorAll('.item'));
    if (!input) return;

    function filter() {
      var query = fold(input.value);
      var shown = 0;

      items.forEach(function (item) {
        var hit = !query || item.getAttribute('data-search').indexOf(query) > -1;
        item.hidden = !hit;
        if (hit) shown++;
      });

      sections.forEach(function (section) {
        var any = section.querySelector('.item:not([hidden])');
        section.hidden = !any;
        /* Спільна примітка розділу стосується всього розділу, а не знахідки —
           під час пошуку вона тільки заважає читати результат. */
        var note = section.querySelector('.note');
        if (note) note.hidden = !!query;
      });

      chipsOf(page).forEach(function (chip) {
        var section = page.querySelector('.section[id$="cat-' + chip.getAttribute('data-cat') + '"]');
        chip.hidden = !section || section.hidden;
      });

      if (count) count.textContent = shown + ' ' + count.getAttribute('data-unit');
      if (empty) empty.hidden = shown > 0;
      if (clear) clear.hidden = !input.value;
    }

    input.addEventListener('input', filter);
    clear.addEventListener('click', function () {
      input.value = '';
      filter();
      input.focus();
    });
    filter();
  }

  /* -------------------------------------------- підсвітка розділу --- */
  function wireSpy(page) {
    var sections = [].slice.call(page.querySelectorAll('.section'));
    var chips = chipsOf(page);
    if (!sections.length || !chips.length || !window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = entry.target.id.replace(/^.*cat-/, '');
        chips.forEach(function (chip) {
          var on = chip.getAttribute('data-cat') === active;
          chip.classList.toggle('is-active', on);
          if (on) chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { observer.observe(section); });
  }

  [].slice.call(document.querySelectorAll('.page')).forEach(function (page) {
    wireSearch(page);
    wireSpy(page);
  });
}());
