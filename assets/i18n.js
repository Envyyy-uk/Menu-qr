/* ==========================================================================
   Локалізація інтерфейсу — uk / en / ru.

   Тут лише інтерфейс. Назви позицій і варіантів не перекладаються: гість
   замовляє їх так, як надруковано в меню. Опис, категорії та склад беруться
   з каталогу (data/menu.json) вже трьома мовами.
   ========================================================================== */

const LANGS = [
  { code: 'uk', label: 'Українська', short: 'UA' },
  { code: 'en', label: 'English',    short: 'EN' },
  { code: 'ru', label: 'Русский',    short: 'RU' }
];

const I18N = {
  'menu.title':    { uk: 'Меню напоїв',      en: 'Drinks menu',       ru: 'Меню напитков' },
  'brand.sub':     { uk: 'Бар і кальяни · Лондон', en: 'Bar and hookah · London', ru: 'Бар и кальяны · Лондон' },

  'lang.label':    { uk: 'Мова',             en: 'Language',          ru: 'Язык' },
  'nav.label':     { uk: 'Розділи',          en: 'Sections',          ru: 'Разделы' },
  'nav.all':       { uk: 'Усе',              en: 'All',               ru: 'Всё' },
  'ui.top':        { uk: 'Нагору',           en: 'Back to top',       ru: 'Наверх' },

  'tb.search':     { uk: 'Пошук за назвою або складником',
                     en: 'Search by name or ingredient',
                     ru: 'Поиск по названию или ингредиенту' },
  'tb.clear':      { uk: 'Очистити',         en: 'Clear',             ru: 'Очистить' },
  'count.items':   { uk: 'позицій',          en: 'items',             ru: 'позиций' },
  'search.empty':  { uk: 'Нічого не знайдено. Спробуйте іншу мову або інший складник.',
                     en: 'Nothing found. Try another language or another ingredient.',
                     ru: 'Ничего не найдено. Попробуйте другой язык или другой ингредиент.' },

  'dish.ingredients': { uk: 'Склад',         en: 'Ingredients',       ru: 'Состав' },
  'price.from':    { uk: 'від',              en: 'from',              ru: 'от' },

  /* Підписи груп варіантів. Самі варіанти лишаються як у друкованому меню. */
  'opt.size':      { uk: 'Обʼєм',            en: 'Size',              ru: 'Объём' },
  'opt.flavour':   { uk: 'Смак',             en: 'Flavour',           ru: 'Вкус' },
  'opt.milk':      { uk: 'Молоко',           en: 'Milk',              ru: 'Молоко' },
  'opt.kind':      { uk: 'Вид',              en: 'Kind',              ru: 'Вид' },
  'opt.serve':     { uk: 'Подача',           en: 'Serve',             ru: 'Подача' },
  'opt.style':     { uk: 'Стиль',            en: 'Style',             ru: 'Стиль' },
  'opt.allSizes':  { uk: 'усі обʼєми',       en: 'all sizes',         ru: 'все объёмы' },

  'note.mixers':   { uk: 'Ціна пляшки включає два мікси на вибір. Мікс до міцного — £3.',
                     en: 'Bottle price includes two mixers of your choice. Mixer for spirits — £3.',
                     ru: 'Цена бутылки включает два микса на выбор. Микс к крепкому — £3.' },

  'badge.age':     { uk: '18+',              en: '18+',               ru: '18+' },

  'foot.age':      { uk: 'Алкоголь і тютюн — лише повнолітнім. Бармен може попросити документ.',
                     en: 'Alcohol and tobacco are served to over-18s only. The bar may ask for ID.',
                     ru: 'Алкоголь и табак — только совершеннолетним. Бармен может попросить документ.' },
  'foot.prices':   { uk: 'Ціни у фунтах стерлінгів. Меню довідкове — замовлення приймає офіціант.',
                     en: 'Prices are in pounds sterling. The menu is for reference — your server takes the order.',
                     ru: 'Цены в фунтах стерлингов. Меню справочное — заказ принимает официант.' }
};

const LANG_STORAGE_KEY = 'menu-lang';

/** Мова: ?lang= → збережений вибір → мова браузера → en */
function getLang() {
  const url = new URLSearchParams(location.search).get('lang');
  if (url && LANGS.some(l => l.code === url)) return url;
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && LANGS.some(l => l.code === saved)) return saved;
  } catch (e) { /* приватний режим */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.some(l => l.code === nav) ? nav : 'en';
}

function setLang(code) {
  try { localStorage.setItem(LANG_STORAGE_KEY, code); } catch (e) { /* ігноруємо */ }
}

/** t('tb.search') — рядок поточною мовою, з відкатом на англійську */
function t(key, lang) {
  const entry = I18N[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}

/** Багатомовне поле з каталогу: { uk: '…', en: '…' } → рядок */
function pick(field, lang) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.en || Object.values(field)[0] || '';
}
