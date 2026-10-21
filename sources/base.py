"""Shared HTTP session, cache, and item shape for every store source."""
import os
import threading
import time
from urllib.parse import urlsplit

from curl_cffi import requests as cf

from categories import classify

TIMEOUT = 20
CACHE_TTL = 15 * 60

_local = threading.local()
_cache = {}
_cache_lock = threading.Lock()


class SourceError(Exception):
    """A store could not be searched; message is shown to the user."""


def session():
    """Per-thread browser-impersonating HTTP session (curl_cffi sessions aren't thread-safe)."""
    # curl_cffi sessions are not thread-safe; one per worker thread.
    s = getattr(_local, "session", None)
    if s is None:
        s = _local.session = cf.Session(impersonate="chrome")
    return s


# Optional relay: PANIER_RELAY=socks5h://host:port routes the stores whose sites ban datacenter networks
# through another connection (e.g. a reverse SSH tunnel). Relayed requests go one at a time with a minimum
# gap, and when the relay is down they fall back to stored prices.
RELAY = os.environ.get("PANIER_RELAY")
# which hosts use the relay (comma list; PANIER_RELAY_HOSTS overrides, e.g. to pause Metro/Super C)
RELAY_HOSTS = tuple(h.strip() for h in os.environ.get("PANIER_RELAY_HOSTS", "commerce.iga.net,metro.ca,superc.ca").split(",") if h.strip())
# minimum seconds between relayed requests per site family (Metro and Super C share one platform; the
# crawl tests showed it answers 429 / a challenge page below ~14 s per request)
RELAY_GAPS = {"iga": 2.0, "metro": 14.0}
RELAY_MAX_WAIT = 15.0    # a request that would queue longer than this is refused ("relay busy")
RELAY_DOWN_FOR = 30.0    # after a relay failure, skip the relay for this long
_relay_lock = threading.Lock()
_relay_next = {}
_relay_down_until = 0.0


def _relay_kw(url):
    """proxies kwarg for URLs that must go through the home relay ({} for everything else)."""
    if not RELAY:
        return {}
    host = urlsplit(url).hostname or ""
    if not any(host == h or host.endswith("." + h) for h in RELAY_HOSTS):
        return {}
    lane = "iga" if host.endswith("iga.net") else "metro"
    with _relay_lock:
        now = time.time()
        if now < _relay_down_until:
            raise SourceError("relay down")
        slot = max(now, _relay_next.get(lane, 0.0))
        if slot - now > RELAY_MAX_WAIT:
            raise SourceError("relay busy")
        _relay_next[lane] = slot + RELAY_GAPS[lane]
    if slot > now:
        time.sleep(slot - now)
    return {"proxies": {"http": RELAY, "https": RELAY}}


def _relay_failed():
    """Mark the relay as down so requests skip it for RELAY_DOWN_FOR seconds."""
    global _relay_down_until
    with _relay_lock:
        _relay_down_until = time.time() + RELAY_DOWN_FOR


# ---- request log + circuit breaker -------------------------------------------------------------
# Every request to a store is counted in the database (purpose "crawl" in the weekly crawl threads,
# "live" for everything else). After a 403 / 429 on a LIVE request that store is left alone for a few
# hours: hammering a store that just refused us is how a home IP ends up challenged. (The crawl has
# its own back-off in crawl.py.)
PURPOSE = threading.local()          # .v = "crawl" inside the crawl; unset = "live"
_STORE_HOSTS = (("iga.net", "iga"), ("metro.ca", "metro"), ("superc.ca", "superc"), ("pcexpress.ca", "maxi"),
                ("loblaws.ca", "maxi"), ("walmart", "walmart"), ("gianttiger", "gianttiger"),
                ("algolia", "gianttiger"), ("wishabi", "flipp"), ("flipp", "flipp"), ("openfoodfacts", "openfoodfacts"))
BLOCK_SECONDS = {403: 3 * 3600, 429: 3600}
_live_block = {}


def _store_of(url):
    """Store key for a URL's host, or the host itself if unknown."""
    host = urlsplit(url).hostname or ""
    return next((s for h, s in _STORE_HOSTS if h in host), host)


def block_live(store, seconds):
    """Pause live (user-triggered) requests to a store, e.g. after it refused us."""
    _live_block[store] = max(_live_block.get(store, 0), time.time() + seconds)


def _purpose():
    """'live' for user searches or 'crawl' for the background crawler (set per thread)."""
    return getattr(PURPOSE, "v", "live")


def _before(url):
    """Pre-request check; refuses live requests to a store that is currently paused."""
    store = _store_of(url)
    if _purpose() == "live" and time.time() < _live_block.get(store, 0):
        raise SourceError("paused: this store refused us recently")
    return store


def _after(store, status):
    """Log the request and pause live requests to the store if the status looks like a block."""
    try:
        import pricedb
        pricedb.log_request(store, _purpose(), status)
    except Exception:
        pass
    if _purpose() == "live" and status in BLOCK_SECONDS:
        block_live(store, BLOCK_SECONDS[status])


def get(url, **kw):
    """HTTP GET with logging, relay routing and pause handling; raises SourceError on HTTP errors."""
    store = _before(url)
    rk = _relay_kw(url)
    try:
        r = session().get(url, timeout=(6, TIMEOUT) if rk else TIMEOUT, **rk, **kw)
    except Exception as e:
        _after(store, "error")
        if rk:
            _relay_failed()
            raise SourceError("relay down") from e
        raise
    _after(store, r.status_code)
    if r.status_code >= 400:
        raise SourceError(f"HTTP {r.status_code}")
    return r


def post(url, **kw):
    """HTTP POST with logging and pause handling; raises SourceError on HTTP errors."""
    store = _before(url)
    try:
        r = session().post(url, timeout=TIMEOUT, **kw)
    except Exception:
        _after(store, "error")
        raise
    _after(store, r.status_code)
    if r.status_code >= 400:
        raise SourceError(f"HTTP {r.status_code}")
    return r


def cached(key, fn):
    """Memoise fn() under key for CACHE_TTL seconds (bounded in-memory cache)."""
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_TTL:
            return hit[1]
    value = fn()
    with _cache_lock:
        _cache[key] = (now, value)
        if len(_cache) > 500:
            for k, _ in sorted(_cache.items(), key=lambda kv: kv[1][0])[:100]:
                _cache.pop(k, None)
    return value


# Plausible package size per dimension (base units). Stores occasionally publish
# nonsense unit prices (Walmart: "$7.48, 2¢/100g" = a 37 kg butter).
_PLAUSIBLE = {"g": (1, 25_000), "ml": (1, 30_000), "ea": (1, 500)}


def _plausible(price, unit):
    """Keep a unit price only if it is in a believable range for its dimension, else None."""
    if not unit or not price or unit["value"] <= 0:
        return None
    lo, hi = _PLAUSIBLE[unit["dim"]]
    implied = price / unit["value"] * (100 if unit["dim"] in ("g", "ml") else 1)
    return unit if lo <= implied <= hi else None


def norm_upc(code):
    """Barcode digits without leading zeros; stores pad and include/omit the check digit
    differently, so the client also compares with the last digit dropped."""
    digits = "".join(ch for ch in str(code or "") if ch.isdigit()).lstrip("0")
    return digits if len(digits) >= 6 else None


def item(store, *, id, name, price, url, brand=None, size=None, regular=None, unit=None,
         image=None, price_per=None, promo=None, stock=None, upc=None, points=None, category=None):
    """Common item shape. `unit` = {"value": x, "dim": "g"|"ml"|"ea"} per 100 g / 100 mL / 1 ea.
    `price_per` is set when `price` itself is by weight ("kg" / "lb")."""
    unit = _plausible(price, unit)
    sale = regular is not None and price is not None and regular > price + 0.001
    return {
        "store": store, "id": str(id), "name": (name or "").strip(), "brand": (brand or "").strip() or None,
        "size": (size or "").strip() or None, "price": price, "regular": regular if sale else None,
        "sale": sale, "promo": promo, "unit": unit, "image": image, "url": url,
        "price_per": price_per, "stock": stock, "upc": norm_upc(upc),
        "points": int(points) if points else None,  # loyalty bonus points on this product
        # the store's own category path ("Fruits et légumes > Fruits") and the shared group ("fruits")
        "category": category or None, "group": classify(category),
    }
