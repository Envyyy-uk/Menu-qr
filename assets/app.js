/* ==========================================================================
   Покращення, а не основа. Меню вже в HTML і читається без цього файлу:
   мова перемикається на CSS, розділи — звичайні якорі, обʼєми — <details>.
   Скрипт додає пошук, підсвітку поточного розділу й памʼять про мову.
   ========================================================================== */
(function () {
  'use strict';

  var LANGS = ['uk', 'en', 'ru'];
  var STORAGE_KEY = 'menu-lang';

  document.documentElement.className += ' js';

  /* ------------------------------------------------------------- мова --- */
  function savedLang() {
    var url = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
    if (LANGS.indexOf(url) > -1) return url;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.indexOf(saved) > -1) return saved;
    } catch (err) { /* приватний режим */ }
    var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) > -1 ? nav : null;
  }

  function applyLang(code) {
    var radio = document.getElementById('lang-' + code);
    if (radio) radio.checked = true;
    document.documentElement.lang = code;
  }

  LANGS.forEach(function (code) {
    var radio = document.getElementById('lang-' + code);
    if (!radio) return;
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      document.documentElement.lang = code;
      try { localStorage.setItem(STORAGE_KEY, code); } catch (err) { /* ігноруємо */ }
    });
  });

  var start = savedLang();
  if (start) applyLang(start);

  /* ------------------------------------------------------------ пошук --- */
  function fold(text) {
    return (text || '').toLowerCase().replace(/ё/g, 'е').replace(/['’`]/g, 'ʼ').trim();
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

      page.querySelectorAll('.chip').forEach(function (chip) {
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
    if (!sections.length || !window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = entry.target.id.replace(/^.*cat-/, '');
        page.querySelectorAll('.chip').forEach(function (chip) {
          var on = chip.getAttribute('data-cat') === active;
          chip.className = on ? 'chip is-active' : 'chip';
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

  /* ----------------------------------------------------------- нагору --- */
  var totop = document.querySelector('.totop');
  if (totop) {
    var onScroll = function () { totop.hidden = window.pageYOffset < 600; };
    window.addEventListener('scroll', onScroll);
    onScroll();
  }
}());
