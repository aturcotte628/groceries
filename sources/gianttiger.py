"""Giant Tiger / Tigre Géant — Shopify store searched through its public Algolia index.

The catalogue has one listing per pricing region (tagged mms_province_code), so the
same "Bananes, 3 lb" appears several times at different prices; keep Québec's."""
from units import unit_from_size
from .base import get, item, post

APP_ID = "NGMHTYXT0T"
# Public search-only key from gianttiger.com's page config.
SEARCH_KEY = "1ec86e7ee6661988fb72e0c843badcd8"
BASE = "https://www.gianttiger.com"
PROVINCE = "QC"


def _suggest_fr(q):
    """Shopify's French predictive search. The Algolia '_fr' index only holds English
    text, so French queries ("lait", "beurre") need this; it caps at 10 products."""
    data = get(f"{BASE}/fr/search/suggest.json",
               params={"q": q, "resources[type]": "product", "resources[limit]": 10}).json()
    for p in (data.get("resources") or {}).get("results", {}).get("products", []):
        tags = p.get("tags") or []
        if "L1_category_en:Grocery" not in tags:
            continue
        provinces = {t.split(":", 1)[1] for t in tags if t.startswith("mms_province_code:")}
        named = dict(t.split(":", 1) for t in tags if ":" in t)   # "L2_category_fr:Produits laitiers et œufs"
        price = float(p["price"])
        compare = float(p.get("compare_at_price_max") or 0)
        yield provinces, item(
            "gianttiger", id=p.get("id"), name=p.get("title"), brand=p.get("vendor"),
            price=price, regular=compare or None, unit=unit_from_size(price, p.get("title")),
            image=p.get("image"), url=f"{BASE}/fr/products/{p['handle']}", stock=p.get("available"),
            category=" > ".join(c for c in (named.get("L2_category_fr"), named.get("L3_category_fr")) if c),
        )


def _algolia(q, lang):
    """Grocery hits from the Algolia index as (provinces, item) pairs."""
    # The '_fr' index has the same English titles; French titles come from meta.french.
    data = query_index({"query": q, "hitsPerPage": 100})
    for h in data.get("hits", []):
        tags = h.get("named_tags") or {}
        if tags.get("L1_category_en") != "Grocery":
            continue
        converted = hit_to_item(h, lang)
        if converted:
            yield converted


def query_index(params):
    """Raw Algolia query on the product index (also used by the weekly crawl)."""
    return post(
        f"https://{APP_ID}-dsn.algolia.net/1/indexes/shopify_products/query",
        headers={"X-Algolia-Application-Id": APP_ID, "X-Algolia-API-Key": SEARCH_KEY, "Referer": BASE + "/"},
        json=params,
    ).json()


def hit_to_item(h, lang):
    """Algolia hit -> (provinces, item), or None when it has no price."""
    tags = h.get("named_tags") or {}
    if not h.get("handle") or h.get("price") is None:
        return None
    provinces = tags.get("mms_province_code") or []
    provinces = {provinces} if isinstance(provinces, str) else set(provinces)
    meta = h.get("meta") or {}
    info = meta.get("info") or {}
    uom = (meta.get("english") or {}).get("unit_of_measure")
    amount = info.get("amount_per_unit")
    size = None
    if amount and uom:
        size = f"{float(amount):g} {uom}"
        pack = info.get("pack_size")
        if pack and int(pack) > 1:
            size = f"{int(pack)} x {size}"
    title = h.get("title")
    if lang == "fr":
        title = (meta.get("french") or {}).get("title") or title
    price = float(h["price"])
    compare = h.get("compare_at_price") or h.get("variants_compare_at_price_min")
    return provinces, item(
        "gianttiger", id=h.get("objectID"), name=title, brand=h.get("vendor"), size=size,
        price=price, regular=float(compare) if compare else None,
        unit=unit_from_size(price, size) or unit_from_size(price, title),
        image=h.get("product_image") or h.get("image"),
        url=f"{BASE}{'/fr' if lang == 'fr' else ''}/products/{h['handle']}",
        stock=h.get("inventory_available"),
        category=" > ".join(c for c in (tags.get(f"L2_category_{'fr' if lang == 'fr' else 'en'}"),
                                        tags.get(f"L3_category_{'fr' if lang == 'fr' else 'en'}")) if c),
    )


def search(q, lang, opts):
    """Giant Tiger search; keeps one listing per title, preferring the one specific to Québec."""
    candidates = list(_suggest_fr(q)) if lang == "fr" else []
    candidates += list(_algolia(q, lang))
    # Per title keep the listing most specific to our province ("QC" beats "ON,QC").
    best, order = {}, []
    for provinces, it in candidates:
        if provinces and PROVINCE not in provinces:
            continue
        key = (it["name"].lower(), it["size"])
        if key not in best:
            order.append(key)
        if key not in best or len(provinces) < best[key][0]:
            best[key] = (len(provinces) or 99, it)
    return [best[k][1] for k in order]
