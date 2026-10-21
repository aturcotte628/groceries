"""Loblaws & Maxi — PC Express product-search API (same backend as their websites)."""
import datetime
import uuid

from units import unit_from_comparison, unit_from_size
from .base import SourceError, cached, get, item, post

API = "https://api.pcexpress.ca/pcx-bff/api/v1"
# Public key embedded in the loblaws.ca / maxi.ca web front-end.
API_KEY = "C1xujSegT5j3ap3yexJjqhOfELwGKYvz"

BANNERS = {
    "loblaws": {"banner": "loblaw", "site": "https://www.loblaws.ca", "default_store": "1170"},  # Ottawa Rideau
    "maxi": {"banner": "maxi", "site": "https://www.maxi.ca", "default_store": "7573"},  # Montréal Sherbrooke E
}

_WEIGHT_UNITS = {"kg", "lb", "g", "100g"}


def _headers(banner, lang):
    """Request headers the PC Express web API expects."""
    return {
        "Content-Type": "application/json", "Accept": "application/json, text/plain, */*",
        "Accept-Language": lang, "baseSiteId": banner, "Site-Banner": banner,
        "Business-User-Agent": "PCXWEB", "x-apikey": API_KEY, "x-loblaw-tenant-id": "ONLINE_GROCERIES",
        "x-channel": "web", "x-application-type": "web",
    }


def stores(key):
    """Pickup branches of a banner, sorted by region and town (cached)."""
    b = BANNERS[key]

    def load():
        data = get(f"{API}/pickup-locations", params={"bannerIds": b["banner"]},
                   headers=_headers(b["banner"], "en")).json()
        out = [{"id": s["storeId"], "name": s["name"],
                "town": (s.get("address") or {}).get("town"),
                "region": (s.get("address") or {}).get("region")}
               for s in data if s.get("isShoppable", True) and s.get("locationType") == "STORE"]
        return sorted(out, key=lambda s: (s["region"] or "", s["town"] or "", s["name"]))
    return cached(("pc-stores", key), load)


def _search(key, q, lang, opts):
    """PC Express product search for a banner at the chosen (or default) branch."""
    b = BANNERS[key]
    store_id = str(opts.get("store") or b["default_store"])
    uid = str(uuid.uuid4())
    body = {
        "pagination": {"from": 0, "size": 48}, "banner": b["banner"], "cartId": uid, "lang": lang,
        "date": datetime.date.today().strftime("%d%m%Y"), "storeId": store_id, "pcId": False,
        "pickupType": "STORE", "offerType": "OG", "term": q,
        "userData": {"domainUserId": uid, "sessionId": uid},
    }
    data = post(f"{API}/products/search", json=body, headers=_headers(b["banner"], lang)).json()
    if "results" not in data:
        raise SourceError("unexpected response")
    out = []
    for p in data["results"]:
        if p.get("sponsored"):  # ads, often unrelated to the query
            continue
        prices = p.get("prices") or {}
        pr = prices.get("price") or {}
        price = pr.get("value")
        if price is None:
            continue
        was = (prices.get("wasPrice") or {}).get("value")
        size = p.get("packageSize") or ""
        per = (pr.get("unit") or "").lower()
        price_per = per if per in _WEIGHT_UNITS else None
        unit = None
        for c in prices.get("comparisonPrices") or []:
            unit = unit_from_comparison(c.get("value"), c.get("quantity"), c.get("unit"))
            if unit:
                break
        if not unit and price_per:
            unit = unit_from_comparison(price, pr.get("quantity"), per)
        if not unit:
            unit = unit_from_size(price, size)
        deal = (p.get("badges") or {}).get("dealBadge") or {}
        imgs = p.get("imageAssets") or [{}]
        link = p.get("link")
        site = b["site"] + ("/fr" if lang == "fr" else "/en")
        out.append(item(
            key, id=p.get("code"), name=p.get("name"), brand=p.get("brand"), size=size,
            price=price, regular=was, unit=unit, price_per=price_per,
            promo=deal.get("text") if isinstance(deal, dict) else None,
            image=imgs[0].get("smallUrl") or imgs[0].get("thumbnailUrl"),
            url=site + link if link else None,
            stock=(p.get("stockStatus") or "OK") == "OK",
            upc=(p.get("upcs") or [None])[0],
            # PC Optimum bonus points printed on the product ("500 points")
            points=((p.get("badges") or {}).get("loyaltyBadge") or {}).get("points"),
        ))
    return out


def search_loblaws(q, lang, opts):
    """Loblaws search (disabled: no Québec stores)."""
    return _search("loblaws", q, lang, opts)


def search_maxi(q, lang, opts):
    """Maxi search."""
    return _search("maxi", q, lang, opts)
