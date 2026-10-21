"""Metro and Super C (same owner, same site platform) — server-rendered search page,
one product tile per result."""
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from units import parse_price, unit_from_size, unit_from_text
from .base import SourceError, block_live, get, item

BANNERS = {
    "metro": {"base": "https://www.metro.ca",
              "path": {"en": "/en/online-grocery/search", "fr": "/epicerie-en-ligne/recherche"}},
    "superc": {"base": "https://www.superc.ca",
               "path": {"en": "/en/search", "fr": "/recherche"}},
}


def _text(el):
    """Visible text of an element with whitespace collapsed ('' if None)."""
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def _search(key, q, lang):
    """Search Metro or Super C; a bot-check page pauses live requests to both."""
    b = BANNERS[key]
    html = get(b["base"] + b["path"][lang], params={"filter": q}).text
    out = parse_tiles(key, html)
    if (not out and "product-tile" not in html and len(html) < 40_000
            and re.search(r"challenge|captcha|cf-chl|just a moment", html, re.I)):
        # a small 200 page without any product markup is the site's bot-check page, not "no results"
        # (seen 2026-10-05: 11 KB "challenge" page after too many quick searches): leave both stores
        # alone for a while — they share one platform — and let the caller fall back on stored prices
        block_live("metro", 3 * 3600)
        block_live("superc", 3 * 3600)
        raise SourceError("human check")
    return out


def parse_tiles(key, html):
    """Product tiles of a search or aisle page (shared by live search and the weekly crawl)."""
    b = BANNERS[key]
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for tile in soup.select("div.default-product-tile"):
        code = tile.get("data-product-code")
        main = tile.select_one("[data-main-price]")
        if not code or not main:
            continue
        try:
            price = float(main["data-main-price"])
        except ValueError:
            continue
        before = tile.select_one(".pricing__before-price")
        regular = parse_price(_text(before)) if before else None
        # "2 L, Cons. 0,10 $/emb." -> drop the container-deposit note
        size = re.split(r",\s*(?:cons|dép|dep)", _text(tile.select_one(".head__unit-details")), flags=re.I)[0]
        secondary = " ".join(_text(e) for e in tile.select(".pricing__secondary-price"))
        unit = unit_from_text(secondary) or unit_from_size(price, size)
        promo = None
        sale_el = tile.select_one(".pricing__sale-price")
        if sale_el and "/" in _text(sale_el):  # multi-buy, e.g. "3 / $15.00"
            promo = _text(sale_el)
        img = tile.select_one(".pt__visual a.product-details-link img") or tile.select_one(".pt__visual picture img")
        link = tile.select_one("a.product-details-link")
        out.append(item(
            key, id=code, upc=code,  # the product code is the UPC
            # "Baies et cerises|Fruits|Fruits et légumes|Allées" -> "Fruits et légumes > Fruits > Baies et cerises"
            category=" > ".join(reversed([c for c in (tile.get("data-parent-category-hierarchy") or "").split("|")
                                          if c and c.lower() not in ("allées", "aisles")])) or tile.get("data-product-category"),
            name=_text(tile.select_one(".head__title")) or tile.get("data-product-name"),
            brand=_text(tile.select_one(".head__brand")) or tile.get("data-product-brand"),
            size=size, price=price, regular=regular, unit=unit, promo=promo,
            image=urljoin(b["base"], img["src"]) if img and img.get("src") else None,
            url=b["base"] + link["href"] if link else None,
        ))
    return out


def search_metro(q, lang, opts):
    """Metro search."""
    return _search("metro", q, lang)


def search_superc(q, lang, opts):
    """Super C search."""
    return _search("superc", q, lang)
