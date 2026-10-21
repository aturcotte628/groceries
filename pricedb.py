"""Persistent store of every product price we have crawled or searched (data/prices.db, SQLite).

- `products`: latest known price per store product, fed by the weekly crawl and by every live search.
  `gtin` = barcode without leading zeros (the real UPC, or the one hidden in Maxi's picture file name),
  `first_seen` / `updated_at` = when we first / last saw the product.
- `products_fts`: full-text index over name, brand and size, so searches are answered from this database
  instead of from the stores (see search_db). Rebuilt after every crawl; new products found by live
  searches are added as they arrive.
- `searches`: each live store search's full result, so a failed store call can fall back to old prices.
- `price_history`: a row only when a product's price (or regular price) CHANGED, valid until the next row.
- `request_log`: every request sent to a store (crawl / live), to see and cap what we cost them.
"""
import json
import os
import re
import sqlite3
import threading
import time

from categories import classify

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "prices.db")
_lock = threading.RLock()
_conn = None
HAS_FTS = True

SCHEMA = """
CREATE TABLE IF NOT EXISTS searches (
    store TEXT, lang TEXT, store_id TEXT, q TEXT,
    fetched_at REAL, items TEXT,
    PRIMARY KEY (store, lang, store_id, q)
);
CREATE TABLE IF NOT EXISTS products (
    store TEXT, id TEXT, lang TEXT,
    name TEXT, brand TEXT, size TEXT, upc TEXT,
    price REAL, regular REAL, unit_value REAL, unit_dim TEXT, points INTEGER,
    url TEXT, image TEXT, updated_at REAL,
    PRIMARY KEY (store, id, lang)
);
CREATE TABLE IF NOT EXISTS price_history (
    store TEXT, id TEXT, day TEXT, price REAL, regular REAL,
    PRIMARY KEY (store, id, day)
);
CREATE INDEX IF NOT EXISTS products_upc ON products (upc);
CREATE TABLE IF NOT EXISTS crawl_progress (
    store TEXT, week TEXT, unit TEXT,
    next_page INTEGER, done INTEGER, info TEXT, updated_at REAL,
    PRIMARY KEY (store, week, unit)
);
CREATE TABLE IF NOT EXISTS crawl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT, started_at REAL, finished_at REAL,
    products INTEGER, requests INTEGER, status TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS request_log (
    ts REAL, store TEXT, purpose TEXT, status TEXT
);
CREATE INDEX IF NOT EXISTS request_log_ts ON request_log (ts);
"""

# Maxi's API almost never returns a barcode, but its picture files are named after the GTIN:
# ".../6107731536_enfr_front_..._250.png" = UPC 061077315367 without leading 0 and check digit.
_IMG_GTIN = re.compile(r"/(\d{10,13})_(?:enfr|fr|en)_")


def gtin_of(upc, image=None):
    """Barcode digits without leading zeros: the real UPC, else the one in the picture's file name."""
    g = str(upc or "").lstrip("0")
    if not g:
        m = _IMG_GTIN.search(image or "")
        g = m.group(1).lstrip("0") if m else ""
    return g or None


def _migrate(c):
    """Add columns introduced after the first schema and backfill them from saved searches."""
    cols = {r[1] for r in c.execute("PRAGMA table_info(products)")}
    new = not ({"gtin", "first_seen", "promo", "stock", "price_per"} <= cols)
    for col, typ in (("category", "TEXT"), ("gtin", "TEXT"), ("first_seen", "REAL"),
                     ("promo", "TEXT"), ("stock", "INTEGER"), ("price_per", "TEXT")):
        if col not in cols:
            c.execute(f"ALTER TABLE products ADD COLUMN {col} {typ}")
    if new:
        c.executemany("UPDATE products SET gtin=? WHERE rowid=?",
                      [(gtin_of(u, i), rid) for rid, u, i in c.execute("SELECT rowid, upc, image FROM products").fetchall()])
        c.execute("UPDATE products SET first_seen = updated_at WHERE first_seen IS NULL")
        # promo / stock / price_per were not stored before: take them from the saved live searches
        for store, lang, items in c.execute("SELECT store, lang, items FROM searches").fetchall():
            for it in json.loads(items):
                c.execute("UPDATE products SET promo=COALESCE(promo, ?), stock=COALESCE(stock, ?), "
                          "price_per=COALESCE(price_per, ?) WHERE store=? AND id=? AND lang=?",
                          (it.get("promo"), None if it.get("stock") is None else int(bool(it["stock"])),
                           it.get("price_per"), store, str(it.get("id")), lang))
    c.execute("CREATE INDEX IF NOT EXISTS products_gtin ON products (gtin)")
    c.execute("CREATE INDEX IF NOT EXISTS products_store ON products (store)")
    c.execute("DELETE FROM request_log WHERE ts < ?", (time.time() - 30 * 86400,))
    c.commit()
    _ensure_fts(c)


def _ensure_fts(c):
    """Create the full-text index on first use; without FTS5, searches fall back to LIKE."""
    global HAS_FTS
    try:
        have = c.execute("SELECT 1 FROM sqlite_master WHERE name='products_fts'").fetchone()
        if not have:
            c.execute("CREATE VIRTUAL TABLE products_fts USING fts5(name, brand, size, store UNINDEXED, "
                      "id UNINDEXED, lang UNINDEXED, tokenize='unicode61 remove_diacritics 2')")
            _rebuild(c)
    except sqlite3.OperationalError:   # SQLite built without FTS5: searches fall back to LIKE
        HAS_FTS = False


def _rebuild(c):
    """Rebuild the full-text index from the products table."""
    c.execute("DELETE FROM products_fts")
    c.execute("INSERT INTO products_fts (name, brand, size, store, id, lang) "
              "SELECT COALESCE(name,''), COALESCE(brand,''), COALESCE(size,''), store, id, lang FROM products")
    c.commit()


def _db():
    """Shared SQLite connection (WAL mode), created and migrated on first use."""
    global _conn
    if _conn is None:
        os.makedirs(os.path.dirname(PATH), exist_ok=True)
        c = sqlite3.connect(PATH, check_same_thread=False, timeout=30)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)
        _migrate(c)
        _conn = c
    return _conn


def rebuild_fts():
    """Re-index every product (after a crawl: names may have changed)."""
    with _lock:
        if HAS_FTS:
            _rebuild(_db())


def get_search(store, lang, store_id, q):
    """-> (fetched_at, items) or None."""
    with _lock:
        row = _db().execute(
            "SELECT fetched_at, items FROM searches WHERE store=? AND lang=? AND store_id=? AND q=?",
            (store, lang, store_id or "", q.lower())).fetchone()
    return (row[0], json.loads(row[1])) if row else None


_UPSERT = """
INSERT INTO products (store, id, lang, name, brand, size, upc, price, regular, unit_value, unit_dim, points,
                      url, image, updated_at, category, gtin, first_seen, promo, stock, price_per)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT (store, id, lang) DO UPDATE SET
    name=excluded.name, brand=excluded.brand, size=excluded.size, upc=COALESCE(excluded.upc, products.upc),
    price=excluded.price, regular=excluded.regular, unit_value=excluded.unit_value, unit_dim=excluded.unit_dim,
    points=excluded.points, url=COALESCE(excluded.url, products.url), image=COALESCE(excluded.image, products.image),
    updated_at=excluded.updated_at, category=COALESCE(excluded.category, products.category),
    gtin=COALESCE(excluded.gtin, products.gtin), promo=excluded.promo, stock=excluded.stock,
    price_per=excluded.price_per
"""


def _upsert(db, store, lang, items, now):
    """Insert or update products from a result list and keep new ones searchable at once."""
    day = time.strftime("%Y-%m-%d", time.localtime(now))
    for it in items:
        pid = str(it["id"])
        unit = it.get("unit") or {}
        known = db.execute("SELECT 1 FROM products WHERE store=? AND id=? AND lang=?", (store, pid, lang)).fetchone()
        stock = it.get("stock")
        db.execute(_UPSERT, (store, pid, lang, it.get("name"), it.get("brand"), it.get("size"), it.get("upc"),
                             it.get("price"), it.get("regular"), unit.get("value"), unit.get("dim"), it.get("points"),
                             it.get("url"), it.get("image"), now, it.get("category"),
                             gtin_of(it.get("upc"), it.get("image")), now, it.get("promo"),
                             None if stock is None else int(bool(stock)), it.get("price_per")))
        if not known and HAS_FTS:   # a product we never saw: searchable right away
            db.execute("INSERT INTO products_fts (name, brand, size, store, id, lang) VALUES (?,?,?,?,?,?)",
                       (it.get("name") or "", it.get("brand") or "", it.get("size") or "", store, pid, lang))
        if it.get("price") is not None:
            last = db.execute("SELECT price, regular FROM price_history WHERE store=? AND id=? ORDER BY day DESC LIMIT 1",
                              (store, pid)).fetchone()
            # history keeps changes only: a row is valid until the next row (products.updated_at = last seen)
            if not last or last[0] != it["price"] or last[1] != it.get("regular"):
                db.execute("INSERT OR REPLACE INTO price_history VALUES (?,?,?,?,?)",
                           (store, pid, day, it["price"], it.get("regular")))


def save_search(store, lang, store_id, q, items):
    """Store a live search result and upsert its products. Returns the save time."""
    now = time.time()
    with _lock:
        db = _db()
        db.execute("INSERT OR REPLACE INTO searches VALUES (?,?,?,?,?,?)",
                   (store, lang, store_id or "", q.lower(), now, json.dumps(items, ensure_ascii=False)))
        _upsert(db, store, lang, items, now)
        db.commit()
    return now


def save_products(store, lang, items):
    """Bulk save from the weekly crawl (latest price; a history row only when the price changed)."""
    with _lock:
        db = _db()
        _upsert(db, store, lang, items, time.time())
        db.commit()


# ---------------------------------------------------------------- reading from the database

def _item(r):
    """products row -> the item shape live searches return."""
    price, regular = r["price"], r["regular"]
    sale = regular is not None and price is not None and regular > price + 0.001
    unit = {"value": r["unit_value"], "dim": r["unit_dim"]} if r["unit_value"] is not None and r["unit_dim"] else None
    return {
        "store": r["store"], "id": r["id"], "name": r["name"] or "", "brand": r["brand"], "size": r["size"],
        "price": price, "regular": regular if sale else None, "sale": sale, "promo": r["promo"], "unit": unit,
        "image": r["image"], "url": r["url"], "price_per": r["price_per"],
        "stock": None if r["stock"] is None else bool(r["stock"]),
        "upc": r["upc"], "points": r["points"], "category": r["category"], "group": classify(r["category"]),
        "updated_at": r["updated_at"], "source": "db",
    }


_STOP = {"de", "du", "des", "la", "le", "les", "un", "une", "et", "en", "au", "aux", "a", "d", "l", "the", "of", "and"}
_TOK = re.compile(r"[^\W_]+", re.UNICODE)


def _fts_query(q):
    """Build an FTS5 query: stop words dropped, tokens of 3+ chars matched as prefixes."""
    toks = [t.lower() for t in _TOK.findall(q or "")]
    toks = [t for t in toks if t not in _STOP] or [t.lower() for t in _TOK.findall(q or "")]
    # prefix match ("oeuf*" finds "oeufs"); very short tokens must match whole
    return " ".join(f'"{t}"*' if len(t) >= 3 else f'"{t}"' for t in toks)


def search_db(store, q, lang="fr", limit=80):
    """Products of one store matching every word of q (best matches first), from this database."""
    fq = _fts_query(q)
    if not fq:
        return []
    with _lock:
        db = _db()
        if HAS_FTS:
            rows = db.execute(
                "SELECT p.* FROM products_fts f JOIN products p ON p.store=f.store AND p.id=f.id AND p.lang=f.lang "
                "WHERE products_fts MATCH ? AND f.store=? ORDER BY (p.lang=?) DESC, bm25(products_fts, 10.0, 4.0, 1.0) "
                "LIMIT ?", (fq, store, lang, limit * 2)).fetchall()
        else:
            toks = [t.lower() for t in _TOK.findall(q)][:5]
            where = " AND ".join("(LOWER(name) LIKE ? OR LOWER(brand) LIKE ?)" for _ in toks)
            args = [x for t in toks for x in (f"%{t}%", f"%{t}%")]
            rows = db.execute(f"SELECT * FROM products WHERE store=? AND {where} LIMIT ?", (store, *args, limit * 2)).fetchall()
    seen, out = set(), []
    for r in rows:                      # one row per product: the requested language first
        if r["id"] not in seen:
            seen.add(r["id"])
            out.append(_item(r))
    return out[:limit]


def by_gtin(store, gtin):
    """Products of a store with this barcode (also matches when only one side carries the check digit)."""
    g = str(gtin or "").lstrip("0")
    if len(g) < 8:
        return []
    with _lock:
        rows = _db().execute(
            "SELECT * FROM products WHERE store=? AND (gtin=? OR gtin=? OR gtin LIKE ?)",
            (store, g, g[:-1], g + "_")).fetchall()
    seen, out = set(), []
    for r in rows:
        if r["id"] not in seen:
            seen.add(r["id"])
            out.append(_item(r))
    return out


# ---------------------------------------------------------------- crawl bookkeeping

def start_run(store):
    """Record the start of a crawl and return its run id."""
    with _lock:
        db = _db()
        cur = db.execute("INSERT INTO crawl_runs (store, started_at, status) VALUES (?,?,?)", (store, time.time(), "running"))
        db.commit()
        return cur.lastrowid


def finish_run(run_id, products, requests, status, note=""):
    """Close a crawl run with its product count, request count and status."""
    with _lock:
        db = _db()
        db.execute("UPDATE crawl_runs SET finished_at=?, products=?, requests=?, status=?, note=? WHERE id=?",
                   (time.time(), products, requests, status, note[:500], run_id))
        db.commit()


def get_progress(store, week):
    """Crawl checkpoints for a store's flyer week: {unit: {next_page, done, info}}."""
    with _lock:
        rows = _db().execute("SELECT unit, next_page, done, info FROM crawl_progress WHERE store=? AND week=?",
                             (store, week)).fetchall()
    return {u: {"next_page": n, "done": d, "info": json.loads(i) if i else {}} for u, n, d, i in rows}


def set_progress(store, week, unit, next_page, done, info):
    """Checkpoint a crawl unit (department/aisle/category) so an interrupted crawl can resume."""
    with _lock:
        db = _db()
        db.execute("INSERT OR REPLACE INTO crawl_progress VALUES (?,?,?,?,?,?,?)",
                   (store, week, unit, next_page, done, json.dumps(info) if info else None, time.time()))
        db.commit()


def last_runs():
    """Latest crawl per store: {store: {started_at, finished_at, products, requests, status, note}}."""
    with _lock:
        rows = _db().execute(
            "SELECT store, started_at, finished_at, products, requests, status, note FROM crawl_runs "
            "WHERE id IN (SELECT MAX(id) FROM crawl_runs GROUP BY store)").fetchall()
    keys = ("started_at", "finished_at", "products", "requests", "status", "note")
    return {r[0]: dict(zip(keys, r[1:])) for r in rows}


def last_success(store, statuses=("ok",)):
    """End time of the store's last crawl with one of these statuses (default: complete crawls)."""
    with _lock:
        row = _db().execute(
            f"SELECT MAX(finished_at) FROM crawl_runs WHERE store=? AND status IN ({','.join('?' * len(statuses))})",
            (store, *statuses)).fetchone()
    return row[0] if row else None


def last_ok_products(store):
    """Product count of the store's last complete crawl (None if there is none)."""
    with _lock:
        row = _db().execute("SELECT products FROM crawl_runs WHERE store=? AND status='ok' "
                            "ORDER BY id DESC LIMIT 1", (store,)).fetchone()
    return row[0] if row else None


def categories_for(store, ids):
    """{product id: category} known for these products (from crawls and earlier searches)."""
    ids = [i for i in ids if i]
    if not ids:
        return {}
    with _lock:
        rows = _db().execute(
            f"SELECT id, category FROM products WHERE store=? AND category IS NOT NULL AND id IN ({','.join('?' * len(ids))})",
            (store, *ids)).fetchall()
    return {r[0]: r[1] for r in rows}


# ---------------------------------------------------------------- request log, maintenance

def log_request(store, purpose, status):
    """One row per request sent to a store (purpose: crawl / live)."""
    try:
        with _lock:
            db = _db()
            db.execute("INSERT INTO request_log VALUES (?,?,?,?)", (time.time(), store, purpose, str(status)))
            db.commit()
    except sqlite3.Error:
        pass


def request_stats(days=7):
    """Requests per day / store / purpose, with how many did not come back OK."""
    with _lock:
        rows = _db().execute(
            "SELECT date(ts,'unixepoch','localtime') d, store, purpose, COUNT(*) n, "
            "SUM(CASE WHEN status IN ('200','201') THEN 0 ELSE 1 END) bad "
            "FROM request_log WHERE ts > ? GROUP BY 1,2,3 ORDER BY 1 DESC, 2, 3", (time.time() - days * 86400,)).fetchall()
    return [{"day": r["d"], "store": r["store"], "purpose": r["purpose"], "requests": r["n"], "not_ok": r["bad"]} for r in rows]


def compact_history():
    """Drop history rows that repeat the previous row's prices (older data kept one row per day)."""
    with _lock:
        db = _db()
        n = db.execute(
            "DELETE FROM price_history WHERE rowid IN (SELECT rid FROM ("
            " SELECT rowid AS rid, price, regular, LAG(price) OVER w AS pp, LAG(regular) OVER w AS pr "
            " FROM price_history WINDOW w AS (PARTITION BY store, id ORDER BY day)) "
            " WHERE pp IS price AND pr IS regular)").rowcount
        db.commit()
    return n


def backup_daily(keep=7):
    """One consistent copy of the database per day in data/backup/, the newest `keep` kept."""
    folder = os.path.join(os.path.dirname(PATH), "backup")
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, time.strftime("prices-%Y%m%d.db"))
    if os.path.exists(dest):
        return None
    with _lock:
        db = _db()
        db.commit()
        db.execute("VACUUM INTO ?", (dest,))
    for old in sorted(f for f in os.listdir(folder) if f.startswith("prices-") and f.endswith(".db"))[:-keep]:
        os.remove(os.path.join(folder, old))
    return dest


def stats():
    """Counts per table and store, DB file size in MB and whether full-text search is on."""
    with _lock:
        db = _db()
        n = lambda sql: db.execute(sql).fetchone()[0]
        return {
            "searches": n("SELECT COUNT(*) FROM searches"),
            "products": n("SELECT COUNT(*) FROM products"),
            "history_rows": n("SELECT COUNT(*) FROM price_history"),
            "by_store": {r[0]: r[1] for r in db.execute("SELECT store, COUNT(*) FROM products GROUP BY store").fetchall()},
            "file_mb": round(os.path.getsize(PATH) / 1e6, 2) if os.path.exists(PATH) else 0,
            "fts": HAS_FTS,
        }
