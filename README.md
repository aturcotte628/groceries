# Panier — grocery price scanner

Search once, compare grocery prices across **IGA, Metro, Super C, Maxi, Giant Tiger (Tigre Géant) and Walmart**, ranked by unit price ($/kg, $/L, $/unit). Bilingual FR/EN, mobile-first.

```
python app.py          # http://127.0.0.1:5055
python app.py --lan    # listen on the local network too (phone on same Wi-Fi)
run.cmd                # same, and opens the browser
```

Requires Python 3.10+ and `pip install -r requirements.txt` (Flask, curl_cffi, beautifulsoup4). No build step.

## Features

- **Compare**: each store is queried in parallel and shown as soon as it answers. Store cards show each chain's best unit price, and the overall cheapest is flagged. Filters: close matches only, on sale only. Sorting: unit price, price, or store.
- **Category filter**: the Compare page's **Category** menu (with counts) narrows results to one shared category, e.g. `?q=fraise&cat=fruits` shows only fresh strawberries. `categories.py` maps every store's own categories to 14 shared groups. Maxi's live search has none, so its department comes from the weekly crawl.
- **Brand filter**: under the categories in the left column. Tick one or several brands; the list shows brands of the selected category, by product count, top 10 plus "show all". Spellings are merged ("QUÉBON" = "Québon"), product lines fold into their brand ("Lactantia PurFiltre" → Lactantia), and brandless products (often Walmart) are recognized by their name. URL `&brand=natrel,quebon`. On phones it's a dropdown.
- **Barcode scan**: the camera reads EAN/UPC codes (native `BarcodeDetector`, or ZXing from jsdelivr as a fallback). Open Food Facts turns the code into a product name, which is then searched everywhere. You can also type the code by hand.
- **Flyers**: this week's flyer deals near a postal code, from Flipp. It can include other chains too (Super C, Provigo, …).
- **List & trip planner**: write what you need ("lait 2% 4L" × 2, "oeufs douzaine", "beurre"), or add it from Compare or a flyer. **Find where to shop** searches every enabled store for every item, then tries every combination of stores. It only recommends one more store if that saves at least your **minimum-savings threshold** (default 10 $), up to a **max number of stores** (default 3). It shows each option (1, 2, 3… stores), the recommended split ("where to buy what"), and a price grid of item × store. Each line has a dropdown to swap the chosen product (e.g. when the cheapest match is quail eggs), and the choice is remembered. The list is stored in the browser (localStorage).
  - **Suggestions while typing**: the add box suggests real products from Giant Tiger, Maxi and Metro (`/api/suggest`, merged across stores, with size and lowest price). Pick one to **target that product**; each store then prices the same brand at the closest package size. Or keep the first option, "« beurre » — any product".
  - **Same product across stores**: stores name one product very differently (Walmart "Christie CHIPS AHOY ! Biscuits aux pépites de chocolat originaux, 1 emballage refermable" is Metro's brand "Chips Ahoy!" + "Biscuits aux brisures de chocolat"). Matching uses:
    1. the **barcode** when both sides have one (IGA, Metro, Super C, Maxi expose it; Walmart and Giant Tiger don't). A product picked from Walmart or Giant Tiger borrows the barcode of a confident same-name, same-size match elsewhere;
    2. otherwise a **similarity score**: distinctive words count more than common ones, "pépites" and "brisures" are synonyms, packaging words are ignored, and extra variant words ("tendres", "mini") are penalized. Then the closest package size.
    A branded product whose brand appears nowhere in a candidate that has words of its own (Walmart's brandless "Margarine avec huile d'olive Great Value" vs Becel) is treated as another brand.
  - **Where to buy what** lists, under each item, its price at the other stores ("Elsewhere: Super C 5,29 $ · Maxi 5,29 $ …"), so nothing found is hidden. Products a store sells without a size (common at Walmart) are marked **size unknown**: their price can't be scaled to the same amount.
    Stores are searched with what you typed plus a short "brand + first words" query, not the whole product name.
  - **"Substitute if on sale" checkbox** (targeted products): the planner also searches the words you typed and looks for a similar product **on sale** that's cheaper for the same amount. It is only **proposed**: the plan keeps pricing your product, and each proposal shows under the line ("♻ On sale: Gay Lea Beurre Salé 4,95 $, saves 3,02 $ [Use]"). The plan also says how many substitutes are proposed and the possible savings. **Use** accepts substitutes for that item: every store then uses its cheaper sale substitute (♻) in the price grid, totals and store choice, and the list row shows "♻ substitutes in use". **Undo**, or unticking the box, returns every store to your product. "Similar" means the same main noun: the first word of a French name, including its "de/au" complement, so "beurre d'arachide" or "lait au chocolat" never replace "beurre" or "lait"; the last word of an English name.
  - **Loyalty points** (information only, never used to pick stores): each basket ends with a 🎁 line. **Metro**: moi base points, 1 pt per $ (125 pts = 1 $). **Maxi**: PC Optimum bonus points printed on the chosen products (10 000 pts = 10 $). **Super C, IGA**: no base points, only personalized offers. **Giant Tiger** (GT VIP) and **Walmart**: no points. Rules checked on the official program pages, Sept. 2026.
  - **Saved baskets**: **Save basket** keeps a named copy of the list (same name = update). **Empty basket** clears the list. Saved baskets are listed with **Load** (replaces the list and re-plans) and × (delete). They're kept in this browser.
  - **Stored prices**: every product price found is stored on the server in `data/prices.db` (SQLite): each search's full result, the latest price per product, and one price per product per day as history. `GET /api/prices/stats` gives counts. **Price validity per store** (Settings, 1 h to 7 days, default 1 day): while a store's stored prices are younger than that, they're reused without searching the store. If a store can't be reached, its last stored prices are used and the plan says so (⚠ …). If the Panier server itself is down, the browser's saved copy is used. **Refresh prices** forces a new check.
  - Matching: the size in the item ("4L", "454g", "douzaine") sets the target amount and isn't sent to the stores' search. Without one, the typical package across stores is used. Each store's pick is its best value (unit price) among close matches. Its **cost is scaled to that same amount** so a single banana and a 3 lb bag compare fairly; the shelf price is shown when it differs. Tip: give produce an amount ("bananes 1kg").
- **Settings**: postal code, Maxi branch.

## Weekly full-catalogue crawl (at night)

`crawl.py` stores **every grocery product of every store** in `data/prices.db` (latest price + one history row per product per day).

```
python crawl.py              # crawl the stores that are due
python crawl.py --status     # flyer week per store, last crawl, what's due
python crawl.py --force maxi # crawl now;  --limit 3 = test (first pages only);  --dry-run
```

- **When**: the Windows task **Panier Crawl** (`scripts/install_crawl_task.ps1` → `scripts/crawl.cmd`) runs nightly at **02:30**, with a retry pass at **06:00**. A store is crawled only when its **new rebate week has started** since its last crawl, or when its last crawl is 7+ days old. The start day is read from Flipp at each run: Giant Tiger on **Wednesday**, IGA/Metro/Super C/Maxi/Walmart/Voilà on **Thursday**, so each store is crawled the first night of its new week. The task runs late if the PC was off, and wakes it from sleep (remove `-WakeToRun` in the script and re-run it to turn that off).
- **How** (per store, one request at a time with a 1.5–3 s pause, stores in parallel): **Maxi**: PC Express v2 listings by grocery department. **Metro / Super C**: food aisle pages (`-page-N`). **IGA**: departments, 100 per page. **Giant Tiger**: Québec grocery listings by category (large categories split by brand). **Walmart**: grocery category tree, best effort. **Voilà**: its **Flipp flyer only**, because voila.ca serves an AWS WAF bot challenge to automated clients.
- **Resume, never restart (within a week)**: every finished department/aisle/category and every saved page is checkpointed (`crawl_progress` table) under the store's current flyer week. A crawl stopped by a rate limit, a bot check or the PC turning off continues at the next page on its next run; Walmart's category tree is remembered too. A new flyer week starts from the beginning. **Retry now**: `scripts
etry.cmd` (= `python crawl.py --retry`) continues only the stores whose week is incomplete. The task also runs a **06:00 retry pass** each night. A store is skipped while a crawl of it, or of a store on the same platform (Metro/Super C), is already running.
- **Pace** (tested 2026-10-03): Metro and Super C one after the other at 15 s/page (their platform answers HTTP 429 at 2–9 s); on a 429 the crawler pauses 90 s, 180 s… and slows down instead of stopping. Walmart 12 s/page.
- **Politeness**: category/aisle pages only (Walmart's and Super C's robots.txt forbid crawling search pages). A store's crawl **stops at the first bot check** (never worked around), and there's a 3 000-request cap per store.
- Logs: `data/crawl.log`, `data/crawl-task.log`. Runs are recorded in the `crawl_runs` table (`GET /api/crawl/status`) and shown in **Settings → Full catalogue**.
- Config (optional): `data/crawl.json` → `{"postal": "H2Y1C6", "maxi_store": "7573"}`.

## How each store is read

| Store | Source | Module |
|---|---|---|
| IGA | `commerce.iga.net/{lang}/search?k=`: server-rendered, `data-product` JSON on each tile (2 pages = 24 items) | `sources/iga.py` |
| Metro | `metro.ca` search page, product tiles (`data-main-price`, unit price text) | `sources/metro.py` |
| Super C | `superc.ca/recherche?filter=` (`/en/search`): same platform and tiles as Metro | `sources/metro.py` |
| Maxi | PC Express API `api.pcexpress.ca/pcx-bff/api/v1/products/search` (same backend as their sites; public web key). Per-branch prices. | `sources/pc.py` |
| Walmart | `walmart.ca/{lang}/search?catId=10019` (grocery), results in `__NEXT_DATA__` | `sources/walmart.py` |
| Giant Tiger | Algolia index `shopify_products` (public search key from their page), filtered to grocery + Québec listings; plus Shopify `/fr/search/suggest.json` for French words | `sources/gianttiger.py` |
| Flyers | Flipp `backflipp.wishabi.com/flipp/items/search` | `sources/flipp.py` |

All requests go through `curl_cffi` with a Chrome fingerprint (`sources/base.py`) and are cached in memory for 15 min.

`units.py` parses sizes ("4 x 100 g", "1,36 kg", "Sac de 2 lb", "douzaine") and store unit-price text ("34¢/100ml", "0,99 $/100 g") into one scale (per 100 g / 100 mL / unit). The UI shows these per kg / L. Unit prices that imply an impossible package size are dropped, because stores sometimes publish bad ones.

## Caveats

- These are unofficial endpoints. If a store redesigns its site, its module needs updating. The other stores keep working, and the failing one shows an error on its card.
- **Loblaws is disabled** (no Québec stores). To re-enable, uncomment it in `sources/__init__.py` and in `STORES` in `static/js/app.js`; `sources/pc.py` still supports it.
- **Maxi** defaults to Montréal Sherbrooke Est; change it in Settings.
- IGA, Metro, Super C, Walmart and Giant Tiger return each chain's default online price. In-store prices can differ slightly by branch.
- Walmart occasionally serves a bot check. That card then shows an error; try again a minute later.
- "Close matches" is word-based: "beurre" also matches "beurre d'arachide".
- The camera needs a secure context: `localhost` works, but a phone on `http://<lan-ip>:5055` won't get camera access. Typing the barcode still works there.
