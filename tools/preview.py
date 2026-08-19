#!/usr/bin/env python3
"""Збирає preview.html — усі три меню в одному файлі, щоб глянути з телефона.

Сайт складається з дванадцяти сторінок, звʼязаних посиланнями, і в перегляді
файлів (месенджер, «Файли» на iOS) переходи між ними не працюють. Цей файл —
не частина сайту, а лише спосіб показати меню одним куском: головна веде на
розділи всередині сторінки.

    python3 tools/preview.py [файл] [мова]
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build  # noqa: E402  (сусідній модуль, шлях додано вище)


def preview(lang):
    parts = []
    for menu in build.MENUS:
        if menu.get("soon"):        # ще не відкрите — його немає й на сайті
            continue
        parts.append(f'<section class="preview" id="menu-{menu["stem"]}">')
        parts.append('<div class="rule rule--diamond" aria-hidden="true"></div>')
        parts.append('<h2 class="preview__title">'
                     f'{build.e(build.pick(menu["title"], lang))}</h2>')
        parts.append(build.menu_body(lang, menu)
                     .replace('<div class="toolbar js-only">', '<div class="toolbar js-only" hidden>'))
        parts.append('</section>')

    cards = build.cards_html(lang)
    for menu in build.MENUS:
        cards = cards.replace(f'href="{build.page_file(menu["stem"], lang)}"',
                              f'href="#menu-{menu["stem"]}"')

    body = f"""
{build.masthead(lang, build.t('menu.title', lang))}

  <div class="home">
    <p class="home__pick">{build.e(build.t('home.pick', lang))}</p>
    {cards}
  </div>

{''.join(parts)}
"""
    page = build.document(lang, "index", build.t("menu.title", lang), body)
    return page.replace("</style>", """
.preview { margin-top: 40px; }
.preview__title {
  margin: 0 0 6px;
  text-align: center;
  font-weight: 400;
  font-size: 30px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.preview .masthead { display: none; }
.preview .foot { display: none; }
.preview .section { scroll-margin-top: calc(var(--bar) + var(--inset) + 12px); }
</style>""")


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "preview.html")
    lang = sys.argv[2] if len(sys.argv) > 2 else build.DEFAULT_LANG
    out.write_text(preview(lang), encoding="utf-8")
    print(f"{out}: {out.stat().st_size / 1024:.0f} KB, мова {lang}")


if __name__ == "__main__":
    main()
