/* ==========================================================================
   Покращення, а не основа. Меню вже в HTML і читається без цього файлу:
   мова — окремі сторінки, розділи — звичайні якорі, обʼєми — <details>.
   Скрипт додає пошук, підсвітку розділу, памʼять про мову й перехід між
   мовами без втрати місця читання.
   ========================================================================== */
(function () {
  'use strict';

  var LANGS = ['ru', 'en', 'uk'];
  var STORAGE_KEY = 'menu-lang';
  var LANG = document.body.getAttribute('data-lang');
  var STEM = document.body.getAttribute('data-stem');

  document.documentElement.className += ' js';

  function barHeight() {
    var bar = document.querySelector('.topbar');
    return bar ? bar.getBoundingClientRect().height : 100;
  }

  /* ------------------------------------------------------------- мова --- */
  /* Сторінка кожної мови окрема, тож перемикач — звичайні посилання. Скрипту
     лишається памʼять: запамʼятати вибір і на наступному заході відкрити ту
     саму мову. Мову браузера навмисно не питаємо — основна мова меню
     російська, і сторінка має відкриватися нею, поки гість не перемкнув. */
  function stored() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      return LANGS.indexOf(saved) > -1 ? saved : null;
    } catch (err) { return null; }
  }

  function remember(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (err) { /* ігноруємо */ }
  }

  var links = [].slice.call(document.querySelectorAll('.lang[data-lang]'));

  links.forEach(function (link) {
    link.addEventListener('click', function () {
      remember(link.getAttribute('data-lang'));
      /* Місце читання переносимо разом із мовою: розділи на всіх сторінках
         звуться однаково, тож досить передати поточний якір. */
      var here = currentSection();
      if (here) link.href = link.getAttribute('href').split('#')[0] + '#cat-' + here;
    });
  });

  var want = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
  if (LANGS.indexOf(want) === -1) want = stored();

  if (want && want !== LANG) {
    var twin = links.filter(function (l) { return l.getAttribute('data-lang') === want; })[0];
    if (twin) {
      remember(want);
      location.replace(twin.getAttribute('href') + location.hash);
      return;
    }
  }
  if (want === LANG) remember(LANG);

  /* ------------------------------------------------------------ пошук --- */
  function fold(text) {
    return (text || '').toLowerCase().replace(/ё/g, 'е').replace(/['’`]/g, 'ʼ').trim();
  }

  /* «1 позиція», «2 позиції», «5 позицій» — форми числа беремо зі сторінки,
     щоб мови жили в даних, а не в скрипті. */
  function countText(n, box) {
    var forms = (box.getAttribute('data-forms') || '').split('|');
    if (forms.length < 3) return n + ' ' + forms[0];
    if (box.getAttribute('data-lang') === 'en') return n + ' ' + (n === 1 ? forms[0] : forms[1]);
    var tens = n % 100, unit = n % 10;
    if (unit === 1 && tens !== 11) return n + ' ' + forms[0];
    if (unit >= 2 && unit <= 4 && (tens < 12 || tens > 14)) return n + ' ' + forms[1];
    return n + ' ' + forms[2];
  }

  var sections = [].slice.call(document.querySelectorAll('.section'));
  var chips = [].slice.call(document.querySelectorAll('.chip[data-cat]'));

  function wireSearch() {
    var input = document.querySelector('.field input');
    var clear = document.querySelector('.field__clear');
    var count = document.querySelector('.toolbar__count');
    var empty = document.querySelector('.empty');
    var items = [].slice.call(document.querySelectorAll('.item'));
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
        section.hidden = !section.querySelector('.item:not([hidden])');
        /* Спільна примітка розділу стосується всього розділу, а не знахідки —
           під час пошуку вона тільки заважає читати результат. */
        var note = section.querySelector('.note');
        if (note) note.hidden = !!query;
      });

      chips.forEach(function (chip) {
        var section = document.getElementById('cat-' + chip.getAttribute('data-cat'));
        chip.hidden = !section || section.hidden;
      });

      if (count) count.textContent = countText(shown, count);
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
  var active = '';

  /* Розділ, який гість зараз читає. Запас у 60 px — це висота заголовка:
     одразу після переходу до розділу його заголовок стоїть трохи нижче
     панелі, і без запасу поточним вважався б попередній розділ. */
  function currentSection() {
    var edge = barHeight() + 60;
    var found = '';
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= edge) {
        found = section.id.replace('cat-', '');
      }
    });
    return found || active;
  }

  function wireSpy() {
    if (!sections.length || !chips.length || !window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        active = entry.target.id.replace('cat-', '');
        chips.forEach(function (chip) {
          var on = chip.getAttribute('data-cat') === active;
          chip.classList.toggle('is-active', on);
          if (on) chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { observer.observe(section); });
  }

  wireSearch();
  wireSpy();

  /* ------------------------------------------------- свіжість меню --- */
  /* Сторінка, додана на екран «Домів», живе в кеші телефона: оновити її
     нічим — адресного рядка немає. Тому вона сама звіряє свій відбиток із
     version.json і, якщо меню змінилося, перезавантажується з новою адресою:
     інакше з кешу приїхала б та сама стара сторінка. */
  function checkFresh() {
    var meta = document.querySelector('meta[name="build"]');
    if (!meta || document.hidden) return;

    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (fresh) {
        if (!fresh.build || fresh.build === meta.content) return;

        /* Якщо ми вже прийшли по цю саме версію, а сторінка все одно стара —
           значить, публікація ще в дорозі. Перезавантажувати вдруге не можна:
           вийде безкінечне коло. */
        var url = new URL(location.href);
        if (url.searchParams.get('v') === fresh.build) return;

        url.searchParams.set('v', fresh.build);
        location.replace(url.toString());
      })
      .catch(function () { /* немає звʼязку — показуємо що є */ });
  }

  checkFresh();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkFresh();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) checkFresh(); });
}());
