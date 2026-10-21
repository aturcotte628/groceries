"""Walmart Canada — search and category pages embed their results in Next.js __NEXT_DATA__."""
import json
import re

from units import parse_price, unit_from_size, unit_from_text
from .base import SourceError, get, item

BASE = "https://www.walmart.ca"
GROCERY_CAT = "10019"

_NEXT = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def next_data(html):
    """The page's data, or SourceError when Walmart served a bot check instead."""
    m = _NEXT.search(html)
    if not m:
        raise SourceError("Walmart asked for a human check — try again in a minute")
    return json.loads(m.group(1))


def search_result(data):
    """searchResult block from Walmart's page data, or {}."""
    try:
        return data["props"]["pageProps"]["initialData"]["searchResult"] or {}
    except (KeyError, TypeError):
        return {}


def parse_items(data):
    """Products of a search or category page (shared by live search and the weekly crawl)."""
    stacks = search_result(data).get("itemStacks") or []
    out, seen = [], set()
    for p in (p for st in stacks for p in st.get("items", [])):
        if p.get("__typename") != "Product" or p.get("id") in seen:
            continue
        seen.add(p.get("id"))
        info = p.get("priceInfo") or {}
        price = p.get("price") or parse_price(info.get("linePrice"))
        if not price:
            continue
        name = p.get("name") or ""
        unit = unit_from_text(info.get("unitPrice")) or unit_from_size(price, name)
        size = re.search(r"\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|ml|l|lb|lbs)\b", name, re.I)
        out.append(item(
            "walmart", id=p.get("usItemId") or p.get("id"), name=name, brand=p.get("brand"),
            size=size.group(0) if size else None,
            price=float(price), regular=parse_price(info.get("wasPrice")) or None, unit=unit,
            image=(p.get("imageInfo") or {}).get("thumbnailUrl") or p.get("image"),
            url=BASE + p["canonicalUrl"] if p.get("canonicalUrl") else None,
            stock=not p.get("isOutOfStock"),
            # "Épicerie > Fruits et légumes frais > Fruits frais > Petits fruits" (drop the "Épicerie" root)
            category=" > ".join(c["name"] for c in ((p.get("category") or {}).get("path") or [])[1:]),
        ))
    return out


def search(q, lang, opts):
    """Walmart grocery search, parsed from the page's embedded data."""
    html = get(f"{BASE}/{lang}/search", params={"q": q, "catId": GROCERY_CAT}).text
    return parse_items(next_data(html))
