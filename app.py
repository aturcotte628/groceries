"""Panier — grocery price scanner for Québec stores.

Run:  python app.py   ->  http://127.0.0.1:5055
"""
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, jsonify, render_template, request

import pricedb
from categories import classify
from sources import STORES, flipp, pc
from sources.base import SourceError, cached, get

app = Flask(__name__)
HERE = os.path.dirname(os.path.abspath(__file__))


def _asset_version():
    """Newest mtime of the CSS/JS, used as a cache-busting query string."""
    # cache-bust static files: embedded browsers cache JS/CSS aggressively
    paths = [os.path.join(HERE, "static", p) for p in ("css/style.css", "js/app.js")]
    return int(max(os.path.getmtime(p) for p in paths))


def _lang():
    """Request language, 'fr' (default) or 'en'."""
    return "fr" if request.args.get("lang", "fr") == "fr" else "en"


def _query():
    """Search text from ?q= with whitespace collapsed and capped at 80 chars; empty -> SourceError."""
    q = re.sub(r"\s+", " ", request.args.get("q", "")).strip()[:80]
    if not q:
        raise SourceError("empty query")
    return q


@app.errorhandler(SourceError)
def _source_error(e):
    """Turn a store failure into a 502 JSON response."""
    return jsonify(error=str(e)), 502


@app.route("/")
def index():
    """Single-page app shell."""
    return render_template("index.html", v=_asset_version())


DEFAULT_MAX_AGE = 24 * 3600  # seconds; the page sends each store's own expiry setting


# Searches are answered from the database (the weekly crawl: data/prices.db, full-text index) whenever the
# store has a recent complete crawl, so ordinary use sends NO request to the stores. Only an explicit
# refresh, a store without a recent crawl, or a catalogue miss (a few per store and hour) goes online.
DB_FIRST = os.environ.get("PANIER_LIVE", "") != "always"     # PANIER_LIVE=always restores live searches
DB_MAX_AGE = 10 * 24 * 3600     # a complete crawl newer than this answers searches
LIVE_MISSES_PER_HOUR = 20       # catalogue misses allowed to go online, per store
_misses = {}


def _from_database(store, q, lang, store_id):
    """-> (items, crawl time) from the weekly crawl, or None when the store has to be asked."""
    if not DB_FIRST or (store == "maxi" and store_id):   # a chosen Maxi store has its own prices
        return None
    done = pricedb.last_success(store)
    if not done or time.time() - done > DB_MAX_AGE:
        return None
    items = pricedb.search_db(store, q, lang)
    if items:
        return items, done
    now = time.time()
    recent = [t for t in _misses.get(store, []) if now - t < 3600]
    if len(recent) >= LIVE_MISSES_PER_HOUR:
        _misses[store] = recent
        return [], done            # budget used up: "no result" rather than one more request
    _misses[store] = recent + [now]
    return None                    # unknown to the catalogue: let the store answer once


def _stored_search(store, q, lang, store_id=None, max_age=DEFAULT_MAX_AGE):
    """-> (items, fetched_at, error). First the database (the weekly crawl). Else every live search is stored
    too (data/prices.db): a stored result younger than max_age is used as is, otherwise search the store
    live and store it; if the store fails, fall back to the last stored prices (error says why)."""
    if max_age:                    # max_age 0 = explicit refresh: always ask the store
        found = _from_database(store, q, lang, store_id)
        if found is not None:
            return found[0], found[1], None
    saved = pricedb.get_search(store, lang, store_id, q)
    # results stored before items had a "category" field (2026-10-04) are refreshed once
    current = bool(saved) and all("category" in it for it in saved[1])
    if saved and current and time.time() - saved[0] <= max_age:
        return saved[1], saved[0], None
    try:
        items = STORES[store](q, lang, {"store": store_id})
    except Exception as e:  # network errors, bot checks, markup changes
        msg = str(e) if isinstance(e, SourceError) else type(e).__name__
        app.logger.warning("%s search %r failed: %s", store, q, msg)
        if saved:
            return saved[1], saved[0], msg
        raise SourceError(msg) from e
    return items, pricedb.save_search(store, lang, store_id, q, items), None


def _with_groups(store, items):
    """Every item gets its shared category group; a missing store category (Maxi's live search)
    is taken from the weekly crawl, which walks the store department by department."""
    missing = [it["id"] for it in items if not it.get("category")]
    known = pricedb.categories_for(store, missing) if missing else {}
    out = []
    for it in items:
        cat = it.get("category") or known.get(it["id"])
        out.append({**it, "category": cat, "group": classify(cat)})
    return out


@app.route("/api/search/<store>")
def search(store):
    """Live search of one store, served from the price DB when fresh enough (?maxAge, ?refresh=1
    forces a live call). If the store can't be reached, the last stored prices come back with stale=true."""
    if store not in STORES:
        return jsonify(error="unknown store"), 404
    q, lang = _query(), _lang()
    max_age = 0 if request.args.get("refresh") else float(request.args.get("maxAge") or DEFAULT_MAX_AGE)
    items, fetched_at, error = _stored_search(store, q, lang, request.args.get("storeId") or None, max_age)
    items = _with_groups(store, items)
    # stale = the store couldn't be reached; these are the last stored prices
    return jsonify(store=store, items=items, fetched_at=fetched_at, stale=bool(error), error=error)


@app.route("/api/match/<store>")
def match(store):
    """Candidates for "the same product at this store", from the database only (no request to the store):
    products with the same barcode first (gtin = real UPC or the code in Maxi's picture name), then the
    best text matches for q. The page decides which one is really the same product."""
    if store not in STORES:
        return jsonify(error="unknown store"), 404
    q = re.sub(r"\s+", " ", request.args.get("q", "")).strip()[:80]
    items = pricedb.by_gtin(store, request.args.get("gtin"))
    seen = {i["id"] for i in items}
    items += [i for i in pricedb.search_db(store, q, _lang(), limit=60) if i["id"] not in seen]
    return jsonify(store=store, items=_with_groups(store, items), fetched_at=pricedb.last_success(store))


@app.route("/api/requests/stats")
def request_stats():
    """Requests we sent to the stores, per day / store / purpose (crawl vs live), last 7 days."""
    return jsonify(days=pricedb.request_stats(int(request.args.get("days") or 7)))


@app.route("/api/prices/stats")
def price_stats():
    """Counts and size of the local price database."""
    return jsonify(pricedb.stats())


@app.route("/api/crawl/status")
def crawl_status():
    """Last weekly-crawl run per store (see crawl.py) and product counts."""
    return jsonify(runs=pricedb.last_runs(), stats=pricedb.stats())


# Fast sources used for type-ahead suggestions in the shopping list.
SUGGEST_STORES = ("gianttiger", "maxi", "metro")
_pool = ThreadPoolExecutor(8)


def _search_cached(store, q, lang, store_id=None):
    """Items only, from the stored-or-live search (no freshness metadata)."""
    return _stored_search(store, q, lang, store_id)[0]


@app.route("/api/suggest")
def suggest():
    """Products matching what's being typed, merged across a few stores
    (same brand + name + size = one suggestion, with every store that has it)."""
    q, lang = _query(), _lang()
    store_ids = {"maxi": request.args.get("maxiStore") or None}
    stores = [s for s in SUGGEST_STORES if s in STORES]
    futures = {s: _pool.submit(_search_cached, s, q, lang, store_ids.get(s)) for s in stores}
    per_store = {}
    for s, f in futures.items():
        try:
            per_store[s] = f.result(timeout=15)
        except Exception as e:  # one slow/broken store shouldn't kill suggestions
            app.logger.info("suggest: %s failed: %r", s, e)
            per_store[s] = []
    merged, order = {}, []
    # round-robin by rank so each store's best matches come first
    for rank in range(max((len(v) for v in per_store.values()), default=0)):
        for s in stores:
            items = per_store.get(s, [])
            if rank >= len(items):
                continue
            it = items[rank]
            key = re.sub(r"\W+", " ", f"{it.get('brand') or ''} {it['name']} {it.get('size') or ''}".lower()).strip()
            if key not in merged:
                merged[key] = {**it, "stores": [s], "min_price": it["price"]}
                order.append(key)
            else:
                m = merged[key]
                if s not in m["stores"]:
                    m["stores"].append(s)
                m["min_price"] = min(m["min_price"], it["price"])
    return jsonify(items=[merged[k] for k in order[:60]])


def _postal():
    """Canadian postal code from ?postal=, upper-cased without spaces; falls back to a placeholder
    (Montreal City Hall) and rejects malformed values."""
    postal = re.sub(r"\s", "", request.args.get("postal", "")).upper() or "H2Y1C6"
    if not re.fullmatch(r"[A-Z]\d[A-Z]\d[A-Z]\d", postal):
        raise SourceError("invalid postal code")
    return postal


@app.route("/api/flyers")
def flyers():
    """Flyer deals matching a search query."""
    q, lang, postal = _query(), _lang(), _postal()
    items = cached(("flyers", q.lower(), lang, postal), lambda: flipp.search(q, lang, postal))
    return jsonify(items=items)


@app.route("/api/flyers/list")
def flyer_list():
    """Current grocery flyers near a postal code, for browsing."""
    lang, postal = _lang(), _postal()
    return jsonify(flyers=cached(("flyer-list", lang, postal), lambda: flipp.flyers(lang, postal)))


@app.route("/api/flyers/<int:flyer_id>")
def flyer_items(flyer_id):
    """Deals on one flyer, cached."""
    lang = _lang()
    return jsonify(items=cached(("flyer", flyer_id, lang), lambda: flipp.flyer(flyer_id, lang)))


@app.route("/api/test-list")
def test_list():
    """Saved shopping list for testing (data/test-list.json); the page loads it with ?testlist."""
    path = os.path.join(HERE, "data", "test-list.json")
    if not os.path.exists(path):
        return jsonify(error="no saved test list"), 404
    with open(path, encoding="utf-8") as f:
        return app.response_class(f.read(), mimetype="application/json")


@app.route("/api/pc-stores/<key>")
def pc_stores(key):
    """Pickup branches for a Loblaw-family banner (e.g. maxi) plus the default branch id."""
    if key not in pc.BANNERS:
        return jsonify(error="unknown banner"), 404
    return jsonify(default=pc.BANNERS[key]["default_store"], stores=pc.stores(key))


@app.route("/api/barcode/<code>")
def barcode(code):
    """UPC/EAN -> product name via Open Food Facts, to turn a scan into a search."""
    if not re.fullmatch(r"\d{6,14}", code):
        raise SourceError("invalid barcode")

    def look():
        r = get(f"https://world.openfoodfacts.org/api/v2/product/{code}.json",
                params={"fields": "product_name,product_name_fr,product_name_en,brands,quantity,image_small_url"})
        return r.json()
    try:
        data = cached(("barcode", code), look)
    except SourceError:
        data = {}
    p = data.get("product") if data.get("status") == 1 else None
    if not p:
        return jsonify(found=False, code=code)
    lang = _lang()
    name = p.get(f"product_name_{lang}") or p.get("product_name") or p.get("product_name_en") or ""
    brand = (p.get("brands") or "").split(",")[0].strip()
    query = name if brand.lower() in name.lower() else f"{brand} {name}".strip()
    return jsonify(found=True, code=code, name=name, brand=brand, quantity=p.get("quantity"),
                   image=p.get("image_small_url"), query=query)


if __name__ == "__main__":
    host = "0.0.0.0" if "--lan" in sys.argv else "127.0.0.1"
    app.run(host=host, port=5055, debug="--debug" in sys.argv, threaded=True)
