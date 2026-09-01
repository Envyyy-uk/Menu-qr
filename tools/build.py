#!/usr/bin/env python3
"""Збирає сторінки меню: головну й по одній на кухню, бар і кальяни.

Меню за QR читають у чому завгодно: у вбудованому переглядачі месенджера, у
режимі економії трафіку, зі стареньким телефоном. Тому позиції не малюються
скриптом, а лежать у HTML готовими, а перемикач мов працює на CSS: три копії
меню в одному файлі, показує ту, чия радіокнопка обрана. Скрипт додає лише
пошук і підсвітку розділу — без нього меню все одно читається повністю.

Стилі й скрипт вшиваються в кожну сторінку: один запит, працює офлайн.

Запуск після будь-якої правки меню:  python3 tools/build.py
"""

import hashlib
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MENU = json.loads((ROOT / "data" / "menu.json").read_text(encoding="utf-8"))
UI = json.loads((ROOT / "data" / "ui.json").read_text(encoding="utf-8"))
CSS = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
JS = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")

# Порядок тут — це порядок кнопок у шапці, а перша мова ще й та, яку бачить
# гість, поки нічого не обрав.
LANGS = [("ru", "RU", "Русский"), ("en", "EN", "English"), ("uk", "UA", "Українська")]
DEFAULT_LANG = LANGS[0][0]

ML_STEP = re.compile(r"^\d+\s*ml$", re.I)


def stamp():
    """Відбиток вмісту сайту.

    Сторінку, додану на екран «Домів», телефон тримає в кеші й сам її не
    перепитує: адресного рядка там немає, тож гість дивиться вчорашнє меню й
    не здогадується про це. Тому кожна сторінка знає свій відбиток, а поруч
    лежить version.json із поточним — сторінка звіряє їх і оновлюється сама.

    Рахуємо саме від вмісту, а не від часу збірки: інакше відбиток мінявся б
    щоразу й сторінки перезавантажувалися б на порожньому місці.
    """
    digest = hashlib.sha256()
    for path in [ROOT / "data" / "menu.json", ROOT / "data" / "ui.json",
                 ROOT / "assets" / "styles.css", ROOT / "assets" / "app.js"]:
        digest.update(path.read_bytes())
    for icon in sorted((ROOT / "assets" / "icons").glob("*.svg")):
        digest.update(icon.read_bytes())
    return digest.hexdigest()[:12]


BUILD = stamp()


def t(key, lang):
    entry = UI.get(key, {})
    return entry.get(lang) or entry.get("en") or key


def pick(field, lang):
    if not field:
        return ""
    if isinstance(field, str):
        return field
    return field.get(lang) or field.get("en") or next(iter(field.values()), "")


def count_text(n, lang):
    """«1 позиція», «2 позиції», «5 позицій» — словʼянські форми числа."""
    forms = UI["count.items"].get(lang) or UI["count.items"]["en"]
    if lang == "en":
        return f"{n} {forms[0] if n == 1 else forms[1]}"
    tens, unit = n % 100, n % 10
    if unit == 1 and tens != 11:
        form = forms[0]
    elif 2 <= unit <= 4 and not 12 <= tens <= 14:
        form = forms[1]
    else:
        form = forms[2]
    return f"{n} {form}"


def e(text):
    return html.escape(str(text), quote=True)


def money(pence):
    """Ціна — надрукований факт: £13 незалежно від мови читача."""
    value = (pence or 0) / 100
    text = f"£{value:,.2f}"
    return text[:-3] if text.endswith(".00") else text


# ------------------------------------------------------------------ знижка --
# З неділі до четверга напої дешевші, а кальян коштує рівно £40. Сервера немає,
# тож у сторінку друкуються обидві ціни: звичайна — текстом, знижкова — в
# data-promo. Скрипт у потрібний день підміняє одну на іншу, а без скрипта
# гість бачить звичайну ціну й примітку з правилом — як у друкованому меню.
# Так сторінка не бреше в жодному з випадків.
PROMO = MENU.get("promo") or {}
RULE = None            # правило меню, яке зараз малюється


def promo_pence(pence, flat=True):
    """Ціна цієї ж позиції в дні знижки. flat=False — для варіантів усередині
    позиції: тверда ціна меню («кальян £40») стосується позиції, а не кожного
    її обʼєму, і на варіанти не переноситься."""
    if not RULE or not pence:
        return None
    if RULE.get("off_percent"):
        return round(pence * (100 - RULE["off_percent"]) / 100)
    if flat and RULE.get("price_pence"):
        return RULE["price_pence"]
    return None


def rule_of(stem):
    return (PROMO.get("menus") or {}).get(stem)


def promo_note(where, lang):
    """Рядок про знижку: текстом — правило, у data-today — те, що скрипт
    покаже в самі дні знижки."""
    block = (PROMO.get("menus") or {}).get(where) or PROMO.get(where) or {}
    note, today = block.get("note"), block.get("today")
    if not note:
        return ""
    extra = f' data-today="{e(pick(today, lang))}"' if today else ""
    return f'<p class="promo"{extra}>{e(pick(note, lang))}</p>'


def price_html(pence, flat=True, promo=None):
    """Ціна разом зі своєю знижковою парою. `promo` — ціна, прописана в самій
    позиції: сигарний лист коштує £55, а в години знижки £50, і тверда ціна
    меню («кальян £40») до нього не стосується."""
    cut = promo if promo is not None else promo_pence(pence, flat)
    tag = f' data-promo="{e(money(cut))}"' if cut and cut != pence else ""
    return f"<span{tag}>{e(money(pence))}</span>"


# --------------------------------------------------------------------- опис --
# У каталозі опис міцного має вигляд «Горілка · Мікс до міцного — £3…»: перша
# частина про саму позицію, друга однакова для всього розділу. Спільний хвіст
# показуємо один раз рамкою під заголовком, як у друкованому меню.
def split_desc(item, lang):
    text = pick(item.get("desc"), lang)
    head, sep, tail = text.partition(" · ")
    return (head, tail) if sep else (text, "")


def shared_note(items, lang):
    tails = [tail for _, tail in (split_desc(i, lang) for i in items) if tail]
    if len(tails) < 2 or any(x != tails[0] for x in tails):
        return ""
    return tails[0]


# ----------------------------------------------------------------- варіанти --
# Обʼєми міцного йдуть драбинкою 50→300 мл, і в друкованому меню її не друкують:
# там «£13 | Bottle £230». Показуємо перший обʼєм і пляшки, решту ховаємо під
# «усі обʼєми» — ціни лишаються всі, просто не кричать.
def split_choices(opt):
    choices = opt.get("choices") or []
    if opt.get("key") != "size":
        return choices, []
    steps = [c for c in choices if ML_STEP.match(choice_name(c, "en"))]
    if len(steps) < 3:
        return choices, []
    rest = [c for c in choices if not ML_STEP.match(choice_name(c, "en"))]
    return [steps[0]] + rest, steps[1:]


# Назва варіанта буває двох родів. Бренд лишається як надруковано — гість
# замовляє «Tangiers», а не «тангірс». Звичайне слово — смак, обʼєм, молоко —
# перекладається: у меню трьома мовами «Strawberry» посеред російського рядка
# читається як недоробка.
def choice_name(choice, lang):
    name = choice["name"]
    return name if isinstance(name, str) else pick(name, lang)


def choice_names(choice):
    """Усі написання варіанта — для пошуку."""
    name = choice["name"]
    return [name] if isinstance(name, str) else list(name.values())


def choices_html(choices, lang):
    parts = []
    for choice in choices:
        chip = f'<span class="choice__name">{e(choice_name(choice, lang))}</span>'
        if choice.get("price_pence"):
            chip += (' <span class="choice__price">'
                     + price_html(choice["price_pence"], flat=False) + '</span>')
        parts.append(f'<span class="choice">{chip}</span>')
    return ' <span class="sep">·</span> '.join(parts)


# ------------------------------------------------------------------- склад --
# У коктейлі опис — це і є склад: «Джин, вермут россо, Campari, апельсин».
# Друкувати під ним ще й рядок «Склад: джин, вермут россо…» — двічі те саме.
# У міцного інакше: опис каже «Горілка», а склад додає зерновий спирт і воду,
# і це вже нова інформація. Тож рядок складу лишаємо там, де він щось додає:
# рахуємо, яка частка складників уже названа в описі, і зважуємо по трьох
# мовах одразу, щоб сторінки не розходилися між собою.
WORD = re.compile(r"[^\wʼ'’-]+")


def words(text):
    return {w for w in WORD.split((text or "").lower()) if len(w) > 2}


def same_stem(a, b):
    """«журавлина» і «журавлиновий» — те саме; «вино» і «виноград» — ні.

    Відмінок міняє хвіст слова, а не корінь, тож звіряємо спільний початок і
    вимагаємо, щоб слова були близької довжини: інакше під правило потрапляє
    будь-яке слово, що просто починається так само.
    """
    common = 0
    for x, y in zip(a, b):
        if x != y:
            break
        common += 1
    gap = abs(len(a) - len(b))
    return (common >= 5 and gap <= 3) or (common >= 4 and gap <= 1)


def named_in(desc_words, phrase):
    """Чи названий складник в описі. Порівнюємо по початку слова, бо в описі
    воно стоїть в іншій формі: «апельсинова цедра» — це той самий апельсин."""
    for word in words(phrase):
        for seen in desc_words:
            if seen == word or same_stem(seen, word):
                return True
    return False


def ingredients_repeat_desc(item):
    """Рахуємо складники, а не слова: «горький ликёр Campari» — це один
    складник, названий в описі словом «биттер», а не три різні промахи."""
    keys = item.get("ing") or []
    if not keys:
        return True
    covers = []
    for code, _, _ in LANGS:
        desc_words = words(split_desc(item, code)[0])
        named = sum(1 for k in keys
                    if named_in(desc_words, pick(MENU["lexicon"].get(k), code) or k))
        covers.append(named / len(keys))
    return sum(covers) / len(covers) >= 0.5


# -------------------------------------------------------------------- пошук --
def fold(text):
    return text.lower().replace("ё", "е").replace("’", "ʼ").replace("'", "ʼ")


def search_key(item):
    """Усе, за чим позицію шукають, — трьома мовами одразу, готове в атрибуті.

    Разом із полем alt: назви страв надруковані латиницею, як у меню, але
    шукає їх гість звично своєю — «вареники», «мохито», «чизкейк»."""
    parts = [item["name"], *(item.get("desc") or {}).values(), *(item.get("alt") or [])]
    for key in item.get("ing") or []:
        word = MENU["lexicon"].get(key)
        parts += list(word.values()) if word else [key]
    for opt in item.get("options") or []:
        parts += [t(opt["label"], code) for code, _, _ in LANGS]
        for choice in opt.get("choices") or []:
            parts += choice_names(choice)
    for key in item.get("add") or []:
        addon = MENU["addons"].get(key)
        if addon:
            parts += list(addon["names"].values())
    cat = next((c for c in MENU["categories"] if c["key"] == item["category"]), None)
    if cat:
        parts += list(cat["names"].values())
    return fold(" ".join(parts))


# ------------------------------------------------------------------ позиція --
def item_html(item, lang, note):
    out = [f'<article class="item" data-search="{e(search_key(item))}">']

    badge = ""
    for key in item.get("w") or []:
        title = pick(MENU["warnings"].get(key), lang)
        badge = f' <span class="badge" title="{e(title)}">{e(t("badge.age", lang))}</span>'
        break

    sizes = next((o for o in item.get("options") or [] if o["key"] == "size"), None)
    priced = [c for c in (sizes or {}).get("choices", []) if c.get("price_pence")]
    prefix = (f'<span class="item__from">{e(t("price.from", lang))}</span> '
              if len(priced) > 1 else "")

    out.append('<div class="item__head">'
               f'<h3 class="item__name">{e(item["name"])}{badge}</h3>'
               '<p class="item__price">' + prefix
               + price_html(item["price_pence"], promo=item.get("promo_pence"))
               + '</p>'
               '</div>')

    head, tail = split_desc(item, lang)
    desc = head if note and tail == note else " · ".join(x for x in (head, tail) if x)
    if desc:
        # Смак після тире — це вже не склад, а підказка «який він». Світліший
        # тон відділяє їх на око, і рядок не читається суцільною стіною.
        body, dash, taste = desc.partition(" — ")
        line = e(body) + (f' <span class="item__taste">— {e(taste)}</span>' if dash else "")
        out.append(f'<p class="item__desc">{line}</p>')

    for opt in item.get("options") or []:
        visible, hidden = split_choices(opt)
        # Доплата за групу варіантів — біля її назви, а не окремим рядком:
        # «Фруктова чаша +£10» читається як одне правило, а не як ще одна
        # позиція меню.
        extra = (f' <span class="item__add">+{e(money(opt["add_pence"]))}</span>'
                 if opt.get("add_pence") else "")
        line = (f'<span class="item__optLabel">{e(t(opt["label"], lang))}{extra}:</span> '
                + choices_html(visible, lang))
        if hidden:
            line += ('<details class="more">'
                     f'<summary class="more__summary">{e(t("opt.allSizes", lang))}</summary>'
                     f'<div class="more__list">{choices_html(opt["choices"], lang)}</div>'
                     '</details>')
        out.append(f'<div class="item__opt">{line}</div>')

    # Мікс — доплата зверху, а не варіант позиції, тож і показуємо його як
    # доплату: «+£3» біля кожного міцного, а не лише прописом у примітці.
    for key in item.get("add") or []:
        addon = MENU["addons"].get(key)
        if not addon:
            continue
        out.append(f'<div class="item__opt">'
                   f'<span class="item__optLabel">{e(pick(addon["names"], lang))}:</span> '
                   f'<span class="item__add">+{e(money(addon["price_pence"]))}</span></div>')

    ing = ("" if ingredients_repeat_desc(item)
           else ", ".join(pick(MENU["lexicon"].get(k), lang) or k for k in item.get("ing") or []))
    if ing:
        out.append(f'<p class="item__ing">'
                   f'<span class="item__ingLabel">{e(t("dish.ingredients", lang))}:</span> '
                   f'{e(ing)}</p>')

    out.append("</article>")
    return "".join(out)


# ------------------------------------------------------------------ сторінка --
# Меню три: кухня, бар і кальяни. Кожне — окремий файл, а головна лише
# розводить гостя по них: хто прийшов поїсти, не гортає крізь горілку.
#
# Кожна мова — теж окремий файл (bar.html, bar-en.html, bar-uk.html), а
# перемикач мов — звичайні посилання між ними. Спершу три мови лежали в
# одному файлі й перемикалися прихованими радіокнопками, але з кількома
# сторінками це розсипалося: посилання ?lang= без скрипта нічого не робило й
# кожен перехід повертав гостя на російську. Посилання працюють завжди.
MENUS = MENU["menus"]


def menu_categories(menu):
    """Розділи меню — у порядку, заданому в menus, а не в загальному списку."""
    by_key = {c["key"]: c for c in MENU["categories"]}
    return [by_key[k] for k in menu["categories"] if k in by_key]


def on_menu(item):
    """Позиція, яку зараз видно гостю. Вимкнена — та, що закінчилася або ще не
    доведена до ладу: вона лишається в каталозі й в адмінці, але на сторінку
    не потрапляє ні карткою, ні пошуком, ні лічильником. Прибирати її з
    каталогу задля цього довелося б набирати наново."""
    return item.get("state") != "hidden"


def items_in(cat_key):
    return [i for i in MENU["items"] if i["category"] == cat_key and on_menu(i)]


def menu_items(menu):
    keys = set(menu["categories"])
    return [i for i in MENU["items"] if i["category"] in keys and on_menu(i)]


def menu_items_of(menus):
    keys = {k for m in menus for k in m["categories"]}
    return [i for i in MENU["items"] if i["category"] in keys and on_menu(i)]


ICONS = ROOT / "assets" / "icons"


def icon(stem):
    """Іконка меню, вшита в сторінку. Саме вшита, а не <img src>: вони
    намальовані currentColor, тобто беруть колір від тексту поруч, — через
    окремий файл це не працює, та й сторінка перестала б бути самодостатньою.

    Розміри й підпис знімаємо: розмір задає CSS, а назву меню гість і так
    читає поруч, тож для екранного читача іконка — прикраса."""
    path = ICONS / f"{stem}.svg"
    if not path.exists():
        return ""
    svg = path.read_text(encoding="utf-8").strip()
    svg = re.sub(r'\s(width|height|role|aria-label)="[^"]*"', "", svg, count=4)
    svg = re.sub(r"<title>.*?</title>\s*", "", svg, flags=re.S)
    return svg.replace("<svg", '<svg aria-hidden="true" focusable="false"', 1)


def page_file(stem, lang):
    """index.html — основною мовою, index-en.html і index-uk.html — рештою."""
    return f"{stem}.html" if lang == DEFAULT_LANG else f"{stem}-{lang}.html"


def chips_html(lang, menu):
    """Стрічка розділів. Перша фішка веде назад на головну: без неї з меню
    нема куди подітися, крім кнопки «назад» у браузері."""
    chips = [f'<a class="chip chip--back" href="{page_file("index", lang)}">'
             f'← {e(t("nav.back", lang))}</a>']
    for cat in menu_categories(menu):
        # Розділ, у якому всі позиції вимкнені, на сторінці не малюється —
        # фішка вела б у нікуди.
        if not items_in(cat["key"]):
            continue
        chips.append(f'<a class="chip" href="#cat-{cat["key"]}" '
                     f'data-cat="{e(cat["key"])}">{e(pick(cat["names"], lang))}</a>')
    return (f'<nav class="chips" id="chips" '
            f'aria-label="{e(t("nav.label", lang))}">{"".join(chips)}</nav>')


def cards_html(lang):
    """Головна: кухня, бар і кальяни великими картками."""
    global RULE
    cards = []
    for menu in MENUS:
        RULE = rule_of(menu["stem"])
        items = menu_items(menu)
        if not items:
            continue

        # Меню, яке ще не працює, показуємо, але не відкриваємо: гість має
        # знати, що кухня буде, і не має впертися в порожню сторінку.
        # Це <span>, а не сіре посилання: непритискне посилання все одно
        # відкривається довгим натисканням і потрапляє в пошук.
        if menu.get("soon"):
            cards.append(
                f'<span class="card card--soon" aria-disabled="true">'
                f'<span class="card__icon">{icon(menu["stem"])}</span>'
                '<span class="card__text">'
                f'<span class="card__name">{e(pick(menu["names"], lang))}</span>'
                f'<span class="card__meta">{e(t("card.soon", lang))}</span>'
                '</span></span>')
            continue
        prices = [i["price_pence"] for i in items]
        cheapest = min(items, key=lambda i: i["price_pence"])
        cut = cheapest.get("promo_pence")
        # «від £50» там, де ціна одна на все меню, — обіцянка вибору, якого нема
        price = (f'{e(t("price.from", lang))} '
                 + price_html(min(prices), promo=cut)
                 if min(prices) != max(prices)
                 else price_html(prices[0], promo=cut))
        cards.append(
            f'<a class="card" href="{page_file(menu["stem"], lang)}">'
            f'<span class="card__icon">{icon(menu["stem"])}</span>'
            '<span class="card__text">'
            f'<span class="card__name">{e(pick(menu["names"], lang))}</span>'
            f'<span class="card__meta">{e(count_text(len(items), lang))}'
            f' · {price}</span>'
            '</span></a>')
    RULE = None
    return (f'<nav class="cards" aria-label="{e(t("home.pick", lang))}">'
            f'{"".join(cards)}</nav>')


def masthead(lang, title):
    return f"""
  <div class="masthead">
    <div class="rule rule--diamond" aria-hidden="true"></div>
    <h1 class="masthead__title">{e(title)}</h1>
    <div class="rule rule--diamond" aria-hidden="true"></div>
    <p class="masthead__sub">{e(t('brand.sub', lang))}</p>
  </div>"""


def foot(lang):
    return f"""
  <footer class="foot">
    <div class="rule rule--diamond" aria-hidden="true"></div>
    <p>{e(t('foot.age', lang))}</p>
    <p class="foot__fine">{e(t('foot.prices', lang))}</p>
  </footer>"""


def home_body(lang):
    return f"""
{masthead(lang, t('menu.title', lang))}

  <div class="home">
    <p class="home__pick">{e(t('home.pick', lang))}</p>
    {cards_html(lang)}
    {promo_note('home', lang)}
  </div>
{foot(lang)}"""


def menu_body(lang, menu):
    global RULE
    RULE = rule_of(menu["stem"])
    sections = []
    for cat in menu_categories(menu):
        items = items_in(cat["key"])
        if not items:
            continue
        note = shared_note(items, lang)
        body = [f'<section class="section" id="cat-{cat["key"]}">',
                '<header class="section__head">'
                f'<h2 class="section__title">{e(pick(cat["names"], lang))}</h2></header>']
        if note:
            body.append(f'<p class="note">{e(note)}</p>')
        body.append('<div class="section__items">')
        body += [item_html(i, lang, note) for i in items]
        body.append("</div></section>")
        sections.append("".join(body))

    return f"""
{masthead(lang, pick(menu['title'], lang))}

  <div class="toolbar js-only">
    <div class="field">
      <input type="search" autocomplete="off" spellcheck="false"
             placeholder="{e(t('tb.search', lang))}" aria-label="{e(t('tb.search', lang))}">
      <button class="field__clear" type="button" title="{e(t('tb.clear', lang))}" hidden>✕</button>
    </div>
    <p class="toolbar__count"
       data-forms="{e('|'.join(UI['count.items'][lang]))}"
       data-lang="{lang}">{e(count_text(len(menu_items(menu)), lang))}</p>
  </div>

  {promo_note(menu['stem'], lang)}
  <div class="menu">{''.join(sections)}</div>
  <p class="empty" hidden>{e(t('search.empty', lang))}</p>
  <button class="totop js-only" type="button" aria-label="{e(t('ui.top', lang))}"
          title="{e(t('ui.top', lang))}">↑</button>
{foot(lang)}"""


WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]


def minute_of_week(text):
    """«fri 12:00» → хвилина від неділі 00:00. Так вікно порівнюється одним
    числом, навіть коли воно переходить через ніч або через кінець тижня."""
    day, clock = text.split()
    hour, minute = clock.split(":")
    return WEEK.index(day.lower()) * 1440 + int(hour) * 60 + int(minute)


def promo_json(lang):
    """Розклад знижки для скрипта. Дати й час — лондонські: гість може бути з
    іншим поясом, а знижка привʼязана до годинника бару. Без скрипта блок
    просто лежить у сторінці й нічого не робить — ціни надруковані повні."""
    if not PROMO.get("full") and not PROMO.get("except"):
        return ""
    plan = {
        "full": [{"from": minute_of_week(w["from"]), "to": minute_of_week(w["to"])}
                 for w in PROMO.get("full") or []],
        "except": [{"from": w["from"], "to": w["to"],
                    "note": pick(w.get("note"), lang)}
                   for w in PROMO.get("except") or []],
    }
    return ('\n<script type="application/json" id="promo">'
            + json.dumps(plan, ensure_ascii=False).replace("<", "\\u003c")
            + "</script>")


def document(lang, stem, title, body, chips=""):
    # Перемикач мов — посилання на ту саму сторінку іншою мовою.
    switches = "".join(
        f'<a class="lang{" is-active" if code == lang else ""}" '
        f'href="{page_file(stem, code)}" hreflang="{code}" '
        f'title="{e(label)}" data-lang="{code}">{e(short)}</a>'
        for code, short, label in LANGS)
    subbar = (f'<nav class="subbar" aria-label="{e(t("nav.label", lang))}">'
              f'<div class="subbar__inner">{chips}</div></nav>') if chips else ""
    alternates = "".join(
        f'<link rel="alternate" hreflang="{code}" href="{page_file(stem, code)}">'
        for code, _, _ in LANGS)

    return f"""<!doctype html>
<html lang="{lang}" class="{'has-chips' if chips else 'no-chips'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="theme-color" content="#1d1a16">
<meta name="build" content="{BUILD}">
<link rel="manifest" href="site.webmanifest">
<link rel="apple-touch-icon" href="assets/icons/app-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Menu">
<meta name="description" content="{e(title)}">
{alternates}
<!-- Сторінку згенеровано: python3 tools/build.py. Правки — у data/ і assets/. -->
<style>
{CSS}
</style>
</head>
<body data-stem="{stem}" data-lang="{lang}">{promo_json(lang)}

<!-- Панель прикріплена до верху: меню проходить під нею, вона не рухається. -->
<div class="topbar">
  <header class="site">
    <div class="site__bar">
      <a class="mark" href="{page_file('index', lang)}" title="{e(t('nav.back', lang))}"
         aria-label="{e(t('nav.back', lang))}">MENU</a>
      <nav class="langs" aria-label="{e(t('lang.label', lang))}">{switches}</nav>
    </div>
  </header>
  {subbar}
</div>

<main class="sheet" id="top">
  <div class="sheet__inner">
  <div class="page" lang="{lang}">
{body}
  </div>
  </div>
</main>

<script>
{JS}
</script>
</body>
</html>
"""


def main():
    written = []

    for code, _, _ in LANGS:
        written.append((page_file("index", code),
                        document(code, "index", t("menu.title", code), home_body(code))))
        for menu in MENUS:
            if menu.get("soon"):
                continue
            written.append((page_file(menu["stem"], code),
                            document(code, menu["stem"], pick(menu["title"], code),
                                     menu_body(code, menu), chips_html(code, menu))))

    # Сторінки меню, яке щойно закрили, прибираємо: інакше вони лишаться в
    # репозиторії й відкриються за прямим посиланням.
    for menu in MENUS:
        if not menu.get("soon"):
            continue
        for code, _, _ in LANGS:
            stale = ROOT / page_file(menu["stem"], code)
            if stale.exists():
                stale.unlink()
                print(f"{stale.name:<17} прибрано — меню ще не відкрите")

    (ROOT / "version.json").write_text(
        json.dumps({"build": BUILD}) + "\n", encoding="utf-8")

    for name, text in written:
        path = ROOT / name
        path.write_text(text, encoding="utf-8")
        print(f"{name:<17} {path.stat().st_size / 1024:5.0f} KB")

    open_menus = [m for m in MENUS if not m.get("soon")]
    soon = [pick(m["names"], DEFAULT_LANG) for m in MENUS if m.get("soon")]
    print(f"разом: {len(written)} сторінок — {len(open_menus) + 1} × {len(LANGS)} мови; "
          f"{len(menu_items_of(open_menus))} позицій на сайті"
          + (f"; ще не відкрито: {', '.join(soon)}" if soon else ""))


if __name__ == "__main__":
    main()
