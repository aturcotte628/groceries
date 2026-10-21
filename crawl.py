"""Weekly catalogue crawl: every grocery product of every store into data/prices.db.

    python crawl.py                  # crawl the stores that are due (see below)
    python crawl.py --status         # last crawl per store + what's due and why
    python crawl.py --force maxi iga # crawl these now, due or not
    python crawl.py --dry-run        # only say what would be crawled
    python crawl.py --retry          # continue only the stores whose crawl stopped early this week

A crawl stopped by a rate limit or a bot check is resumed, never restarted: every finished
department/aisle/category and every saved page is checkpointed for the store's current flyer
week, so the next run (retry, nightly task) continues at the next page. A new flyer week starts
from the beginning.

A store is due when its new flyer week has started since its last crawl (start days are read
from Flipp each run: most Québec chains flip on Thursday, Giant Tiger on Wednesday), or when
its last crawl is 7+ days old. The "Panier Crawl" scheduled task runs this nightly at 02:30,
so each store is crawled the first night of its new rebate week.

Politeness: one request at a time per store with a pause between requests, category/aisle
pages only (not the search pages some robots.txt forbid), and a store's crawl stops at the
first bot check instead of trying to get around it. Voilà (voila.ca) serves an AWS WAF bot
challenge to automated clients, so only its weekly Flipp flyer is stored.
"""
import argparse
import datetime
import json
import os
import re
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import pricedb
from sources import base, flipp
from sources.base import SourceError, item
from units import parse_price, unit_from_size, unit_from_text

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "data", "crawl.json")
LOG_PATH = os.path.join(HERE, "data", "crawl.log")
WEEK = 7 * 24 * 3600
LANG = "fr"

# seconds between requests, per store
# Metro and Super C share one platform that rate-limits: HTTP 429 at 2 s, 6 s and 9 s per page,
# clean at ~14 s (tested 2026-10-03) -> 15 s, crawled one after the other (SAME_PLATFORM),
# ~1.5 h each. Walmart shows a bot check when crawled quickly (stopped after 13 requests at 3 s).
DELAY = {"maxi": 1.5, "metro": 15.0, "superc": 15.0, "iga": 2.0, "gianttiger": 3.0, "walmart": 12.0, "voila": 1.0}
SAME_PLATFORM = [("metro", "superc")]   # never crawled at the same time
MAX_REQUESTS = 3000          # safety cap per store per run
MAX_ERRORS = 5               # consecutive failed requests before giving up on a store
MAX_SLOWDOWNS = 4            # 429 back-offs (90 s, 180 s, ...) before giving up on a store

_log_lock = threading.Lock()


def log(msg):
    """Print a timestamped line and append it to the crawl log."""
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {msg}"
    with _log_lock:
        print(line, flush=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def config():
    """Crawler settings from data/crawl.json over defaults (postal code, Maxi branch id)."""
    cfg = {"postal": "H2Y1C6", "maxi_store": None}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (OSError, ValueError):
        pass
    return cfg


class Blocked(Exception):
    """The store served a bot check: stop this store's crawl (never work around it)."""


class Ctx:
    """Polite, counted HTTP for one store's crawl."""

    def __init__(self, store, week=None, record=True):
        """One crawl's request budget, politeness delay and resume checkpoints."""
        self.store = store
        self.week = week            # progress key: this store's current flyer week
        self.record = record and week is not None   # --limit test runs don't checkpoint
        self.progress = pricedb.get_progress(store, week) if self.record else {}
        self.total_units = None
        self.requests = 0
        self.errors = 0
        self.slowdowns = 0
        self.delay = DELAY.get(store, 2.0)
        self._last = 0.0

    def _wait(self):
        """Sleep to honour the per-store delay; raises Blocked once the request cap is reached."""
        if self.requests >= MAX_REQUESTS:
            raise Blocked(f"request cap {MAX_REQUESTS} reached")
        pause = self.delay - (time.time() - self._last)
        if pause > 0:
            time.sleep(pause)
        self._last = time.time()
        self.requests += 1

    def call(self, fn, *a, **kw):
        """Run one request with a retry; raises Blocked after too many failures in a row."""
        attempt = 0
        while attempt < 2:
            attempt += 1
            self._wait()
            try:
                out = fn(*a, **kw)
                self.errors = 0
                return out
            except SourceError as e:
                msg = str(e)
                if "HTTP 429" in msg:
                    # "Too Many Requests": the site asks us to slow down -> wait, go slower, retry
                    self.slowdowns += 1
                    if self.slowdowns > MAX_SLOWDOWNS:
                        raise Blocked(f"still rate-limited after {MAX_SLOWDOWNS} slow-downs ({msg})")
                    wait = 90 * self.slowdowns
                    self.delay *= 1.5
                    log(f"{self.store}: rate-limited (429) — pausing {wait}s, then 1 request / {self.delay:.0f}s")
                    time.sleep(wait)
                    attempt -= 1  # a slow-down is not a failed attempt
                    continue
                if "human check" in msg or "HTTP 403" in msg:
                    raise Blocked(msg)  # bot check: stop, never work around it
                err = e
            except Exception as e:  # network hiccup
                err = e
            self.errors += 1
            if self.errors >= MAX_ERRORS:
                raise Blocked(f"{MAX_ERRORS} failures in a row ({type(err).__name__}: {err})")
            time.sleep(15 * attempt)
        return None

    # --- checkpoints: a unit (department/aisle/category) is done, or resumes at a page
    def units_total(self, n):
        """Record how many units (departments/aisles) this crawl has."""
        self.total_units = n

    def unit_done(self, unit):
        """True if the unit was finished in an earlier run of the same flyer week."""
        return bool(self.progress.get(unit, {}).get("done"))

    def unit_info(self, unit):
        """Extra data saved with a unit (e.g. page counts), or {}."""
        return self.progress.get(unit, {}).get("info") or {}

    def first_page(self, unit):
        """Page to resume from for a unit (1 if never started)."""
        return self.progress.get(unit, {}).get("next_page") or 1

    def page_saved(self, unit, page):
        """Checkpoint: this page is stored, resume at the next one."""
        self._set(unit, next_page=page + 1)

    def unit_finished(self, unit, info=None):
        """Mark a unit as completely crawled."""
        self._set(unit, done=1, info=info)

    def set_info(self, unit, info):
        """Merge extra data into a unit's saved info."""
        self._set(unit, info={**self.unit_info(unit), **info})

    def _set(self, unit, **kw):
        """Update a unit's checkpoint in memory and, unless in test mode, in the database."""
        p = self.progress.setdefault(unit, {})
        p.update({k: v for k, v in kw.items() if v is not None})
        if self.record:
            pricedb.set_progress(self.store, self.week, unit, p.get("next_page"), p.get("done"), p.get("info"))

    def get(self, url, **kw):
        """Throttled GET through the shared HTTP helper."""
        return self.call(base.get, url, **kw)

    def post(self, url, **kw):
        """Throttled POST through the shared HTTP helper."""
        return self.call(base.post, url, **kw)


# ---------------------------------------------------------------- store crawlers
# Each yields lists of items (the same shape as live search results). They work in "units"
# (a department, aisle or category) made of pages, and record progress through ctx after every
# saved page: a crawl stopped by a rate limit or a bot check resumes at the next page the next
# time it runs in the same flyer week (python crawl.py --retry, or the nightly task).
# A new flyer week starts from the beginning.

def crawl_maxi(ctx, cfg):
    """Crawl Maxi by department through the PC Express v2 search API."""
    from sources.pc import API, BANNERS, _headers
    store_id = str(cfg.get("maxi_store") or BANNERS["maxi"]["default_store"])
    site = BANNERS["maxi"]["site"] + "/fr"
    uid = str(uuid.uuid4())
    today = datetime.date.today().strftime("%d%m%Y")

    def listing(code, page):
        body = {"banner": "maxi", "lang": LANG, "storeId": store_id, "term": "", "cartId": uid, "offerType": "OG",
                "date": today, "pagination": {"from": 0, "size": 48},
                "fulfillmentInfo": {"offerType": "OG", "storeId": store_id, "pickupType": "STORE", "date": today, "timeSlot": None},
                "userData": {"domainUserId": uid, "sessionId": uid},
                "listingInfo": {"filters": {"category": [code]}, "sort": {}, "pagination": {"from": page},
                                "includeFiltersInResponse": True},
                "searchRelatedInfo": {"term": "", "options": []}}
        r = ctx.post(API.replace("/v1", "/v2") + "/products/search", json=body, headers=_headers("maxi", LANG))
        return r.json() if r is not None else {}

    def walk(o, pred):
        if isinstance(o, dict):
            if pred(o):
                yield o
            for v in o.values():
                yield from walk(v, pred)
        elif isinstance(o, list):
            for v in o:
                yield from walk(v, pred)

    def tiles(d):
        return [t for c in walk(d, lambda o: "productTiles" in o) for t in c["productTiles"]]

    # "Alimentation" (27985) and its departments; each is under the API's ~10 000-result paging limit
    first = listing("27985", 1)
    group = next(walk(first, lambda o: o.get("code") == "category" and isinstance(o.get("values"), list)), None)
    depts = [(v["code"], v["name"], v.get("count") or 0) for v in (group or {}).get("values", []) if v.get("code") != "27985"]
    ctx.units_total(len(depts))
    log(f"maxi: {len(depts)} departments in Alimentation")
    for code, name, count in depts:
        if ctx.unit_done(code):
            continue
        page = ctx.first_page(code)
        while page <= count // 48 + 2:
            ts = tiles(listing(code, page))
            if not ts:
                break
            out = []
            for t in ts:
                if t.get("isSponsored"):
                    continue
                pr = t.get("pricing") or {}
                try:
                    price = float(pr.get("price"))
                except (TypeError, ValueError):
                    continue
                sizing = t.get("packageSizing") or ""
                # "1,5 l, 0,28 $/100ml" -> "1,5 l" (split before the unit price, not at the decimal comma)
                size = re.split(r",\s+(?=\d+(?:[.,]\d+)?\s*\$)", sizing)[0].strip()
                imgs = t.get("productImage") or [{}]
                was = parse_price(pr.get("wasPrice")) if pr.get("wasPrice") else None  # "3,29 $"
                out.append(item("maxi", id=t.get("productId"), name=t.get("title"), brand=t.get("brand"), size=size,
                                category=name,  # the department being walked ("Fruits et légumes")
                                price=price, regular=was,
                                unit=unit_from_text(sizing) or unit_from_size(price, size),
                                image=imgs[0].get("smallUrl") or imgs[0].get("thumbnailUrl"),
                                url=site + t["link"] if t.get("link") else None))
            yield out
            ctx.page_saved(code, page)
            if len(ts) < 48:
                break
            page += 1
        ctx.unit_finished(code)


def crawl_gianttiger(ctx, cfg):
    """Crawl Giant Tiger grocery listings (Québec) from its search index."""
    from sources.gianttiger import hit_to_item, query_index
    ff = [["named_tags.L1_category_en:Grocery"], ["named_tags.mms_province_code:QC"]]
    facets = ctx.call(query_index, {"query": "", "hitsPerPage": 0, "facetFilters": ff,
                                    "facets": ["named_tags.L3_category_en"], "maxValuesPerFacet": 500}) or {}
    cats = (facets.get("facets") or {}).get("named_tags.L3_category_en", {})

    # The index returns at most 1000 hits per query, so make every query as full as possible: small
    # categories are packed together (an inner facetFilters list means OR) up to 1000 listings per request,
    # and a category over 1000 is packed by brand the same way. 6 782 listings -> ~11 requests (was ~247).
    def pack(counts):
        out, cur, size = [], [], 0
        for v, n in sorted(counts.items(), key=lambda x: -x[1]):
            if size + n > 1000 and cur:
                out.append(cur)
                cur, size = [], 0
            cur.append(v)
            size += n
        return out + ([cur] if cur else [])

    units = [(f"pack{i}", ff + [[f"named_tags.L3_category_en:{c}" for c in vals]])
             for i, vals in enumerate(pack({c: n for c, n in cats.items() if n <= 1000}), 1)]
    for cat, n in cats.items():
        if n > 1000:
            cf = ff + [[f"named_tags.L3_category_en:{cat}"]]
            vend = ctx.call(query_index, {"query": "", "hitsPerPage": 0, "facetFilters": cf,
                                          "facets": ["vendor"], "maxValuesPerFacet": 1000}) or {}
            for j, vals in enumerate(pack((vend.get("facets") or {}).get("vendor") or {}), 1):
                units.append((f"big:{cat}:{j}", cf + [[f"vendor:{v}" for v in vals]]))
    ctx.units_total(len(units))
    log(f"gianttiger: {len(cats)} categories in {len(units)} queries, {facets.get('nbHits')} Québec grocery listings")
    for unit, sl in units:
        if ctx.unit_done(unit):
            continue
        d = ctx.call(query_index, {"query": "", "hitsPerPage": 1000, "page": 0, "facetFilters": sl}) or {}
        hits = d.get("hits", [])
        if (d.get("nbHits") or 0) > len(hits):
            log(f"gianttiger: {unit}: only {len(hits)} of {d.get('nbHits')} listings returned")
        # one listing per pricing region: keep the most Québec-specific one per title (as live search does)
        best = {}
        for h in hits:
            conv = hit_to_item(h, LANG)
            if not conv:
                continue
            provinces, it = conv
            key = (it["name"].lower(), it["size"])
            if key not in best or len(provinces) < best[key][0]:
                best[key] = (len(provinces) or 99, it)
        yield [v[1] for v in best.values()]
        ctx.unit_finished(unit)


_METRO_SKIP = re.compile(r"loterie|entretien|animaux|beaute|sante|pharmacie|maison|format-economique|articles-menagers", re.I)


def _crawl_metro_like(ctx, key):
    """Crawl every food aisle, page by page, for Metro or Super C (they share one platform)."""
    from sources.metro import BANNERS, parse_tiles
    b = BANNERS[key]["base"]
    index = b + ("/epicerie-en-ligne/allees" if key == "metro" else "/allees")
    r = ctx.get(index)
    aisles = sorted({a for a in re.findall(r'href="(/(?:epicerie-en-ligne/)?allees/[a-z0-9-]+)"', r.text if r else "")
                     if "-page-" not in a and not _METRO_SKIP.search(a)})
    ctx.units_total(len(aisles))
    log(f"{key}: {len(aisles)} food aisles")
    for a in aisles:
        if ctx.unit_done(a):
            continue
        page = ctx.first_page(a)
        seen = set()
        while page <= 300:
            r = ctx.get(b + a + (f"-page-{page}" if page > 1 else ""))
            items = parse_tiles(key, r.text) if r else []
            new = [i for i in items if i["id"] not in seen]
            if not new:
                break
            seen.update(i["id"] for i in new)
            yield new
            ctx.page_saved(a, page)
            page += 1
        ctx.unit_finished(a)


def crawl_metro(ctx, cfg):
    """Crawl Metro's food aisles."""
    yield from _crawl_metro_like(ctx, "metro")


def crawl_superc(ctx, cfg):
    """Crawl Super C's food aisles."""
    yield from _crawl_metro_like(ctx, "superc")


def crawl_iga(ctx, cfg):
    """Crawl IGA department by department."""
    from sources.iga import BASE, parse_page, to_items
    r = ctx.get(f"{BASE}/fr/epicerie_en_ligne")
    cats = sorted(set(re.findall(r'href="(/fr/epicerie_en_ligne/[a-z_]+)"', r.text if r else "")))
    ctx.units_total(len(cats))
    log(f"iga: {len(cats)} departments")
    for c in cats:
        if ctx.unit_done(c):
            continue
        page = ctx.first_page(c)
        seen = set()
        while page <= 400:
            r = ctx.get(BASE + c, params={"pageSize": 100, "page": page})
            items = to_items(parse_page(r.text)) if r else []
            new = [i for i in items if i["id"] not in seen]
            if not new:
                break
            seen.update(i["id"] for i in new)
            yield new
            ctx.page_saved(c, page)
            page += 1
        ctx.unit_finished(c)


def crawl_walmart(ctx, cfg):
    """Best effort: Walmart lists at most 25 pages per category, so bigger categories are split
    into their sub-categories. Stops at the first bot check (Blocked); the category tree found so
    far and every saved page are remembered, so the next run continues from there."""
    from sources.walmart import BASE, next_data, parse_items, search_result
    queue, visited = ["/fr/browse/epicerie/10019"], set()

    def page_data(path, page):
        r = ctx.get(BASE + path, params={"page": page} if page > 1 else None)
        if r is None:
            return None
        try:
            return next_data(r.text)
        except SourceError as e:
            raise Blocked(str(e))

    while queue:
        path = queue.pop(0)
        if path in visited:
            continue
        visited.add(path)
        info = ctx.unit_info(path)
        if info.get("children"):           # split earlier this week: go straight to its sub-categories
            queue.extend(info["children"])
            continue
        if ctx.unit_done(path):
            continue
        start = ctx.first_page(path)
        if start == 1 or not info.get("max_page"):
            data = page_data(path, 1)
            if data is None:
                continue
            sr = search_result(data)
            count = ((sr.get("itemStacks") or [{}])[0] or {}).get("count") or 0
            max_page = (sr.get("paginationV2") or {}).get("maxPage") or 1
            cid = path.rsplit("/", 1)[-1]
            children = sorted({c for c in re.findall(r"/fr/browse/epicerie/[a-z0-9/-]+/10019[\d_]*", json.dumps(data))
                               if c.rsplit("/", 1)[-1].startswith(cid + "_")})
            if count > max_page * 40 and children:   # too big to list fully: go one level deeper
                ctx.unit_finished(path, info={"children": children})
                queue.extend(children)
                continue
            ctx.set_info(path, {"max_page": max_page})
            if start == 1:
                yield parse_items(data)
                ctx.page_saved(path, 1)
                start = 2
        else:
            max_page = info["max_page"]
        for page in range(start, max_page + 1):
            data = page_data(path, page)
            if data is None:
                break
            yield parse_items(data)
            ctx.page_saved(path, page)
        ctx.unit_finished(path)


def crawl_voila(ctx, cfg):
    """voila.ca blocks automated clients (AWS WAF challenge): store its weekly flyer from Flipp."""
    fl = [f for f in (ctx.call(flipp.flyers, LANG, cfg["postal"]) or []) if f["store"] == "voila"]
    ctx.units_total(len(fl))
    log(f"voila: {len(fl)} Voilà flyer(s) on Flipp")
    for f in fl:
        if ctx.unit_done(str(f["id"])):
            continue
        out = []
        for it in ctx.call(flipp.flyer, f["id"], LANG) or []:
            if it.get("price") is None:
                continue
            name = it.get("name") or ""
            # the size is only in the name: "Compliments Pommes mcintosh 1.81 kg"
            m = re.search(r"\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|ml|l|lb|un)\b", name, re.I)
            out.append(item("voila", id=f"flyer-{it['id']}", name=name, brand=it.get("brand"),
                            price=it["price"], image=it.get("image"), size=m.group(0) if m else None,
                            unit=unit_from_size(it["price"], m.group(0)) if m else None,
                            url=f"https://flipp.com/fr-ca/item/{it['id']}", promo="flyer"))
        yield out
        ctx.unit_finished(str(f["id"]))


CRAWLERS = {"maxi": crawl_maxi, "metro": crawl_metro, "superc": crawl_superc, "iga": crawl_iga,
            "gianttiger": crawl_gianttiger, "walmart": crawl_walmart, "voila": crawl_voila}


# ---------------------------------------------------------------- scheduling

def week_starts(cfg):
    """store -> start (epoch) of its current flyer week, read from Flipp."""
    starts, now = {}, time.time()
    try:
        for f in flipp.flyers(LANG, cfg["postal"]):
            if not f.get("store") or not f.get("valid_from"):
                continue
            t = datetime.datetime.fromisoformat(f["valid_from"]).timestamp()
            if t <= now:
                starts[f["store"]] = max(starts.get(f["store"], 0), t)
    except Exception as e:
        log(f"could not read flyer weeks from Flipp ({e}); using the 7-day rule only")
    return starts


def due(stores, cfg, starts=None):
    """-> {store: reason} for stores that should be crawled now."""
    starts = week_starts(cfg) if starts is None else starts
    now, out = time.time(), {}
    runs = pricedb.last_runs()
    for s in stores:
        # never two crawls of the same store, or of stores sharing a platform, at once
        # (e.g. a manual retry while the nightly run is still working through Metro then Super C)
        group = next((g for g in SAME_PLATFORM if s in g), (s,))
        busy = [g for g in group if (runs.get(g) or {}).get("status") == "running"
                and now - (runs[g]["started_at"] or 0) < 6 * 3600]
        if busy:
            b = busy[0]
            log(f"{s}: skipped — a {b} crawl is already running since "
                f"{time.strftime('%H:%M', time.localtime(runs[b]['started_at']))}")
            continue
        last_ok = pricedb.last_success(s)                       # complete crawls only
        last_try = pricedb.last_success(s, statuses=("ok", "partial", "failed"))
        start = starts.get(s)
        if last_try is None:
            out[s] = "never crawled"
        elif start and (last_ok or 0) < start:
            out[s] = (f"new flyer week since {time.strftime('%a %d %b %H:%M', time.localtime(start))}"
                      if (last_try or 0) < start else "retry: continue where the last crawl stopped")
        elif last_ok is None or now - last_ok > WEEK:
            out[s] = "last complete crawl is 7+ days old"
    return out


def week_key(store, starts):
    """Checkpoints belong to the store's current flyer week; a new week starts from scratch."""
    t = starts.get(store)
    return time.strftime("%Y-%m-%d", time.localtime(t)) if t else time.strftime("%G-W%V")


def run_store(store, cfg, limit=None, starts=None):
    """Crawl one store, saving products as they arrive and checkpointing progress.

    limit: test mode, stop after N pages (not recorded as a crawl).
    Returns (store, status, products saved); status is ok, partial, failed or test.
    """
    base.PURPOSE.v = "crawl"          # request log: this thread's requests are crawl requests
    week = week_key(store, starts or {})
    ctx = Ctx(store, week, record=not limit)
    prev = pricedb.last_ok_products(store)
    run_id, saved, t0 = pricedb.start_run(store), {}, time.time()
    status, note = "ok", ""
    done_before = sum(1 for p in ctx.progress.values() if p.get("done"))
    resume = f" (resuming week {week}: {done_before} units already done)" if done_before or ctx.progress else ""
    log(f"{store}: start" + (f" (test: first {limit} pages)" if limit else resume))
    try:
        for n, batch in enumerate(CRAWLERS[store](ctx, cfg), 1):
            if limit and n > limit:
                status, note = "test", f"stopped after {limit} pages (--limit)"
                break
            fresh = [i for i in batch if i and i.get("id") and i["id"] not in saved]
            if fresh:
                pricedb.save_products(store, LANG, fresh)
                saved.update((i["id"], 1) for i in fresh)
    except Blocked as e:
        status, note = ("partial" if saved else "failed"), f"stopped: {e}"
    except Exception as e:  # a markup change etc.: keep what we have
        status, note = ("partial" if saved else "failed"), f"{type(e).__name__}: {e}"
    if status == "ok" and prev and len(saved) < 0.7 * prev:
        # old rows are never deleted, so nothing is lost; the note says why the new count looks off
        note = f"suspect: {len(saved)} products vs {prev} last complete crawl"
    pricedb.finish_run(run_id, len(saved), ctx.requests, status, note)
    if saved:
        pricedb.rebuild_fts()          # searches are answered from this index: pick up new names
    log(f"{store}: {status} — {len(saved)} products, {ctx.requests} requests, {time.time() - t0:.0f}s {note}")
    return store, status, len(saved)


def main():
    """CLI entry point: crawl the stores that are due (or --force / --retry), or print --status."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", nargs="*", metavar="STORE", help="crawl these stores now (none listed = all)")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, help="test: stop each store after N pages (not counted as a crawl)")
    ap.add_argument("--retry", action="store_true",
                    help="only continue stores whose crawl for the current flyer week stopped early")
    args = ap.parse_args()
    cfg = config()
    stores = list(CRAWLERS)
    starts = week_starts(cfg)

    if args.status:
        runs, todo = pricedb.last_runs(), due(stores, cfg, starts)
        for s, t in sorted(week_starts(cfg).items()):
            print(f"flyer week: {s:11} started {time.strftime('%a %d %b %H:%M', time.localtime(t))}")
        for s in stores:
            r = runs.get(s)
            when = time.strftime("%a %d %b %H:%M", time.localtime(r["finished_at"] or r["started_at"])) if r else "never"
            desc = f"{r['status']:8} {r['products'] or 0:6} products  {when}" if r else "never crawled"
            prog = pricedb.get_progress(s, week_key(s, starts))
            done = sum(1 for p in prog.values() if p.get("done"))
            week = f"week {week_key(s, starts)}: {done} units done" if prog else ""
            print(f"{s:11} {desc}   {week:32} {'DUE: ' + todo[s] if s in todo else ''}")
        print(json.dumps(pricedb.stats()))
        return

    if args.force is not None:
        todo = {s: "forced" for s in (args.force or stores) if s in CRAWLERS}
    else:
        todo = due(stores, cfg, starts)
        if args.retry:
            todo = {s: why for s, why in todo.items() if why.startswith("retry")}
    if not todo:
        log("nothing due")
        return
    for s, why in todo.items():
        log(f"{s}: due ({why})")
    if args.dry_run:
        return
    # stores in parallel, each polite on its own; stores sharing a platform run one after the other
    lanes = []
    for group in SAME_PLATFORM:
        lane = [s for s in group if s in todo]
        if lane:
            lanes.append(lane)
    lanes += [[s] for s in todo if not any(s in g for g in SAME_PLATFORM)]
    with ThreadPoolExecutor(len(lanes)) as ex:
        results = [r for lane in ex.map(lambda ln: [run_store(s, cfg, args.limit, starts) for s in ln], lanes)
                   for r in lane]
    log("done: " + ", ".join(f"{s} {st} {n}" for s, st, n in results))
    try:                               # housekeeping: drop repeated history rows, one backup a day (newest 7 kept)
        removed, dest = pricedb.compact_history(), pricedb.backup_daily()
        log(f"housekeeping: {removed} repeated history rows dropped" + (f", backup {os.path.basename(dest)}" if dest else ""))
    except Exception as e:
        log(f"housekeeping failed: {type(e).__name__}: {e}")


if __name__ == "__main__":
    sys.exit(main())
