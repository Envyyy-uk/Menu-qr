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

  /* Пошуковий запит їде разом із мовою: слово в адресі, а не в памʼяті, бо
     сторінка іншої мови — окремий файл і починає з чистого аркуша. */
  function param(name) {
    var hit = location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    if (!hit) return '';
    try { return decodeURIComponent(hit[1].replace(/\+/g, ' ')); } catch (err) { return ''; }
  }

  var asked = param('q');

  function langHref(link) {
    var base = link.getAttribute('href').split('#')[0].split('?')[0];
    /* Поки в пошуку щось написано, гість читає не розділ, а знахідки: якір
       розділу відніс би його казна-куди, тож несемо сам запит і лишаємо
       гостя вгорі результатів. */
    var input = document.querySelector('.field input');
    var typed = input ? input.value.trim() : '';
    if (typed) return base + '?q=' + encodeURIComponent(typed);
    var here = currentSection();
    return here ? base + '#cat-' + here : base;
  }

  var links = [].slice.call(document.querySelectorAll('.lang[data-lang]'));

  links.forEach(function (link) {
    link.addEventListener('click', function () {
      remember(link.getAttribute('data-lang'));
      link.href = langHref(link);
    });
  });

  var want = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
  if (LANGS.indexOf(want) === -1) want = stored();

  if (want && want !== LANG) {
    var twin = links.filter(function (l) { return l.getAttribute('data-lang') === want; })[0];
    if (twin) {
      remember(want);
      var to = twin.getAttribute('href').split('#')[0].split('?')[0];
      if (asked) to += '?q=' + encodeURIComponent(asked);
      location.replace(to + location.hash);
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

    if (asked) input.value = asked;

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
      /* Схований пошуком розділ не має розмірів, і його верх — нуль: без цієї
         перевірки поточним вважався б останній схований, тобто самий низ меню. */
      if (section.hidden || !section.offsetParent) return;
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

  /* ----------------------------------------------------------- нагору --- */
  function wireTop() {
    var button = document.querySelector('.totop');
    if (!button) return;

    /* Півтора екрана — стільки, щоб кнопка не мигтіла на перших рядках, але
       вже стояла напоготові, коли гість справді пішов углиб меню. */
    var deep = false;

    function look() {
      var now = window.pageYOffset > window.innerHeight * 1.5;
      if (now === deep) return;
      deep = now;
      button.classList.toggle('is-on', deep);
    }

    /* Фокус на пошук навмисно не ставимо: на телефоні це підняло б
       клавіатуру, а гість просто хотів повернутися до початку. */
    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', look, { passive: true });
    look();
  }

  /* ----------------------------------------------------------- знижка --- */
  /* У сторінці надруковані обидві ціни: звичайна текстом, знижкова в
     data-promo. Знижка діє завжди, крім вікон повної ціни — щотижневого
     (пʼятниця 12:00 → неділя 9:00) і разових за датами. Розклад лежить у
     сторінці блоком JSON, час у ньому лондонський. */
  var WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function londonNow() {
    /* Час рахуємо за Лондоном, а не за годинником телефона: гість може
       приїхати з іншим поясом, а знижка привʼязана до годинника бару. */
    var d = new Date();
    try {
      var bits = {};
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', weekday: 'short', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).formatToParts(d).forEach(function (part) { bits[part.type] = part.value; });

      var day = WEEK.indexOf(String(bits.weekday).slice(0, 3));
      var hour = Number(bits.hour) % 24;          /* деякі браузери кажуть «24» */
      var minute = Number(bits.minute);
      if (day > -1 && hour >= 0 && minute >= 0) {
        return {
          week: day * 1440 + hour * 60 + minute,
          stamp: bits.year + '-' + bits.month + '-' + bits.day + 'T'
                 + (hour < 10 ? '0' : '') + hour + ':' + bits.minute
        };
      }
    } catch (err) { /* старий браузер — рахуємо за телефоном */ }

    function two(n) { return (n < 10 ? '0' : '') + n; }
    return {
      week: d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes(),
      stamp: d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
             + 'T' + two(d.getHours()) + ':' + two(d.getMinutes())
    };
  }

  /* Вікно може переходити через кінець тижня: пʼятниця 12:00 → неділя 9:00
     починається пізно ввечері тижня й закінчується вже на його початку. */
  function inWeekWindow(minute, from, to) {
    return from <= to ? (minute >= from && minute < to)
                      : (minute >= from || minute < to);
  }

  function wirePromo() {
    var box = document.getElementById('promo');
    var note = document.querySelector('.promo');
    if (!box) return;

    var plan;
    try { plan = JSON.parse(box.textContent); } catch (err) { return; }

    var now = londonNow();
    var full = null;

    (plan['except'] || []).forEach(function (w) {
      if (!full && now.stamp >= w.from && now.stamp < w.to) full = w;
    });
    if (!full) {
      (plan.full || []).forEach(function (w) {
        if (!full && inWeekWindow(now.week, w.from, w.to)) full = w;
      });
    }

    if (full) {
      /* Повна ціна — надруковані ціни й так правильні. Якщо це разове вікно,
         пояснюємо чому: інакше гість читав би, що знижка мала б діяти. */
      if (note && full.note) note.textContent = full.note;
      return;
    }

    [].slice.call(document.querySelectorAll('[data-promo]')).forEach(function (node) {
      node.textContent = node.getAttribute('data-promo');
    });
    if (note) {
      var on = note.getAttribute('data-today');
      if (on) note.textContent = on;
      note.className = 'promo is-on';
    }
  }

  wireSearch();
  wireSpy();
  wireTop();
  wirePromo();

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
