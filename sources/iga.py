"""IGA (Québec online store, commerce.iga.net) — each tile carries its data in a
`data-product` attribute written as a JS-ish object literal."""
import ast
import re
from concurrent.futures import ThreadPoolExecutor

from bs4 import BeautifulSoup

from units import unit_from_size
from .base import get, item

BASE = "https://commerce.iga.net"
PAGES = 2  # 12 results per page

_LITERALS = re.compile(r"(?<=:)\s*(true|false|null)\s*(?=[,}\]])")


def _parse(attr):
    """Parse a JS-literal attribute from the page into Python, or None."""
    try:
        py = _LITERALS.sub(lambda m: {"true": "True", "false": "False", "null": "None"}[m.group(1)], attr)
        return ast.literal_eval(py)
    except (ValueError, SyntaxError):
        return None


def parse_page(html):
    """Raw product dicts of a search or department page (shared with the weekly crawl)."""
    soup = BeautifulSoup(html, "html.parser")
    return [d for d in (_parse(el["data-product"]) for el in soup.select("[data-product]")) if d]


def _page(q, lang, page):
    """Fetch and parse one page of IGA search results."""
    params = {"k": q}
    if page > 1:
        params["page"] = page
    return parse_page(get(f"{BASE}/{lang}/search", params=params).text)


def to_items(dicts):
    """Convert IGA product dicts to the shared item shape, dropping duplicates and unpriced items."""
    out, seen = [], set()
    for d in dicts:
        pid = d.get("ProductId")
        if not pid or pid in seen or d.get("RegularPrice") is None:
            continue
        seen.add(pid)
        regular = float(d["RegularPrice"])
        sale = d.get("SalesPrice")
        price = float(sale) if sale else regular
        size = d.get("Size") or ""
        out.append(item(
            "iga", id=pid, upc=(d.get("ProductSKU") or "").split("_")[0], name=d.get("FullDisplayName"),
            brand=d.get("BrandName"), size=size,
            price=price, regular=regular, unit=unit_from_size(price, size),
            promo=d.get("PromotionName"), image=d.get("ProductImageUrl"), category=d.get("CategoryName"),
            url=BASE + d["ProductUrl"] if d.get("ProductUrl") else None,
        ))
    return out


def search(q, lang, opts):
    """IGA search: first PAGES result pages fetched in parallel."""
    with ThreadPoolExecutor(PAGES) as ex:
        pages = list(ex.map(lambda p: _page(q, lang, p), range(1, PAGES + 1)))
    return to_items(d for page in pages for d in page)
