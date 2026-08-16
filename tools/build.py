#!/usr/bin/env python3
"""Збирає index.html — готову сторінку меню трьома мовами.

Меню за QR читають у чому завгодно: у вбудованому переглядачі месенджера, у
режимі економії трафіку, зі стареньким телефоном. Тому позиції не малюються
скриптом, а лежать у HTML готовими, а перемикач мов працює на CSS: три копії
меню в одному файлі, показує ту, чия радіокнопка обрана. Скрипт додає лише
пошук і підсвітку розділу — без нього меню все одно читається повністю.

Стилі й скрипт вшиваються в сторінку: один файл, один запит, працює офлайн.

Запуск після будь-якої правки меню:  python3 tools/build.py
"""

import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MENU = json.loads((ROOT / "data" / "menu.json").read_text(encoding="utf-8"))
UI = json.loads((ROOT / "data" / "ui.json").read_text(encoding="utf-8"))
CSS = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
JS = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
OUT = ROOT / "index.html"

LANGS = [("uk", "UA", "Українська"), ("en", "EN", "English"), ("ru", "RU", "Русский")]
DEFAULT_LANG = "uk"

ML_STEP = re.compile(r"^\d+\s*ml$", re.I)


def t(key, lang):
    entry = UI.get(key, {})
    return entry.get(lang) or entry.get("en") or key


def pick(field, lang):
    if not field:
        return ""
    if isinstance(field, str):
        return field
    return field.get(lang) or field.get("en") or next(iter(field.values()), "")


def e(text):
    return html.escape(str(text), quote=True)


def money(pence):
    """Ціна — надрукований факт: £13 незалежно від мови читача."""
    value = (pence or 0) / 100
    text = f"£{value:,.2f}"
    return text[:-3] if text.endswith(".00") else text


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
    steps = [c for c in choices if ML_STEP.match(c["name"])]
    if len(steps) < 3:
        return choices, []
    rest = [c for c in choices if not ML_STEP.match(c["name"])]
    return [steps[0]] + rest, steps[1:]


def choices_html(choices):
    parts = []
    for choice in choices:
        chip = f'<span class="choice__name">{e(choice["name"])}</span>'
        if choice.get("price_pence"):
            chip += f' <span class="choice__price">{e(money(choice["price_pence"]))}</span>'
        parts.append(f'<span class="choice">{chip}</span>')
    return ' <span class="sep">·</span> '.join(parts)


# -------------------------------------------------------------------- пошук --
def fold(text):
    return text.lower().replace("ё", "е").replace("’", "ʼ").replace("'", "ʼ")


def search_key(item):
    """Усе, за чим позицію шукають, — трьома мовами одразу, готове в атрибуті."""
    parts = [item["name"], *(item.get("desc") or {}).values()]
    for key in item.get("ing") or []:
        word = MENU["lexicon"].get(key)
        parts += list(word.values()) if word else [key]
    for opt in item.get("options") or []:
        parts += [t(opt["label"], code) for code, _, _ in LANGS]
        parts += [c["name"] for c in opt.get("choices") or []]
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
               f'<p class="item__price">{prefix}{e(money(item["price_pence"]))}</p>'
               '</div>')

    head, tail = split_desc(item, lang)
    desc = head if note and tail == note else " · ".join(x for x in (head, tail) if x)
    if desc:
        out.append(f'<p class="item__desc">{e(desc)}</p>')

    for opt in item.get("options") or []:
        visible, hidden = split_choices(opt)
        line = (f'<span class="item__optLabel">{e(t(opt["label"], lang))}:</span> '
                + choices_html(visible))
        if hidden:
            line += ('<details class="more">'
                     f'<summary class="more__summary">{e(t("opt.allSizes", lang))}</summary>'
                     f'<div class="more__list">{choices_html(opt["choices"])}</div>'
                     '</details>')
        out.append(f'<div class="item__opt">{line}</div>')

    ing = ", ".join(pick(MENU["lexicon"].get(k), lang) or k for k in item.get("ing") or [])
    if ing:
        out.append(f'<p class="item__ing">'
                   f'<span class="item__ingLabel">{e(t("dish.ingredients", lang))}:</span> '
                   f'{e(ing)}</p>')

    out.append("</article>")
    return "".join(out)


# ------------------------------------------------------------------ сторінка --
def page_html(lang):
    chips, sections = [], []

    for cat in MENU["categories"]:
        items = [i for i in MENU["items"] if i["category"] == cat["key"]]
        if not items:
            continue
        cid = f"{lang}-cat-{cat['key']}"
        chips.append(f'<a class="chip" href="#{cid}" data-cat="{e(cat["key"])}">'
                     f'{e(pick(cat["names"], lang))}</a>')

        note = shared_note(items, lang)
        body = [f'<section class="section" id="{cid}">',
                '<header class="section__head">'
                f'<h2 class="section__title">{e(pick(cat["names"], lang))}</h2></header>']
        if note:
            body.append(f'<p class="note">{e(note)}</p>')
        body.append('<div class="section__items">')
        body += [item_html(i, lang, note) for i in items]
        body.append("</div></section>")
        sections.append("".join(body))

    return f"""
<div class="page page--{lang}" lang="{lang}">

  <div class="masthead">
    <p class="masthead__brand">{e(MENU['venue']['name'])}</p>
    <div class="rule rule--diamond" aria-hidden="true"></div>
    <h1 class="masthead__title">{e(t('menu.title', lang))}</h1>
    <div class="rule rule--diamond" aria-hidden="true"></div>
    <p class="masthead__sub">{e(t('brand.sub', lang))}</p>
  </div>

  <div class="toolbar">
    <div class="field js-only">
      <input type="search" autocomplete="off" spellcheck="false"
             placeholder="{e(t('tb.search', lang))}" aria-label="{e(t('tb.search', lang))}">
      <button class="field__clear" type="button" title="{e(t('tb.clear', lang))}" hidden>✕</button>
    </div>
    <nav class="chips" aria-label="{e(t('nav.label', lang))}">{''.join(chips)}</nav>
    <p class="toolbar__count js-only"
       data-unit="{e(t('count.items', lang))}">{len(MENU['items'])} {e(t('count.items', lang))}</p>
  </div>

  <div class="menu">{''.join(sections)}</div>
  <p class="empty" hidden>{e(t('search.empty', lang))}</p>

  <footer class="foot">
    <div class="rule rule--diamond" aria-hidden="true"></div>
    <p>{e(t('foot.age', lang))}</p>
    <p class="foot__fine">{e(t('foot.prices', lang))}</p>
  </footer>

</div>"""


def document():
    radios = "".join(
        f'<input class="langsel" type="radio" name="lang" id="lang-{code}" '
        f'aria-label="{e(label)}"{" checked" if code == DEFAULT_LANG else ""}>'
        for code, _, label in LANGS)
    switches = "".join(
        f'<label class="lang" for="lang-{code}" title="{e(label)}">{e(short)}</label>'
        for code, short, label in LANGS)

    return f"""<!doctype html>
<html lang="{DEFAULT_LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(MENU['venue']['name'])} · {e(t('menu.title', DEFAULT_LANG))}</title>
<meta name="theme-color" content="#f7f3ea">
<meta name="description" content="{e(MENU['venue']['name'])} — {e(t('menu.title', 'en'))}">
<!-- Сторінку згенеровано: python3 tools/build.py. Правки — у data/ і assets/. -->
<style>
{CSS}
</style>
</head>
<body>

{radios}

<header class="site" id="top">
  <div class="site__bar">
    <span class="mark" aria-hidden="true">{e(MENU['venue']['name'])}<small>LONDON</small></span>
    <nav class="langs" aria-label="{e(t('lang.label', DEFAULT_LANG))}">{switches}</nav>
  </div>
</header>

<main class="sheet">
  <div class="sheet__inner">
{"".join(page_html(code) for code, _, _ in LANGS)}
  </div>
</main>

<a href="#top" class="totop" title="{e(t('ui.top', DEFAULT_LANG))}" hidden>↑</a>

<script>
{JS}
</script>
</body>
</html>
"""


def main():
    OUT.write_text(document(), encoding="utf-8")
    size = OUT.stat().st_size / 1024
    print(f"{OUT.relative_to(ROOT)}: {len(MENU['items'])} позицій, "
          f"{len(MENU['categories'])} розділів, "
          f"{len(LANGS)} мови, {size:.0f} KB")


if __name__ == "__main__":
    main()
