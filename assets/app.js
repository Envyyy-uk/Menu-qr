/* ==========================================================================
   Сторінка меню. Без сервера: увесь каталог уже в MENU_DATA, сторінка лише
   малює його трьома мовами, шукає й гортає.
   ========================================================================== */

let LANG = getLang();
let QUERY = '';
let ACTIVE = '';           // ключ активної категорії у стрічці розділів

const $  = sel => document.querySelector(sel);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

/* --------------------------------------------------------------- гроші --- */
/* Ціна — надрукований факт: гість платить £13 незалежно від мови, тому фунт
   форматуємо по-британськи. Круглі суми лишаємо без «.00». */
function money(pence) {
  const value = (pence || 0) / 100;
  const text = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: MENU_DATA.venue.currency || 'GBP'
  }).format(value);
  return text.replace(/\.00$/, '');
}

/* --------------------------------------------------------------- пошук --- */
const fold = s => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[’'`]/g, 'ʼ').trim();

/** Усе, за чим позицію можна знайти — трьома мовами одразу. */
function haystack(item) {
  const parts = [item.name, ...Object.values(item.desc || {})];
  (item.ing || []).forEach(key => {
    const word = MENU_DATA.lexicon[key];
    if (word) parts.push(...Object.values(word));
    else parts.push(key);
  });
  (item.options || []).forEach(opt => {
    parts.push(t(opt.label, LANG));
    (opt.choices || []).forEach(ch => parts.push(ch.name));
  });
  const cat = MENU_DATA.categories.find(c => c.key === item.category);
  if (cat) parts.push(...Object.values(cat.names));
  return fold(parts.join(' '));
}

const matches = item => !QUERY || haystack(item).includes(QUERY);

/* ---------------------------------------------------------------- опис --- */
/* У каталозі опис міцного має вигляд «Горілка · Мікс до міцного — £3…»:
   перша частина — про саму позицію, друга однакова для всього розділу.
   Спільний хвіст показуємо один раз рамкою під заголовком розділу, як у
   друкованому меню, а не тридцять разів у кожній картці. */
function splitDesc(item) {
  const text = pick(item.desc, LANG);
  const at = text.indexOf(' · ');
  return at === -1
    ? { head: text, tail: '' }
    : { head: text.slice(0, at), tail: text.slice(at + 3) };
}

function sharedNote(items) {
  const tails = items.map(i => splitDesc(i).tail).filter(Boolean);
  if (tails.length < 2) return '';
  return tails.every(x => x === tails[0]) ? tails[0] : '';
}

/* ------------------------------------------------------------ варіанти --- */
/* Обʼєми міцного йдуть драбинкою 50→300 мл, і в друкованому меню її не
   друкують: там «£13 | Bottle £230». Показуємо перший обʼєм і пляшки, решту
   ховаємо під «усі обʼєми» — ціни лишаються всі, просто не кричать. */
const ML_STEP = /^\d+\s*ml$/i;

function splitChoices(opt) {
  const choices = opt.choices || [];
  if (opt.key !== 'size') return { visible: choices, hidden: [] };
  const steps = choices.filter(c => ML_STEP.test(c.name));
  if (steps.length < 3) return { visible: choices, hidden: [] };
  const rest = choices.filter(c => !ML_STEP.test(c.name));
  return { visible: [steps[0], ...rest], hidden: steps.slice(1) };
}

/* Пробіли між варіантами — не прикраса: без них рядок нема де перенести. */
function fillChoices(box, choices) {
  choices.forEach((ch, i) => {
    if (i) box.append(' ', el('span', 'sep', '·'), ' ');
    const chip = el('span', 'choice');
    chip.append(el('span', 'choice__name', ch.name));
    if (ch.price_pence) chip.append(' ', el('span', 'choice__price', money(ch.price_pence)));
    box.append(chip);
  });
}

/* -------------------------------------------------------------- картка --- */
function itemNode(item, note) {
  const node = el('article', 'item');

  const head = el('div', 'item__head');
  const name = el('h3', 'item__name', item.name);
  if ((item.w || []).length) {
    const badge = el('span', 'badge', t('badge.age', LANG));
    badge.title = pick(MENU_DATA.warnings[item.w[0]], LANG);
    name.append(' ', badge);
  }
  head.append(name);

  const sizes = (item.options || []).find(o => o.key === 'size');
  const priced = sizes ? (sizes.choices || []).filter(c => c.price_pence) : [];
  const price = el('p', 'item__price');
  if (priced.length > 1) {
    price.append(el('span', 'item__from', t('price.from', LANG)), ' ');
  }
  price.append(money(item.price_pence));
  head.append(price);
  node.append(head);

  const { head: desc, tail } = splitDesc(item);
  const text = note && tail === note ? desc : [desc, tail].filter(Boolean).join(' · ');
  if (text) node.append(el('p', 'item__desc', text));

  (item.options || []).forEach(opt => {
    const line = el('div', 'item__opt');
    line.append(el('span', 'item__optLabel', t(opt.label, LANG) + ':'), ' ');

    const { visible, hidden } = splitChoices(opt);
    fillChoices(line, visible);
    if (hidden.length) {
      const more = el('details', 'more');
      more.append(el('summary', 'more__summary', t('opt.allSizes', LANG)));
      const all = el('div', 'more__list');
      fillChoices(all, opt.choices);
      more.append(all);
      line.append(more);
    }
    node.append(line);
  });

  const ing = (item.ing || [])
    .map(key => pick(MENU_DATA.lexicon[key], LANG) || key)
    .join(', ');
  if (ing) {
    const line = el('p', 'item__ing');
    line.append(el('span', 'item__ingLabel', t('dish.ingredients', LANG) + ':'), ' ' + ing);
    node.append(line);
  }

  return node;
}

/* ------------------------------------------------------------ малюємо --- */
function render() {
  document.documentElement.lang = LANG;
  document.title = `${MENU_DATA.venue.name} · ${t('menu.title', LANG)}`;

  $('#menu-title').textContent = t('menu.title', LANG);
  $('#menu-sub').textContent   = t('brand.sub', LANG);
  $('#foot-age').textContent   = t('foot.age', LANG);
  $('#foot-prices').textContent = t('foot.prices', LANG);
  $('#search').placeholder     = t('tb.search', LANG);
  $('#search').setAttribute('aria-label', t('tb.search', LANG));
  $('#search-clear').title     = t('tb.clear', LANG);
  $('#totop').title            = t('ui.top', LANG);

  const menu = $('#menu');
  menu.textContent = '';

  let shown = 0;
  const visibleCats = [];

  MENU_DATA.categories.forEach(cat => {
    const all = MENU_DATA.items.filter(i => i.category === cat.key);
    const items = all.filter(matches);
    if (!items.length) return;

    visibleCats.push(cat);
    shown += items.length;

    const section = el('section', 'section');
    section.id = 'cat-' + cat.key;

    const header = el('header', 'section__head');
    header.append(el('h2', 'section__title', pick(cat.names, LANG)));
    section.append(header);

    const note = sharedNote(all);
    if (note && !QUERY) section.append(el('p', 'note', note));

    const list = el('div', 'section__items');
    items.forEach(item => list.append(itemNode(item, note)));
    section.append(list);

    menu.append(section);
  });

  $('#empty').textContent = t('search.empty', LANG);
  $('#empty').hidden = shown > 0;
  $('#count').textContent = `${shown} ${t('count.items', LANG)}`;

  renderChips(visibleCats);
  observeSections();
}

function renderChips(cats) {
  const box = $('#chips');
  box.textContent = '';
  box.setAttribute('aria-label', t('nav.label', LANG));
  cats.forEach(cat => {
    const link = el('a', 'chip', pick(cat.names, LANG));
    link.href = '#cat-' + cat.key;
    link.dataset.cat = cat.key;
    if (cat.key === ACTIVE) link.classList.add('is-active');
    box.append(link);
  });
}

function renderLangs() {
  const box = $('#langs');
  box.textContent = '';
  LANGS.forEach(lang => {
    const button = el('button', 'lang', lang.short);
    button.type = 'button';
    button.title = lang.label;
    button.setAttribute('aria-pressed', String(lang.code === LANG));
    if (lang.code === LANG) button.classList.add('is-active');
    button.addEventListener('click', () => {
      if (lang.code === LANG) return;
      LANG = lang.code;
      setLang(LANG);
      renderLangs();
      render();
    });
    box.append(button);
  });
}

/* --------------------------------------------------- активний розділ --- */
let observer = null;

function observeSections() {
  if (observer) observer.disconnect();
  const sections = [...document.querySelectorAll('.section')];
  if (!sections.length) return;

  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      ACTIVE = entry.target.id.replace('cat-', '');
      document.querySelectorAll('.chip').forEach(chip => {
        const on = chip.dataset.cat === ACTIVE;
        chip.classList.toggle('is-active', on);
        if (on) chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  sections.forEach(section => observer.observe(section));
}

/* ---------------------------------------------------------------- старт -- */
function init() {
  renderLangs();
  render();

  const search = $('#search');
  const clear = $('#search-clear');

  search.addEventListener('input', () => {
    QUERY = fold(search.value);
    clear.hidden = !search.value;
    render();
  });
  clear.addEventListener('click', () => {
    search.value = '';
    QUERY = '';
    clear.hidden = true;
    search.focus();
    render();
  });

  const totop = $('#totop');
  const onScroll = () => { totop.hidden = window.scrollY < 600; };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

init();
