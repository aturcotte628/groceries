"""This week's flyers near a postal code, via Flipp (aggregates every chain's flyer):
the flyer list, one flyer's full item list, and item search across all flyers."""
import re

from .base import get

API = "https://backflipp.wishabi.com/flipp/items/search"
FLYERS = "https://backflipp.wishabi.com/flipp/flyers"

# Flipp merchant names -> our store keys (anything else is "other")
_CHAINS = [
    (re.compile(r"^iga", re.I), "iga"),
    (re.compile(r"^metro", re.I), "metro"),
    (re.compile(r"^maxi", re.I), "maxi"),
    (re.compile(r"^super c( |$)", re.I), "superc"),
    (re.compile(r"giant tiger|tigre g", re.I), "gianttiger"),
    (re.compile(r"^walmart", re.I), "walmart"),
    (re.compile(r"^voil[aà]", re.I), "voila"),  # flyer only: voila.ca blocks automated clients
]


def chain(merchant):
    """Shared chain key for a flyer merchant name, or None if it isn't one we track."""
    for rx, key in _CHAINS:
        if rx.search(merchant or ""):
            return key
    return None


def _locale(lang):
    """Flipp locale code for 'fr' or 'en'."""
    return "fr-ca" if lang == "fr" else "en-ca"


def _https(url):
    """Upgrade an http:// URL to https://."""
    return re.sub(r"^http:", "https:", url) if url else url


def flyers(lang, postal):
    """Grocery flyers currently published for this postal code."""
    data = get(FLYERS, params={"locale": _locale(lang), "postal_code": postal}).json()
    out = []
    for f in data.get("flyers", []):
        if "Groceries" not in (f.get("categories") or []):
            continue
        out.append({
            "id": f["id"],
            "merchant": f.get("merchant"),
            "store": chain(f.get("merchant")),
            "name": f.get("name"),
            "thumb": _https(f.get("thumbnail_url")),
            "logo": _https(f.get("merchant_logo")),
            "valid_from": f.get("valid_from"),
            "valid_to": f.get("valid_to"),
            "priority": f.get("priority") or 0,
        })
    # our chains first, then by the flyer's own priority
    out.sort(key=lambda f: (f["store"] is None, -f["priority"]))
    return out


def flyer(flyer_id, lang):
    """Every deal in one flyer, in reading order (page, then top-to-bottom, left-to-right)."""
    data = get(f"{FLYERS}/{int(flyer_id)}", params={"locale": _locale(lang)}).json()
    pages = sorted(data.get("pages") or [], key=lambda p: p["left"])

    def page_of(x):
        for p in pages:
            if p["left"] <= x < p["right"]:
                return p["page"]
        return None

    out = []
    for it in data.get("items", []):
        price = it.get("price")
        try:
            price = float(price) if price not in (None, "") else None
        except ValueError:
            price = None
        if it.get("display_type") != 1 or (price is None and not it.get("discount")):
            continue  # banners, app promos, "activate your offers"
        name = it.get("name") or ""
        if " | " in name:  # bilingual flyers (Super C): "raisins rouges | red grapes"
            parts = name.split(" | ")
            name = parts[1] if lang == "en" and len(parts) > 1 else parts[0]
        out.append({
            "id": it["id"],
            "name": name,
            "brand": it.get("brand"),
            "price": price,
            "discount": it.get("discount"),  # percent off, when the flyer states it
            "image": _https(it.get("cutout_image_url")),
            "page": page_of(it.get("left") or 0),
            "_top": it.get("top") or 0,
            "_left": it.get("left") or 0,
            "valid_to": it.get("valid_to"),
        })
    out.sort(key=lambda i: (i["page"] or 999, -i["_top"] // 150, i["_left"]))
    for i in out:
        del i["_top"], i["_left"]
    return out


def search(q, lang, postal):
    """Flyer deals matching q near a postal code."""
    locale = _locale(lang)
    data = get(API, params={"locale": locale, "postal_code": postal, "q": q}).json()
    out = []
    for it in data.get("items", []):
        if it.get("current_price") is None and not it.get("sale_story"):
            continue
        out.append({
            "id": it.get("id"),
            "merchant": it.get("merchant_name"),
            "store": chain(it.get("merchant_name")),
            "logo": it.get("merchant_logo"),
            "name": it.get("name"),
            "price": it.get("current_price"),
            "regular": it.get("original_price"),
            "pre": it.get("pre_price_text"),
            "post": it.get("post_price_text"),
            "story": it.get("sale_story"),
            "image": _https(it.get("clean_image_url") or it.get("clipping_image_url")),
            "valid_from": it.get("valid_from"),
            "valid_to": it.get("valid_to"),
            "url": f"https://flipp.com/{locale}/item/{it.get('id')}",
        })
    return out
