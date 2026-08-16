#!/usr/bin/env python3
"""Збирає data/menu.json у assets/menu-data.js.

Сторінка працює без сервера — навіть з файлової системи, тому дані не
можна тягнути через fetch(): браузер заблокує file:// запит. Замість
цього каталог лежить у звичайному <script> як константа MENU_DATA.

Запуск після будь-якої правки меню:  python3 tools/build_data.py
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "menu.json"
OUT = ROOT / "assets" / "menu-data.js"

HEAD = """/* ==========================================================================
   Каталог меню. Файл згенеровано з data/menu.json — руками не правити.
   Правки вносьте в data/menu.json і запускайте: python3 tools/build_data.py
   ========================================================================== */

const MENU_DATA = """

TAIL = ";\n"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    data.pop("_note", None)
    body = json.dumps(data, ensure_ascii=False, indent=2)
    OUT.write_text(HEAD + body + TAIL, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(data['items'])} позицій, "
          f"{len(data['categories'])} категорій")


if __name__ == "__main__":
    main()
