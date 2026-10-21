"use strict";

// ---------- config ----------
const STORES = {
  iga:        { name: "IGA",        color: "var(--s-iga)" },
  metro:      { name: "Metro",      color: "var(--s-metro)" },
  superc:     { name: "Super C",    color: "var(--s-superc)" },
  maxi:       { name: "Maxi",       color: "var(--s-maxi)" },
  // loblaws: { name: "Loblaws", color: "var(--s-loblaws)" },  // disabled, see sources/__init__.py
  gianttiger: { name: "Giant Tiger", fr: "Tigre Géant", color: "var(--s-gianttiger)" },
  walmart:    { name: "Walmart",    color: "var(--s-walmart)" },
};
const ORDER = Object.keys(STORES);
// shared categories (server: categories.py); "autres" = the store gave no usable category
const CAT_ORDER = ["fruits", "laitiers", "viandes", "poissons", "charcuterie", "boulangerie", "garde_manger",
                   "collations", "boissons", "surgeles", "bebe", "sante", "maison", "animaux", "autres"];
// chains shown in flyers (and crawled weekly) but not searchable live
const FLYER_ONLY = { voila: { name: "Voilà", color: "var(--s-voila)" } };
const APPROX_PER_STORE = 5;   // when a store has no close match, show its own top N

const T = {
  fr: {
    tabCompare: "Comparer", tabFlyers: "Circulaires", tabList: "Liste", settings: "Réglages", scan: "Scanner",
    searchPh: "Lait 2%, beurre, bananes…", search: "Chercher",
    heroTitle: "Trouvez le meilleur prix, épicerie par épicerie.",
    heroText: "Cherchez un produit ou scannez son code-barres : on compare IGA, Metro, Super C, Maxi, Tigre Géant et Walmart, classés par prix unitaire.",
    sortBy: "Trier", sortUnit: "Prix unitaire", sortPrice: "Prix", sortStore: "Épicerie",
    category: "Catégorie", allCats: n => `Toutes (${n})`, allCatsLabel: "Toutes les catégories",
    brand: "Marque", allBrands: n => `Toutes (${n})`, noBrand: "Sans marque", clearBrands: "Effacer",
    moreBrands: n => `Voir toutes les marques (${n})`, fewerBrands: "Moins de marques",
    cats: { fruits: "Fruits et légumes", laitiers: "Produits laitiers et œufs", viandes: "Viandes et volailles",
            poissons: "Poissons et fruits de mer", charcuterie: "Charcuterie et prêt-à-manger", boulangerie: "Boulangerie",
            garde_manger: "Garde-manger", collations: "Collations et bonbons", boissons: "Boissons", surgeles: "Surgelés",
            bebe: "Bébé", sante: "Santé et beauté", maison: "Maison et entretien", animaux: "Animaux", autres: "Non classé" },
    closeOnly: "Correspondances proches", saleOnly: "En solde seulement",
    glutenFree: "Sans gluten", lactoseFree: "Sans lactose",
    flyersNear: "Circulaires près de", myStoresOnly: "Mes épiceries seulement",
    flyersHint: "Cherchez un produit pour voir les aubaines de la semaine.",
    flyerN: n => `${n} circulaire${n > 1 ? "s" : ""}`, upcoming: "À venir", page: "Page",
    flyerFilterPh: "Filtrer cette circulaire…", sortPage: "Ordre de la circulaire", sortDiscount: "Rabais %",
    dealsFor: q => `Aubaines pour « ${q} »`,
    listEmpty: "Votre liste est vide. Ajoutez ce qu'il vous faut (ex. « lait 2% 4L », « oeufs », « beurre »).",
    needPh: "Ajouter un article… (ex. lait 2% 4L)", add: "Ajouter", addQuery: q => `＋ Ajouter « ${q} » à ma liste`,
    threshold: "Économie minimale pour ajouter une épicerie", maxStores: "Épiceries max.", plan: "Trouver où faire l'épicerie",
    replan: "Recalculer", planning: (a, b) => `Recherche des prix… ${a}/${b}`,
    storesN: n => `${n} épicerie${n > 1 ? "s" : ""}`, recommended: "Recommandé", missingN: n => `${n} article${n > 1 ? "s" : ""} introuvable${n > 1 ? "s" : ""}`,
    saves: v => `économise ${v}`, vsOne: "vs 1 épicerie",
    whyStay: (k, v, th) => `Aller à ${k} épiceries n'économiserait que ${v} (seuil : ${th}) — pas la peine.`,
    whyGo: (k, v, th) => `${k} épiceries économisent ${v} (≥ seuil de ${th}).`,
    whyCover: "Une seule épicerie n'a pas tout — il en faut plus pour couvrir la liste.",
    whereTo: "Où acheter quoi", notFound: "Introuvable partout", byItem: "Prix par article",
    stale: "La liste a changé —", need: "Article", choose: "Choisir un autre produit",
    pricesAt: d => `Prix vérifiés le ${d}`, pricesOld: "plus vieux que la validité choisie", refresh: "Actualiser les prix",
    searchStale: (n, d) => `${n} recherche${n > 1 ? "s" : ""} impossible${n > 1 ? "s" : ""} — derniers prix enregistrés utilisés (${d})`,
    searchFailed: n => `${n} recherche${n > 1 ? "s" : ""} impossible${n > 1 ? "s" : ""} et aucun prix enregistré — réessayez avec « Actualiser les prix »`,
    allDown: d => `Impossible de joindre les épiceries (serveur Panier arrêté ?) — derniers prix enregistrés utilisés (${d}).`,
    allDownNoData: "Impossible de joindre les épiceries (serveur Panier arrêté ?) et aucun prix enregistré.",
    staleShort: d => `magasin injoignable — prix du ${d}`, days: n => `${n} jour${n > 1 ? "s" : ""}`,
    expiryTitle: "Validité des prix par épicerie",
    crawlTitle: "Catalogue complet (analyse de nuit)", crawlNever: "jamais", crawlProducts: "produits",
    crawlNote: n => `Chaque nuit à 2 h 30, les épiceries dont la nouvelle semaine de rabais a commencé sont analysées au complet (Tigre Géant le mercredi, les autres le jeudi). ${n} prix enregistrés. Voilà : circulaire seulement (le site bloque les robots).`,
    expiryNote: "Tant que les prix d'une épicerie ont moins que cette durée, ils sont réutilisés sans la rechercher à nouveau. Tous les prix trouvés sont enregistrés.",
    allowSubs: "Substitut si aubaine", anyBrand: "n'importe quel produit", anyProduct: q => `« ${q} » — n'importe quel produit`,
    noSug: "Aucun produit trouvé — Entrée pour l'ajouter tel quel", from: v => `dès ${v}`,
    subFound: "♻ Substitut choisi", insteadOf: n => `au lieu de ${n}`, subOnly: "produit visé introuvable ici",
    ptsEarn: (n, pts, v, bonus) => `${n} : ≈ ${pts} points (${v})${bonus}`,
    ptsBonus: b => ` — dont ${b} points bonus sur ces produits`,
    ptsOffersOnly: n => `${n} : 0 point de base (points seulement via vos offres personnalisées)`,
    ptsNone: n => `${n} : pas de points (offres membres seulement)`,
    ptsWalmart: () => "Walmart : pas de programme de points (sauf carte Mastercard Walmart Rewards, 3 %)",
    ptsHint: "À titre indicatif : les points ne sont pas pris en compte dans le choix des épiceries.",
    elsewhere: "Ailleurs", unsized: "format inconnu", subsOnLabel: "♻ substituts utilisés",
    unsizedHint: "Le magasin n'indique pas le format : ce prix n'est pas ramené à la même quantité.",
    offer: "♻ En solde", use: "Utiliser", undo: "Annuler", notHere: "votre produit n'est pas vendu ici",
    offersSum: (n, v) => `♻ ${n} substitut${n > 1 ? "s" : ""} en solde proposé${n > 1 ? "s" : ""} dans ce plan${v ? ` — jusqu'à ${v} d'économie` : ""}. Rien n'est changé tant que vous ne cliquez pas « Utiliser ».`,
    targetHint: "Choisissez un produit pour viser la bonne marque et le bon format.", shelf: v => `en rayon : ${v}`,
    planHint: "Chaque prix est ramené à la même quantité dans toutes les épiceries (le format demandé, sinon le format typique), pour comparer à égalité. Touchez un prix pour voir le produit.",
    postal: "Code postal (circulaires)", maxiStore: "Succursale Maxi",
    settingsNote: "Les prix d'IGA, Metro, Super C, Walmart et Tigre Géant sont les prix en ligne par défaut de chaque chaîne; ils peuvent varier légèrement en magasin.",
    save: "Enregistrer", scanTitle: "Scanner un code-barres", scanManualPh: "…ou tapez le code (ex. 068200010120)", go: "OK",
    quick: ["Lait 2% 4L", "Beurre", "Oeufs", "Bananes", "Pain tranché", "Poitrine de poulet", "Café moulu", "Spaghetti"],
    results: n => `${n} produit${n > 1 ? "s" : ""}`, loading: "Recherche…", none: "Aucun résultat",
    noMatch: "Aucune correspondance proche", best: "Meilleur", bestPrice: "Meilleur prix unitaire",
    pdTitle: "Prix chez les autres magasins", pdAdd: "Ajouter à ma liste", pdRemove: "Retirer de ma liste",
    pdOpen: "Voir sur le site du magasin", pdNone: "Introuvable dans ce magasin", pdFail: "Magasin indisponible",
    pdSaved: d => `prix enregistrés le ${d}`, pdClose: "Fermer", pdHere: "Ce produit", pdSeen: d => `relevé du ${d}`,
    sale: "Solde", outOfStock: "Rupture", approx: "≈ approx.", per: { g: "/kg", ml: "/L", ea: "/unité" },
    perW: { kg: "/kg", lb: "/lb", g: "/g", "100g": "/100 g" },
    hidden: n => `${n} résultat${n > 1 ? "s" : ""} moins pertinent${n > 1 ? "s" : ""} masqué${n > 1 ? "s" : ""} — décochez « Correspondances proches » pour tout voir.`,
    added: "Ajouté à la liste", removed: "Retiré de la liste", until: d => `jusqu'au ${d}`,
    flyerNone: "Aucune aubaine trouvée dans les circulaires.",
    flyerOthers: n => `${n} aubaine${n > 1 ? "s" : ""} dans d'autres épiceries — décochez « Mes épiceries seulement ».`, flyerErr: "Circulaires indisponibles",
    clear: "Vider la liste", copy: "Copier", copied: "Liste copiée", total: "Total",
    confirmClear: "Vider toute la liste ?",
    saveBasket: "💾 Enregistrer le panier", emptyBasket: "🗑 Vider le panier", saveBasketTitle: "Enregistrer le panier",
    basketName: "Nom du panier", basketNote: "Un panier du même nom sera mis à jour.", cancel: "Annuler",
    basketDefault: d => `Panier du ${d}`, basketSaved: n => `Panier « ${n} » enregistré`,
    basketLoaded: n => `Panier « ${n} » chargé`, savedBaskets: "Paniers enregistrés", load: "Charger",
    itemsN: n => `${n} article${n > 1 ? "s" : ""}`, confirmEmpty: "Vider le panier ? (les paniers enregistrés sont conservés)",
    replaceList: n => `Remplacer la liste actuelle par « ${n} » ?`, confirmDelBasket: n => `Supprimer le panier « ${n} » ?`, weighed: "prix au poids — total approximatif",
    scanStarting: "Ouverture de la caméra…", scanAim: "Visez le code-barres.", scanLooking: "Recherche du produit…",
    scanNoCam: "Caméra indisponible ici (il faut https ou localhost). Tapez le code ci-dessous.",
    scanUnknown: "Produit inconnu — recherche par code", scanFound: p => `Trouvé : ${p}`,
    error: "Erreur", retry: "Réessayer", invalidPostal: "Code postal invalide",
  },
  en: {
    tabCompare: "Compare", tabFlyers: "Flyers", tabList: "List", settings: "Settings", scan: "Scan",
    searchPh: "2% milk, butter, bananas…", search: "Search",
    heroTitle: "Find the best price, store by store.",
    heroText: "Search a product or scan its barcode: we compare IGA, Metro, Super C, Maxi, Giant Tiger and Walmart, ranked by unit price.",
    sortBy: "Sort", sortUnit: "Unit price", sortPrice: "Price", sortStore: "Store",
    category: "Category", allCats: n => `All (${n})`, allCatsLabel: "All categories",
    brand: "Brand", allBrands: n => `All (${n})`, noBrand: "No brand", clearBrands: "Clear",
    moreBrands: n => `Show all brands (${n})`, fewerBrands: "Fewer brands",
    cats: { fruits: "Fruits & vegetables", laitiers: "Dairy & eggs", viandes: "Meat & poultry", poissons: "Fish & seafood",
            charcuterie: "Deli & ready meals", boulangerie: "Bakery", garde_manger: "Pantry", collations: "Snacks & candy",
            boissons: "Drinks", surgeles: "Frozen", bebe: "Baby", sante: "Health & beauty", maison: "Household",
            animaux: "Pets", autres: "Uncategorized" },
    closeOnly: "Close matches only", saleOnly: "On sale only",
    glutenFree: "Gluten-free", lactoseFree: "Lactose-free",
    flyersNear: "Flyers near", myStoresOnly: "My stores only",
    flyersHint: "Search for a product to see this week's deals.",
    flyerN: n => `${n} flyer${n === 1 ? "" : "s"}`, upcoming: "Upcoming", page: "Page",
    flyerFilterPh: "Filter this flyer…", sortPage: "Flyer order", sortDiscount: "% off",
    dealsFor: q => `Deals for “${q}”`,
    listEmpty: "Your list is empty. Add what you need (e.g. “2% milk 4L”, “eggs”, “butter”).",
    needPh: "Add an item… (e.g. 2% milk 4L)", add: "Add", addQuery: q => `＋ Add “${q}” to my list`,
    threshold: "Minimum savings to add a store", maxStores: "Max stores", plan: "Find where to shop",
    replan: "Recalculate", planning: (a, b) => `Checking prices… ${a}/${b}`,
    storesN: n => `${n} store${n === 1 ? "" : "s"}`, recommended: "Recommended", missingN: n => `${n} item${n === 1 ? "" : "s"} not found`,
    saves: v => `saves ${v}`, vsOne: "vs 1 store",
    whyStay: (k, v, th) => `Going to ${k} stores would only save ${v} (threshold: ${th}) — not worth it.`,
    whyGo: (k, v, th) => `${k} stores save ${v} (≥ your ${th} threshold).`,
    whyCover: "No single store has everything — more stores are needed to cover the list.",
    whereTo: "Where to buy what", notFound: "Not found anywhere", byItem: "Price per item",
    stale: "The list changed —", need: "Item", choose: "Choose another product",
    pricesAt: d => `Prices checked ${d}`, pricesOld: "older than the validity you set", refresh: "Refresh prices",
    searchStale: (n, d) => `${n} search${n === 1 ? "" : "es"} failed — last saved prices used (${d})`,
    searchFailed: n => `${n} search${n === 1 ? "" : "es"} failed and no saved prices — try “Refresh prices”`,
    allDown: d => `Couldn't reach the stores (Panier server stopped?) — last saved prices used (${d}).`,
    allDownNoData: "Couldn't reach the stores (Panier server stopped?) and no saved prices.",
    staleShort: d => `store unreachable — prices from ${d}`, days: n => `${n} day${n === 1 ? "" : "s"}`,
    expiryTitle: "Price validity per store",
    crawlTitle: "Full catalogue (night crawl)", crawlNever: "never", crawlProducts: "products",
    crawlNote: n => `Every night at 2:30, stores whose new rebate week has started are crawled in full (Giant Tiger on Wednesday, the others on Thursday). ${n} prices stored. Voilà: flyer only (the site blocks bots).`,
    expiryNote: "While a store's prices are younger than this, they're reused without searching it again. Every price found is saved.",
    allowSubs: "Substitute if on sale", anyBrand: "any product", anyProduct: q => `“${q}” — any product`,
    noSug: "No product found — press Enter to add it as typed", from: v => `from ${v}`,
    subFound: "♻ Substitute chosen", insteadOf: n => `instead of ${n}`, subOnly: "your product isn't sold here",
    ptsEarn: (n, pts, v, bonus) => `${n}: ≈ ${pts} points (${v})${bonus}`,
    ptsBonus: b => ` — incl. ${b} bonus points on these products`,
    ptsOffersOnly: n => `${n}: 0 base points (points only through your personalized offers)`,
    ptsNone: n => `${n}: no points (member offers only)`,
    ptsWalmart: () => "Walmart: no points program (except the Walmart Rewards Mastercard, 3%)",
    ptsHint: "For information only: points are not used to choose stores.",
    elsewhere: "Elsewhere", unsized: "size unknown", subsOnLabel: "♻ substitutes in use",
    unsizedHint: "The store doesn't give the package size: this price isn't scaled to the same amount.",
    offer: "♻ On sale", use: "Use", undo: "Undo", notHere: "your product isn't sold here",
    offersSum: (n, v) => `♻ ${n} sale substitute${n === 1 ? "" : "s"} proposed in this plan${v ? ` — up to ${v} in savings` : ""}. Nothing changes until you click “Use”.`,
    targetHint: "Pick a product to target the right brand and size.", shelf: v => `shelf: ${v}`,
    planHint: "Each price is scaled to the same amount at every store (the size you asked for, otherwise the typical package) so they compare fairly. Tap a price to see the product.",
    postal: "Postal code (flyers)", maxiStore: "Maxi store",
    settingsNote: "IGA, Metro, Super C, Walmart and Giant Tiger prices are each chain's default online prices; in-store prices may differ slightly.",
    save: "Save", scanTitle: "Scan a barcode", scanManualPh: "…or type the code (e.g. 068200010120)", go: "OK",
    quick: ["2% milk 4L", "Butter", "Eggs", "Bananas", "Sliced bread", "Chicken breast", "Ground coffee", "Spaghetti"],
    results: n => `${n} product${n === 1 ? "" : "s"}`, loading: "Searching…", none: "No results",
    noMatch: "No close match", best: "Best", bestPrice: "Best unit price",
    pdTitle: "Prices at other stores", pdAdd: "Add to my list", pdRemove: "Remove from my list",
    pdOpen: "View on the store's site", pdNone: "Not found at this store", pdFail: "Store unavailable",
    pdSaved: d => `prices saved on ${d}`, pdClose: "Close", pdHere: "This product", pdSeen: d => `as of ${d}`,
    sale: "Sale", outOfStock: "Out of stock", approx: "≈ approx.", per: { g: "/kg", ml: "/L", ea: "/ea" },
    perW: { kg: "/kg", lb: "/lb", g: "/g", "100g": "/100 g" },
    hidden: n => `${n} less relevant result${n === 1 ? "" : "s"} hidden — untick “Close matches only” to see everything.`,
    added: "Added to list", removed: "Removed from list", until: d => `until ${d}`,
    flyerNone: "No flyer deals found.",
    flyerOthers: n => `${n} deal${n === 1 ? "" : "s"} at other stores — untick “My stores only”.`, flyerErr: "Flyers unavailable",
    clear: "Clear list", copy: "Copy", copied: "List copied", total: "Total",
    confirmClear: "Clear the whole list?",
    saveBasket: "💾 Save basket", emptyBasket: "🗑 Empty basket", saveBasketTitle: "Save basket",
    basketName: "Basket name", basketNote: "A basket with the same name will be updated.", cancel: "Cancel",
    basketDefault: d => `Basket of ${d}`, basketSaved: n => `Basket “${n}” saved`,
    basketLoaded: n => `Basket “${n}” loaded`, savedBaskets: "Saved baskets", load: "Load",
    itemsN: n => `${n} item${n === 1 ? "" : "s"}`, confirmEmpty: "Empty the basket? (saved baskets are kept)",
    replaceList: n => `Replace the current list with “${n}”?`, confirmDelBasket: n => `Delete basket “${n}”?`, weighed: "priced by weight — approximate total",
    scanStarting: "Opening camera…", scanAim: "Point at the barcode.", scanLooking: "Looking up product…",
    scanNoCam: "Camera unavailable here (needs https or localhost). Type the code below.",
    scanUnknown: "Unknown product — searching by code", scanFound: p => `Found: ${p}`,
    error: "Error", retry: "Retry", invalidPostal: "Invalid postal code",
  },
};

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("panier." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("panier." + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ---------- state ----------
const S = {
  lang: store.get("lang", "fr"),   // French by default for everyone; the EN/FR button still saves a choice
  // persist the stores switched OFF, so stores added later start enabled
  enabled: new Set(ORDER.filter(k => !store.get("storesOff", []).includes(k))),
  settings: Object.assign({ postal: "H2Y 1C6", maxi: "", threshold: 10, maxStores: 3 }, store.get("settings", {})),
  // shopping list = things to buy ("lait 2% 4L" × 2); older saved lists held products, keep their names
  needs: store.get("needs", null) || store.get("list", []).map(l => ({ id: String(l.key || l.name), q: [l.brand, l.name].filter(Boolean).join(" "), qty: l.qty || 1 })),
  tab: "compare",
  query: "",
  results: {},          // store -> {status, items, error}
  flyers: null,         // {status, items, error, key}
  focus: null,          // store key filter from summary cards
  cat: new URL(location.href).searchParams.get("cat") || "",   // shared category filter
  brands: new Set((new URL(location.href).searchParams.get("brand") || "").split(",").filter(Boolean)),
  allBrands: true,      // left column: every brand shown (unfolded) by default; "Moins de marques" folds to the top ones
  gen: 0,
};

const $ = s => document.querySelector(s);
const t = k => T[S.lang][k];

// Store pictures come as small thumbnails (Maxi 250 px, IGA "medium", Walmart 180 px). Most stores also serve
// bigger versions under the same URL pattern: kind "thumb" = crisp for the list rows, "full" = lightbox.
// Stores without a pattern (Metro/Super C, Giant Tiger) are returned unchanged; callers fall back on error.
function bigImg(u, kind = "full") {
  if (!u) return u;
  const full = kind !== "thumb";
  if (u.startsWith("https://digital.loblaws.ca/"))               // sizes offered: 120 / 250 / 400 / 800 / 1200
    return u.replace(/_(120|250|400|800|1200)\.png$/, `_${full ? 800 : 400}.png`);
  if (u.includes("azureedge.net/media/image/product/"))          // IGA: small / medium / large
    return full ? u.replace(/\/(small|medium)\//, "/large/") : u.replace("/small/", "/medium/");
  if (u.includes("walmartimages.ca/")) {                          // Walmart resizes on the fly (originals are 1500-2000 px)
    const px = full ? 800 : 300;
    if (/[?&]odnWidth=/.test(u)) return u.replace(/odnHeight=\d+/, `odnHeight=${px}`).replace(/odnWidth=\d+/, `odnWidth=${px}`);
    return u + (u.includes("?") ? "&" : "?") + `odnHeight=${px}&odnWidth=${px}&odnBg=ffffff`;
  }
  if (u.startsWith("https://cdn.shopify.com/")) {                 // Giant Tiger (Shopify): originals are ~2000 px
    const px = full ? 1000 : 300;
    return /[?&]width=\d+/.test(u) ? u.replace(/width=\d+/, `width=${px}`) : u + (u.includes("?") ? "&" : "?") + `width=${px}`;
  }
  return u;
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const storeName = k => (S.lang === "fr" && STORES[k]?.fr) || STORES[k]?.name || FLYER_ONLY[k]?.name || k;
let _fmt, _fmtLang;
function money(v) {
  if (v == null) return "";
  if (_fmtLang !== S.lang) { _fmt = new Intl.NumberFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }); _fmtLang = S.lang; }
  return _fmt.format(v);
}
// unit.value is per 100 g / 100 mL / 1 ea; show per kg / L, which separates close prices better
const unitText = u => u ? `${money(u.dim === "ea" ? u.value : u.value * 10)} ${t("per")[u.dim]}` : "";

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("is-on"), 1800);
}

// ---------- i18n ----------
function applyLang() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { const v = t(el.dataset.i18n); if (typeof v === "string") el.textContent = v; });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => el.placeholder = t(el.dataset.i18nPh));
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $("#langBtn").textContent = S.lang === "fr" ? "EN" : "FR";
  $("#quickPicks").innerHTML = t("quick").map(q => `<button type="button">${esc(q)}</button>`).join("");
  $("#postalLink").textContent = S.settings.postal;
  renderChips();
}

// ---------- store chips ----------
function renderChips() {
  $("#storeChips").innerHTML = ORDER.map(k => `
    <button class="chip" type="button" data-store="${k}" aria-pressed="${S.enabled.has(k)}" style="--c:${STORES[k].color}">
      <span class="dot"></span>${esc(storeName(k))}
    </button>`).join("");
}
$("#storeChips").addEventListener("click", e => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const k = b.dataset.store;
  if (S.enabled.has(k)) { if (S.enabled.size > 1) S.enabled.delete(k); } else S.enabled.add(k);
  store.set("storesOff", ORDER.filter(s => !S.enabled.has(s)));
  if (PLAN.result) { PLAN.stale = true; renderPlan(); }
  renderChips();
  if (S.focus && !S.enabled.has(S.focus)) S.focus = null;
  if (S.query && S.enabled.has(k) && !S.results[k]) fetchStore(k, S.gen); // newly enabled
  renderCompare();
  renderFlyers();
});

// ---------- matching ----------
const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "et", "en", "a", "the", "of", "and", "with", "avec", "pour", "for",
  "m.g.", "m.g", "mg", "m.f.", "m.f", "mf"]);
function norm(s) {
  return String(s || "").toLowerCase().replace(/œ/g, "oe")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)\s+%/g, "$1%")
    .replace(/(\d)\s+(kg|g|ml|l|lb|lbs)\b/g, "$1$2");
}
// keep inner dots ("3.25%"), drop sentence dots ("Beurre salé." -> "sale")
const words = s => norm(s).split(/[^a-z0-9%.]+/).map(w => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);
function tokens(q) { return words(q).filter(w => !STOP.has(w)); }
const GLUTEN_FREE_RE = /\bsans gluten\b|\bgluten[- ]?free\b/;
const LACTOSE_FREE_RE = /\bsans lactose\b|\blactose[- ]?free\b/;
const itemText = it => norm(`${it.name} ${it.brand || ""} ${it.size || ""}`);
const isGlutenFree = it => GLUTEN_FREE_RE.test(itemText(it));
const isLactoseFree = it => LACTOSE_FREE_RE.test(itemText(it));
function isMatch(it, toks) {
  const hay = words(`${it.name} ${it.brand || ""} ${it.size || ""}`);
  const hits = toks.filter(tk => hay.some(w =>
    w === tk || w.startsWith(tk) ||
    (tk.length > 3 && /[sx]$/.test(tk) && w.startsWith(tk.slice(0, -1))) ||
    (w.length > 3 && tk.startsWith(w) && tk.length - w.length <= 2))).length;
  // short queries need every word; long ones (e.g. from a barcode scan) most of them
  return hits >= (toks.length <= 3 ? toks.length : Math.ceil(toks.length * 0.75));
}

// ---------- search ----------
function storeOpt(k) {
  if (k === "maxi" && S.settings.maxi) return S.settings.maxi;
  return "";
}

async function fetchStore(k, gen) {
  S.results[k] = { status: "loading", items: [] };
  const p = new URLSearchParams({ q: S.query, lang: S.lang, maxAge: String(expiryMs(k) / 1000) });
  const sid = storeOpt(k);
  if (sid) p.set("storeId", sid);
  try {
    const r = await fetch(`/api/search/${k}?${p}`);
    const d = await r.json();
    if (gen !== S.gen) return;
    S.results[k] = r.ok ? { status: "ok", items: d.items, stale: d.stale ? d.fetched_at * 1000 : null }
                        : { status: "error", items: [], error: d.error || r.status };
  } catch (e) {
    if (gen !== S.gen) return;
    S.results[k] = { status: "error", items: [], error: String(e.message || e) };
  }
  renderCompare();
}

function runSearch(q, { push = true } = {}) {
  q = (q || "").trim();
  if (!q) return;
  $("#q").value = q;
  if (S.query && norm(S.query) !== norm(q)) { S.brands.clear(); S.allBrands = true; }
  S.query = q;
  S.gen++;
  S.results = {};
  S.focus = null;
  S.flyers = null;
  if (push) {
    const u = new URL(location.href);
    u.searchParams.set("q", q);
    if (S.cat) u.searchParams.set("cat", S.cat); else u.searchParams.delete("cat");
    if (S.brands.size) u.searchParams.set("brand", [...S.brands].join(",")); else u.searchParams.delete("brand");
    history.pushState({ q }, "", u);
  }
  ORDER.filter(k => S.enabled.has(k)).forEach(k => fetchStore(k, S.gen));
  renderCompare();
  FL.sel = null;
  if (S.tab === "flyers") loadFlyers();
  document.activeElement?.blur?.();
}

$("#searchForm").addEventListener("submit", e => { e.preventDefault(); runSearch($("#q").value); });
$("#quickPicks").addEventListener("click", e => { const b = e.target.closest("button"); if (b) runSearch(b.textContent); });
window.addEventListener("popstate", () => {
  S.cat = new URL(location.href).searchParams.get("cat") || "";
  const q = new URL(location.href).searchParams.get("q");
  if (q) runSearch(q, { push: false });
});

// ---------- compare view ----------
function visibleItems() {
  const toks = tokens(S.query);
  const matchOnly = $("#matchOnly").checked;
  const saleOnly = $("#saleOnly").checked;
  const glutenFree = $("#glutenFree").checked;
  const lactoseFree = $("#lactoseFree").checked;
  let all = [], hidden = 0;
  for (const k of ORDER) {
    const r = S.results[k];
    if (!S.enabled.has(k) || !r || r.status !== "ok") continue;
    let items = r.items.map((it, i) => ({ ...it, rank: i }));
    if (matchOnly && toks.length) {
      const m = items.filter(it => isMatch(it, toks));
      if (m.length) { hidden += items.length - m.length; items = m; }
      else { hidden += Math.max(0, items.length - APPROX_PER_STORE); items = items.slice(0, APPROX_PER_STORE).map(it => ({ ...it, approx: true })); }
    }
    if (saleOnly) items = items.filter(it => it.sale || it.promo);
    if (glutenFree) items = items.filter(isGlutenFree);
    if (lactoseFree) items = items.filter(isLactoseFree);
    all.push(...items);
  }
  // counts per category before filtering by it, so the menu always shows every choice
  const catCounts = {};
  for (const it of all) catCounts[it.group || "autres"] = (catCounts[it.group || "autres"] || 0) + 1;
  const total = all.length;
  if (S.cat) all = all.filter(it => (it.group || "autres") === S.cat);
  const { counts: brandCounts, labels: brandLabels, keyOf } = brandIndex(all);
  const inCat = all.length;
  if (S.brands.size) all = all.filter(it => S.brands.has(keyOf(it)));
  return { all, hidden, catCounts, total, brandCounts, brandLabels, inCat };
}

function dominantDim(items) {
  const c = {};
  items.forEach(it => { if (it.unit) c[it.unit.dim] = (c[it.unit.dim] || 0) + 1; });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
}

function sortItems(items, dim) {
  const mode = $("#sortSel").value;
  const u = it => (it.unit && it.unit.dim === dim ? it.unit.value : Infinity);
  const byUnit = (a, b) => (!!a.approx - !!b.approx) || (u(a) - u(b)) || (a.price - b.price);
  if (mode === "price") return items.sort((a, b) => (!!a.approx - !!b.approx) || (a.price - b.price));
  if (mode === "store") return items.sort((a, b) => ORDER.indexOf(a.store) - ORDER.indexOf(b.store) || byUnit(a, b));
  return items.sort(byUnit);
}

function renderCompare() {
  const has = !!S.query;
  $("#compareEmpty").hidden = has;
  $("#compareResults").hidden = !has;
  if (!has) return;

  const { all, hidden, catCounts, total, brandCounts, brandLabels, inCat } = visibleItems();
  renderCatMenu(catCounts, total);
  renderBrandMenu(brandCounts, brandLabels, inCat);
  const dim = dominantDim(all);
  const sorted = sortItems(all, dim);
  const bestAll = sorted.find(it => !it.approx && it.unit && it.unit.dim === dim);

  // per-store summary cards
  const bestBy = {};
  for (const it of sorted) {
    if (it.approx || !it.unit || it.unit.dim !== dim) continue;
    if (!bestBy[it.store] || it.unit.value < bestBy[it.store].unit.value) bestBy[it.store] = it;
  }
  $("#storeCards").innerHTML = ORDER.filter(k => S.enabled.has(k)).map(k => {
    const r = S.results[k] || { status: "loading" };
    const b = bestBy[k];
    const n = all.filter(i => i.store === k).length;
    let body;
    if (r.status === "loading") body = `<div class="scard__meta"><span class="spinner"></span> ${t("loading")}</div>`;
    else if (r.status === "error") body = `<div class="scard__err">${t("error")} — ${esc(r.error)}</div>`;
    else if (!r.items.length) body = `<div class="scard__meta">${t("none")}</div>`;
    else if (!b) body = `<div class="scard__meta">${t("results")(n)}</div><div class="scard__meta">${n ? "" : t("noMatch")}</div>`;
    else body = `
      ${r.stale ? `<div class="scard__err">⚠ ${esc(t("staleShort")(new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" }).format(new Date(r.stale))))}</div>` : ""}
      <div class="scard__price">${esc(unitText(b.unit))}</div>
      <div class="scard__item" title="${esc(b.name)}">${esc(b.name)}</div>
      <div class="scard__meta">${t("results")(n)}</div>`;
    const isBest = b && bestAll && b === bestAll;
    return `<button class="scard${isBest ? " is-best" : ""}${S.focus === k ? " is-focus" : ""}" type="button" data-store="${k}" style="--c:${STORES[k].color}">
      <div class="scard__name"><span>${esc(storeName(k))}</span>${isBest ? `<span class="best-tag">${t("best")}</span>` : ""}</div>
      ${body}</button>`;
  }).join("");

  const shown = S.focus ? sorted.filter(it => it.store === S.focus) : sorted;
  $("#resultCount").textContent = t("results")(shown.length);
  $("#results").innerHTML = shown.map(it => rowHtml(it, it === bestAll)).join("");
  $("#hiddenNote").hidden = !hidden;
  $("#hiddenNote").textContent = hidden ? t("hidden")(hidden) : "";
  const added = hasNeed(S.query);
  $("#addQueryBtn").textContent = added ? "✓ " + S.query : t("addQuery")(S.query);
  $("#addQueryBtn").classList.toggle("is-added", added);
}

// what a product becomes on the shopping list: "Lactantia Beurre salé" (brand once)
function needText(it) {
  const name = it.name || "";
  return it.brand && !norm(name).includes(norm(it.brand)) ? `${it.brand} ${name}` : name;
}
// a need is either free text ("beurre") or a targeted product; key identifies duplicates
const slimProduct = it => ({ name: it.name, brand: it.brand, size: it.size, image: it.image, unit: it.unit,
                              price: it.price, store: it.store, upc: it.upc || null });
const needKey = (q, target) => target ? "p:" + norm(`${needText(target)} ${target.size || ""}`) : norm(q);
const keyOf = n => needKey(n.q, n.target);
const needLabel = n => n.target ? needText(n.target) : n.q;
const hasNeed = q => S.needs.some(n => keyOf(n) === needKey(q));
const inList = it => S.needs.some(n => keyOf(n) === needKey("", slimProduct(it)));
const needForItem = it => S.needs.find(n => keyOf(n) === needKey("", slimProduct(it)));

function priceHtml(it) {
  const per = it.price_per ? ` <small>${t("perW")[it.price_per] || "/" + esc(it.price_per)}</small>` : "";
  return `<div class="price${it.sale ? " is-sale" : ""}">${money(it.price)}${per}</div>
    ${it.regular ? `<div class="was">${money(it.regular)}</div>` : ""}`;
}

function rowHtml(it, best) {
  const c = STORES[it.store].color;
  const sub = [it.brand, it.size].filter(Boolean).join(" · ");
  const pct = it.sale && it.regular ? Math.round((1 - it.price / it.regular) * 100) : 0;
  const tags = [
    `<span class="badge badge--${it.store}" style="--c:${c}">${esc(storeName(it.store))}</span>`,
    best ? `<span class="badge badge--best">${t("bestPrice")}</span>` : "",
    it.sale ? `<span class="badge badge--sale">${t("sale")}${pct > 0 ? ` −${pct}%` : ""}</span>` : "",
    it.promo ? `<span class="badge badge--sale">${esc(it.promo)}</span>` : "",
    it.stock === false ? `<span class="badge badge--muted">${t("outOfStock")}</span>` : "",
    it.approx ? `<span class="badge badge--muted">${t("approx")}</span>` : "",
  ].join("");
  const need = needForItem(it);
  return `<li class="row${best ? " is-best" : ""}" data-key="${esc(it.store + ":" + it.id)}">
    ${it.image ? `<img class="row__img" src="${esc(bigImg(it.image, "thumb"))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fb!=='1'){this.dataset.fb='1';this.src='${esc(it.image)}'}else{this.style.visibility='hidden'}">` : `<div class="row__img"></div>`}
    <div class="row__main">
      <div class="row__name">${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)}</a>` : esc(it.name)}</div>
      ${sub ? `<div class="row__sub">${esc(sub)}</div>` : ""}
      <div class="row__tags">${tags}</div>
    </div>
    <div class="row__right">
      ${priceHtml(it)}
      ${it.unit ? `<div class="unit">${esc(unitText(it.unit))}</div>` : ""}
      ${need
        ? `<span class="qty qty--sm"><button data-act="dec" type="button" aria-label="-">−</button><span>${need.qty}</span><button data-act="inc" type="button" aria-label="+">+</button></span>`
        : `<button class="add-btn" type="button" aria-label="+">+</button>`}
    </div>
  </li>`;
}

// ---------- product popup: this product at every store ----------
// Click a row -> a dialog (same tab) with the product and what each other store charges for the same thing.
// Every other store is searched for the product (cached like the planner's searches) and its best
// candidate is matched with sameProductScore (barcode first, then names, closest package size).
const PD = { gen: 0, it: null, paint: null };

function pdMatch(it, items) {
  const idf = buildIdf([it, ...items]);
  const tq = itemQty(it);
  const dist = c => { const q = itemQty(c); return q && tq ? Math.abs(Math.log(q / tq)) : 1; };
  let best = null, bestR = -Infinity;
  for (const c of items) {
    const s = sameProductScore(it, c, idf);
    if (s < SAME_MIN) continue;
    const r = s - 0.4 * Math.min(dist(c), 2) - (c.stock === false ? 1 : 0);
    if (r > bestR) { best = c; bestR = r; }
  }
  return best;
}

// cheapest store: by unit price when every store has one in the same dimension, else by shelf price
function pdBest(rows) {
  const ok = Object.entries(rows).filter(([, r]) => r.item && r.item.stock !== false);
  if (ok.length < 2) return null;
  const dim = ok[0][1].item.unit?.dim;
  const byUnit = ok.every(([, r]) => r.item.unit && r.item.unit.dim === dim);
  const val = r => byUnit ? r.item.unit.value : r.item.price;
  return ok.reduce((a, b) => val(b[1]) < val(a[1]) ? b : a)[0];
}

function pdHtml(it, stores, rows) {
  const best = pdBest(rows);
  const sub = [it.brand, it.size].filter(Boolean).join(" · ");
  const list = stores.map(k => {
    const r = rows[k], x = r.item;
    let mid, right = "";
    if (x) {
      const xs = [x.brand, x.size].filter(Boolean).join(" · ");
      mid = `<div class="pd__name">${esc(x.name)}</div>${xs ? `<div class="pd__sub">${esc(xs)}</div>` : ""}` +
            (r.self ? `<div class="pd__sub">${t("pdHere")}</div>` : "") +
            (x.updated_at ? `<div class="pd__date">${t("pdSeen")(dateFmt().format(new Date(x.updated_at * 1000)))}</div>` : "") +
            (x.stock === false ? `<div class="pd__stale">${t("outOfStock")}</div>` : "");
      right = `${priceHtml(x)}${x.unit ? `<div class="unit">${esc(unitText(x.unit))}</div>` : ""}` +
              (k === best ? `<span class="badge badge--best">${t("bestPrice")}</span>` : "");
    } else {
      mid = `<span class="pd__muted">${r.state === "loading" ? t("loading") : r.state === "error" ? t("pdFail") : t("pdNone")}</span>`;
    }
    const link = x?.url ? `<a class="pd__link" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(t("pdOpen"))}" aria-label="${esc(t("pdOpen"))}">↗</a>` : "";
    return `<li class="pd__row${k === best ? " is-best" : ""}${r.self ? " is-self" : ""}">
      <span class="badge badge--${k}" style="--c:${STORES[k].color}">${esc(storeName(k))}</span>
      <div class="pd__mid">${mid}</div>
      <div class="pd__right">${right}</div>
      ${link}
    </li>`;
  }).join("");
  return `<div class="pd__top">
      ${it.image ? `<img class="pd__img" src="${esc(bigImg(it.image))}" alt="" referrerpolicy="no-referrer" onerror="if(this.dataset.fb!=='1'){this.dataset.fb='1';this.src='${esc(it.image)}'}else{this.style.display='none'}">` : ""}
      <div class="pd__info">
        <h2 class="pd__title">${esc(it.name)}</h2>
        ${sub ? `<div class="pd__sub">${esc(sub)}</div>` : ""}
        <div class="pd__actions">
          <button class="btn btn--primary" type="button" data-act="pd-add">${inList(it) ? t("pdRemove") : t("pdAdd")}</button>
          ${it.url ? `<a class="btn btn--ghost" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(t("pdOpen"))} ↗</a>` : ""}
        </div>
      </div>
    </div>
    <h3 class="pd__h">${t("pdTitle")}</h3>
    <ul class="pd__list">${list}</ul>`;
}

async function openProduct(it) {
  const gen = ++PD.gen;
  const stores = ORDER.filter(k => S.enabled.has(k) || k === it.store);
  const rows = {};
  for (const k of stores) rows[k] = k === it.store ? { state: "ok", item: it, self: true } : { state: "loading" };
  PD.it = it;
  PD.paint = () => { if (gen === PD.gen) $("#productBody").innerHTML = pdHtml(it, stores, rows); };
  PD.paint();
  const dlg = $("#productDlg");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  // The server answers from its database (weekly crawl): products with the same barcode first, then the best
  // text matches. No request goes to the stores, so this is instant and works for stores that block the server.
  const q = targetQuery(it) || it.name, gtin = gtinOf(it);
  await Promise.all(stores.filter(k => k !== it.store).map(async k => {
    let items = [], failed = false;
    try {
      const p = new URLSearchParams({ q, lang: S.lang });
      if (gtin) p.set("gtin", gtin);
      const r = await fetch(`/api/match/${k}?${p}`);
      if (!r.ok) throw new Error(r.status);
      items = (await r.json()).items || [];
    } catch { failed = true; }
    // candidates: the database's matches + whatever the current results already hold
    const c = pdMatch(it, [...items, ...(S.results[k]?.items || [])]);
    rows[k] = c ? { state: "ok", item: c } : { state: failed ? "error" : "none" };
    PD.paint();
  }));
}
$("#productClose").addEventListener("click", () => $("#productDlg").close());
$("#productDlg").addEventListener("click", e => {
  if (e.target === $("#productDlg")) { $("#productDlg").close(); return; }   // the backdrop
  if (e.target.closest('[data-act="pd-add"]') && PD.it) { toggleProduct(PD.it); renderCompare(); PD.paint?.(); }
});

// Brands: same brand spelled differently ("QUÉBON" / "Québon") counts once; a product without a
// brand (often Walmart) gets one when its name starts with a brand other products carry.
const brandKey = b => norm(b).replace(/[^a-z0-9]+/g, " ").trim();
function brandIndex(items) {
  const labels = {}, votes = {};
  for (const it of items) {
    if (!it.brand) continue;
    const k = brandKey(it.brand);
    if (!k) continue;
    (votes[k] ||= {})[it.brand] = (votes[k][it.brand] || 0) + 1;
  }
  for (const [k, v] of Object.entries(votes))   // most common spelling, preferring Title Case over CAPS
    labels[k] = Object.entries(v).sort((a, b) => b[1] - a[1] || (a[0] === a[0].toUpperCase()) - (b[0] === b[0].toUpperCase()))[0][0];
  const known = Object.keys(labels).sort((a, b) => b.length - a.length);
  // product lines fold into their brand: "Lactantia PurFiltre" -> "Lactantia"
  const parent = {};
  for (const k of known) {
    const p = known.filter(b => b.length >= 4 && k.startsWith(b + " ")).sort((a, b) => a.length - b.length)[0];
    if (p) parent[k] = p;
  }
  const keyOf = it => {
    if (it._bk !== undefined) return it._bk;
    let k = it.brand ? brandKey(it.brand) : "";
    if (!k) { const n = brandKey(it.name || ""); k = known.find(b => n === b || n.startsWith(b + " ")) || ""; }
    return (it._bk = parent[k] || k);
  };
  const counts = {};
  for (const it of items) { const k = keyOf(it); counts[k] = (counts[k] || 0) + 1; }
  return { counts, labels, keyOf };
}
const BRANDS_SHOWN = 10;
function renderBrandMenu(counts, labels, total) {
  const label = k => k ? (labels[k] || k) : t("noBrand");
  // most products first; selected brands always listed even when they have none here
  const keys = Object.keys(counts).sort((a, b) => (counts[b] - counts[a]) || label(a).localeCompare(label(b)));
  for (const k of S.brands) if (!keys.includes(k)) keys.push(k);
  const named = keys.filter(k => k);                 // "Sans marque" last
  if (keys.includes("")) named.push("");
  const shown = S.allBrands ? named : named.filter((k, i) => i < BRANDS_SHOWN || S.brands.has(k));
  $("#brandSide").innerHTML = shown.map(k => `<li><label class="brandside__item${S.brands.has(k) ? " is-active" : ""}">
      <input type="checkbox" data-brand="${esc(k)}"${S.brands.has(k) ? " checked" : ""}>
      <span class="brandside__name">${esc(label(k))}</span><span class="catside__n">${counts[k] || 0}</span></label></li>`).join("")
    || `<li class="brandside__none">—</li>`;
  const more = named.length - shown.length;
  $("#brandMore").hidden = !(more > 0 || S.allBrands) || named.length <= BRANDS_SHOWN;
  $("#brandMore").textContent = S.allBrands ? t("fewerBrands") : t("moreBrands")(named.length);
  $("#brandClear").hidden = !S.brands.size;
  // phones: one brand at a time in a dropdown
  const sel = $("#brandSel");
  sel.innerHTML = `<option value="">${esc(t("allBrands")(total))}</option>` +
    named.map(k => `<option value="${esc(k)}">${esc(label(k))} (${counts[k] || 0})</option>`).join("");
  sel.value = S.brands.size === 1 ? [...S.brands][0] : "";
  sel.classList.toggle("is-on", S.brands.size > 0);
}
function setBrandUrl() {
  const u = new URL(location.href);
  if (S.brands.size) u.searchParams.set("brand", [...S.brands].join(",")); else u.searchParams.delete("brand");
  history.replaceState(history.state, "", u);
}
$("#brandSide").addEventListener("change", e => {
  const cb = e.target.closest("input[data-brand]");
  if (!cb) return;
  if (cb.checked) S.brands.add(cb.dataset.brand); else S.brands.delete(cb.dataset.brand);
  setBrandUrl();
  renderCompare();
});
$("#brandMore").addEventListener("click", () => { S.allBrands = !S.allBrands; renderCompare(); });
$("#brandClear").addEventListener("click", () => { S.brands.clear(); setBrandUrl(); renderCompare(); });
$("#brandSel").addEventListener("change", () => {
  S.brands = new Set($("#brandSel").value ? [$("#brandSel").value] : []);
  setBrandUrl();
  renderCompare();
});

function renderCatMenu(counts, total) {
  const sel = $("#catSel");
  const keys = CAT_ORDER.filter(k => counts[k] || k === S.cat);
  sel.innerHTML = `<option value="">${esc(t("allCats")(total))}</option>` +
    keys.map(k => `<option value="${k}"${k === S.cat ? " selected" : ""}>${esc(t("cats")[k])} (${counts[k] || 0})</option>`).join("");
  sel.value = S.cat;
  sel.classList.toggle("is-on", !!S.cat);
  // same choices in the left column (wide screens)
  const item = (k, label, n) => `<li><button type="button" class="catside__item${k === S.cat ? " is-active" : ""}" data-cat="${k}"
      aria-pressed="${k === S.cat}"><span>${esc(label)}</span><span class="catside__n">${n}</span></button></li>`;
  $("#catSide").innerHTML = item("", t("allCatsLabel"), total) +
    keys.map(k => item(k, t("cats")[k], counts[k] || 0)).join("");
}
$("#catSide").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  S.cat = b.dataset.cat;
  setCatUrl();
  renderCompare();
});
function setCatUrl() {
  const u = new URL(location.href);
  if (S.cat) u.searchParams.set("cat", S.cat); else u.searchParams.delete("cat");
  history.replaceState(history.state, "", u);
}
$("#catSel").addEventListener("change", () => {
  S.cat = $("#catSel").value;
  setCatUrl();
  renderCompare();
});

$("#storeCards").addEventListener("click", e => {
  const b = e.target.closest(".scard");
  if (!b) return;
  S.focus = S.focus === b.dataset.store ? null : b.dataset.store;
  renderCompare();
});
["#sortSel", "#matchOnly", "#saleOnly", "#glutenFree", "#lactoseFree"].forEach(s => $(s).addEventListener("change", renderCompare));

$("#results").addEventListener("click", e => {
  const row = e.target.closest(".row");
  if (!row) return;
  const [st, ...rest] = row.dataset.key.split(":");
  const id = rest.join(":");
  const it = (S.results[st]?.items || []).find(i => String(i.id) === id);
  if (!it) return;
  if (e.target.closest(".add-btn")) { toggleProduct(it); renderCompare(); return; }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) {
    // anywhere else on the row (name link included) opens the product popup instead of a new tab;
    // ctrl/cmd/shift-click on the name still opens the store's page
    if (e.target.closest("a")) { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); }
    openProduct(it);
    return;
  }
  const need = needForItem(it);
  if (!need) return;
  if (act === "inc") need.qty++;
  else if (--need.qty < 1) { S.needs.splice(S.needs.indexOf(need), 1); toast(t("removed")); }
  needsChanged();
  renderCompare();
});
$("#addQueryBtn").addEventListener("click", () => { addNeed(S.query); renderCompare(); });

// ---------- shopping list & trip planner ----------
// The list holds needs ("lait 2% 4L" × 2). The planner searches every enabled store for each
// need, picks each store's best comparable product, then tries every combination of stores:
// another store is only worth it if it saves at least `threshold` dollars.
const PLAN = { cache: {}, running: false, result: null, stale: true, done: 0, total: 0, gen: 0 };

function saveNeeds() {
  store.set("needs", S.needs);
  $("#listCount").hidden = !S.needs.length;
  $("#listCount").textContent = S.needs.length;
}
function needsChanged() {
  saveNeeds();
  PLAN.stale = true;
  renderList();
}
// q = what was typed ("beurre": used for substitutes); target = the product picked, if any
function addNeed(q, qty = 1, target = null) {
  q = (q || "").trim() || (target ? needText(target) : "");
  if (!q) return;
  const key = needKey(q, target);
  const ex = S.needs.find(n => keyOf(n) === key);
  if (ex) ex.qty += qty;
  else S.needs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q, qty,
                      ...(target ? { target, subs: false } : {}) });
  toast(t("added"));
  needsChanged();
}
function toggleNeed(q) {
  const i = S.needs.findIndex(n => keyOf(n) === needKey(q));
  if (i >= 0) { S.needs.splice(i, 1); toast(t("removed")); needsChanged(); }
  else addNeed(q);
}
function toggleProduct(it) {
  const target = slimProduct(it);
  const i = S.needs.findIndex(n => keyOf(n) === needKey("", target));
  if (i >= 0) { S.needs.splice(i, 1); toast(t("removed")); needsChanged(); }
  else addNeed(S.query || needText(it), 1, target);
}

// size asked for in the need itself: "lait 2% 4L" -> 4000 ml, "oeufs 12" / "douzaine" -> 12 ea
const Q_UNITS = { kg: ["g", 1000], g: ["g", 1], lb: ["g", 453.6], lbs: ["g", 453.6], l: ["ml", 1000], ml: ["ml", 1],
                  un: ["ea", 1], unites: ["ea", 1], unite: ["ea", 1], ct: ["ea", 1], pk: ["ea", 1], x: ["ea", 1] };
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(kg|g|lbs?|l|ml|unites?|un|ct|pk)\b/;
const DOZEN_RE = /\b(douzaine|dozen)\b/;
function parseTarget(q) {
  const n = norm(q);
  const m = n.match(SIZE_RE);
  if (m) { const [dim, mult] = Q_UNITS[m[2]]; return { qty: parseFloat(m[1]) * mult, dim }; }
  if (DOZEN_RE.test(n)) return { qty: 12, dim: "ea" };
  return null;
}
// the need minus its size ("oeufs douzaine" -> "oeufs"): what we send to stores (their search
// engines choke on "4L"/"douzaine") and the words a product must contain
const stripSize = q => q.replace(new RegExp(SIZE_RE.source, "gi"), " ").replace(new RegExp(DOZEN_RE.source, "gi"), " ")
  .replace(/\s+/g, " ").trim() || q;
const needTokens = q => tokens(stripSize(norm(q)));
// package quantity in base units (g / ml / ea), derived from price and unit price
const itemQty = it => it.unit && it.unit.value > 0 ? it.price / it.unit.value * (it.unit.dim === "ea" ? 1 : 100) : null;

// ---------- saved store searches (IndexedDB) ----------
// Every search the planner makes is kept in the browser with its time, so reopening the page or
// re-planning an unchanged list needs no network. (Cookies are far too small: a plan is MBs.)
const IDB = (() => {
  let dbp;
  const open = () => dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open("panier", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (mode, fn) => {
    try {
      const db = await open();
      return await new Promise((res, rej) => {
        const tx = db.transaction("kv", mode);
        const req = fn(tx.objectStore("kv"));
        tx.oncomplete = () => res(req?.result);
        tx.onerror = () => rej(tx.error);
      });
    } catch { return undefined; } // private mode / blocked storage: just no saving
  };
  return {
    get: k => run("readonly", s => s.get(k)),
    set: (k, v) => run("readwrite", s => s.put(v, k)),
    del: k => run("readwrite", s => s.delete(k)),
    keys: () => run("readonly", s => s.getAllKeys()),
  };
})();
// How long a store's prices are reused before searching that store again (Settings, per store).
const EXPIRY_CHOICES = [1, 6, 12, 24, 72, 168]; // hours
const DEFAULT_EXPIRY_H = 24;
const expiryMs = k => (Number(S.settings.expiry?.[k]) || DEFAULT_EXPIRY_H) * 3600e3;
const KEEP_MS = 14 * 24 * 3600e3;      // saved searches unused this long are deleted
const PLAN_VER = "q2:"; // bump when items gain fields (q2: loyalty points)
const planKey = (k, q) => `${PLAN_VER}${k}|${S.lang}|${storeOpt(k)}|${norm(q)}`;

// -> {t, items, stale?, failed?}. maxAge: reuse prices up to this old (Infinity = never go online,
// 0 = always search the store). The server keeps every result too (data/prices.db) and falls back
// to its last stored prices when a store can't be reached ("stale").
async function planFetch(k, q, maxAge = expiryMs(k)) {
  const key = planKey(k, q);
  const mem = PLAN.cache[key];
  if (mem && Date.now() - mem.t <= maxAge) return mem;
  const saved = await IDB.get(key);
  if (saved && Date.now() - saved.t <= maxAge) return (PLAN.cache[key] = saved);
  if (maxAge === Infinity) return { t: null, items: [] };
  const p = new URLSearchParams({ q, lang: S.lang });
  const sid = storeOpt(k);
  if (sid) p.set("storeId", sid);
  if (maxAge === 0) p.set("refresh", "1"); else p.set("maxAge", String(Math.round(maxAge / 1000)));
  try {
    const r = await fetch(`/api/search/${k}?${p}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    const v = { t: (d.fetched_at || Date.now() / 1000) * 1000, items: d.items };
    PLAN.cache[key] = v;
    IDB.set(key, v);
    return d.stale ? { ...v, stale: true, error: d.error } : v;
  } catch (e) {
    // server or store unreachable and nothing stored on the server: last prices in this browser
    return saved ? { ...saved, stale: true, error: String(e.message || e) }
                 : { t: null, items: [], failed: true, error: String(e.message || e) };
  }
}

// byStore: store -> {exact: results for the need, generic: results for the typed words (substitutes)}
function pickForNeed(need, byStore) {
  if (need.target) return pickTargeted(need, byStore);
  const exact = {};
  for (const [k, v] of Object.entries(byStore)) exact[k] = v.exact;
  return { picks: pickGeneric(need, exact), offers: [] };
}

// Free-text need: each store's best-value close match, costed for need.qty × the target amount.
function pickGeneric(need, byStore) {
  const toks = needTokens(need.q);
  const matches = {};
  for (const [k, items] of Object.entries(byStore))
    matches[k] = items.filter(it => it.stock !== false && isMatch(it, toks));
  const all = Object.values(matches).flat();
  const target = parseTarget(need.q);
  const dim = target?.dim || dominantDim(all);
  let tq = target?.qty;
  if (!tq) { // no size given: aim for the typical package across stores
    const qs = all.filter(it => it.unit?.dim === dim).map(itemQty).filter(Boolean).sort((a, b) => a - b);
    tq = qs.length ? qs[Math.floor(qs.length / 2)] : null;
  }
  const picks = {};
  for (const [k, ms] of Object.entries(matches)) {
    if (!ms.length) continue;
    const sameDim = ms.filter(it => it.unit?.dim === dim);
    // costs are scaled to the target amount, so any sane package size competes on value;
    // only skip extremes (a 20 kg sack when you want 1 kg)
    const band = tq ? sameDim.filter(it => { const q = itemQty(it); return q && q >= tq / 8 && q <= tq * 8; }) : [];
    const pool = band.length ? band : sameDim.length ? sameDim : ms;
    // value for the target size when we can compare, otherwise shelf price
    const score = it => (tq && it.unit?.dim === dim) ? it.unit.value * (dim === "ea" ? tq : tq / 100) : it.price;
    // the user may have overridden the pick for this store (e.g. quail eggs are cheapest per egg)
    const chosen = need.pick?.[k] && ms.find(it => String(it.id) === need.pick[k]);
    const best = chosen || pool.reduce((a, b) => (score(b) < score(a) ? b : a));
    // Cost the same amount everywhere (one banana vs a 3 lb bag must not look 5× cheaper);
    // `adjusted` flags when that differs from the shelf price of the chosen package.
    const cost = score(best) * need.qty;
    const alts = [...ms].sort((a, b) => score(a) - score(b)).slice(0, 12);
    if (!alts.includes(best)) alts.unshift(best);
    picks[k] = { item: best, cost, adjusted: Math.abs(cost - best.price * need.qty) > 0.05 * cost,
                 alts, override: !!chosen };
  }
  return picks;
}

// Main noun of a product name, brand and size removed: French puts it first ("Beurre salé"),
// English last ("Salted Butter").
// `brands`: brands seen in the results, for stores that leave the brand field empty
// but start the name with it (Walmart: "Gay Lea Beurre Salé").
function headWord(it, brands = []) {
  let name = norm(it.name || "");
  const own = norm(it.brand || "");
  const brand = own && name.startsWith(own) ? own : brands.find(b => name.startsWith(b + " "));
  if (brand) name = name.slice(brand.length);
  const all = words(stripSize(name));
  if (S.lang === "en") {
    const w = all.filter(x => !STOP.has(x) && !/^\d/.test(x));
    return w[w.length - 1] || "";
  }
  // French compounds are different products: "beurre d'arachide", "lait au chocolat" ≠ "beurre", "lait"
  const i = all.findIndex(x => !STOP.has(x) && !/^\d/.test(x));
  if (i < 0) return "";
  const comp = ["d", "de", "du", "des", "au", "aux", "a"].includes(all[i + 1]) && all[i + 2] && !/^\d/.test(all[i + 2]);
  return comp ? `${all[i]} ${all[i + 2]}` : all[i];
}
const stem = w => w.split(" ").map(x => x.replace(/(es|s|x)$/, "")).join(" ");
const sameStem = (a, b) => !!a && !!b && stem(a) === stem(b);

// ---- recognising the same product across stores ----
// Stores name one product very differently (Walmart "Christie CHIPS AHOY ! Biscuits aux pépites
// de chocolat originaux, 1 emballage refermable", Metro brand "Chips Ahoy!" + "Biscuits aux
// brisures de chocolat"). Barcode first; otherwise a word-similarity score.
const PACK_WORDS = new Set(["emballage", "refermable", "paquet", "paquets", "format", "economique", "familial",
  "sachet", "sachets", "individuel", "individuels", "boite", "bouteille", "sac", "pqt", "emb", "pack", "un", "x", "ea", "ch"]);
const SYN = { brisures: "pepites", brisure: "pepites", pepite: "pepites", biscuit: "biscuits" };
const sigWords = s => [...new Set(words(stripSize(norm(s)))
  .filter(w => !STOP.has(w) && !PACK_WORDS.has(w) && !/^\d/.test(w)).map(w => SYN[w] || w))];
function tokEq(a, b) {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 4 && i >= Math.min(a.length, b.length) - 2; // originaux/original, tendre/tendres
}
const upcEq = (a, b) => !!a && !!b && (a === b || a.slice(0, -1) === b || b.slice(0, -1) === a);

// 0..1 (2 = same barcode). `idf` weighs distinctive words ("originaux", "tendres") above words
// every candidate shares ("biscuits", "chocolat"); extra variant words cost points.
function sameProductScore(tg, it, idf) {
  if (upcEq(tg.upc, it.upc)) return 2;
  const s = nameScore(tg, it, idf);
  return gtinHint(tg, it, s) ? Math.max(s, 1.5) : s;   // 1.5: not a proven barcode (2) but better than any name score
}

// Maxi's API almost never returns a barcode (98% of its products), but its picture files are named after the
// GTIN: ".../6107731536_enfr_front_..._250.png" = UPC 061077315367 without the leading 0 and check digit (the
// same form IGA uses). The picture code is only a HINT (it disagrees with the real barcode ~40% of the time,
// e.g. case / multipack pictures), so it counts only together with the same printed size and some name overlap.
const IMG_GTIN_RE = /\/(\d{10,13})_(?:enfr|fr|en)_/;
const imgGtin = it => { const m = IMG_GTIN_RE.exec(it.image || ""); return m ? m[1] : null; };
const gtinOf = it => ((it.upc || imgGtin(it) || "") + "").replace(/^0+/, "");
const printedSize = it => parseTarget(String(it.size || "").replace(/(\d),(\d)/g, "$1.$2"));
function gtinHint(tg, it, s) {
  if (s < 0.25) return false;                              // names must at least overlap
  const a = gtinOf(tg), b = gtinOf(it);
  if (!a || !b || !upcEq(a, b)) return false;
  const pa = printedSize(tg), pb = printedSize(it);
  if (pa && pb && pa.dim === pb.dim) return Math.abs(Math.log(pa.qty / pb.qty)) < 0.06;   // "398 ml" = "398 mL"
  const qa = itemQty(tg), qb = itemQty(it);                // else the size implied by price / unit price
  if (qa && qb) return Math.abs(Math.log(qa / qb)) < 0.3;
  return s >= 0.4;
}

function nameScore(tg, it, idf) {
  const T = sigWords(`${tg.brand || ""} ${(tg.name || "").split(",")[0]}`);
  const C = sigWords(`${it.brand || ""} ${it.name}`);
  if (!T.length || !C.length) return 0;
  const w = t => 0.5 + (idf[t] ?? 1);
  let got = 0, tot = 0;
  for (const t of T) { tot += w(t); if (C.some(c => tokEq(t, c))) got += w(t); }
  // extra words cost by how distinctive they are: "tendres", "chunky", "mini" mark another
  // variant; "chocolat" or the brand, present on most candidates, barely count
  const rare = idf.__max || 1;
  const extras = C.filter(c => !T.some(t => tokEq(t, c))).reduce((a, c) => a + (idf[c] ?? rare) / rare, 0);
  // different brands on both sides (Selection vs Christie) = different product
  const tb = sigWords(tg.brand || ""), cb = sigWords(it.brand || "");
  const brandClash = tb.length && cb.length && !cb.some(c => T.some(t => tokEq(t, c))) && !tb.some(t => C.some(c => tokEq(t, c)));
  // Stores often leave the brand field empty (Walmart). A branded target whose brand appears
  // nowhere in the candidate AND whose name carries words of its own is probably another brand
  // ("Margarine avec huile d'olive Great Value" vs Becel). No extra words = same product with the
  // parent brand dropped (Walmart's "Biscuits Chips Ahoy! Originaux" for Christie's).
  const hasExtra = C.some(c => !T.some(t => tokEq(t, c)));
  const brandMissing = !brandClash && tb.length && hasExtra && !tb.some(t => C.some(c => tokEq(t, c)));
  return got / tot - 0.15 * extras - (brandClash ? 0.4 : 0) - (brandMissing ? 0.3 : 0);
}
function buildIdf(items) {
  const df = {};
  for (const it of items) for (const w of sigWords(`${it.brand || ""} ${it.name}`)) df[w] = (df[w] || 0) + 1;
  const n = items.length || 1;
  const idf = Object.fromEntries(Object.entries(df).map(([w, d]) => [w, Math.log(1 + n / d)]));
  idf.__max = Math.log(1 + n); // a word seen on a single candidate
  return idf;
}
// short search for a targeted product: brand + first words of the name ("Christie Biscuits Chips Ahoy!")
function targetQuery(tg) {
  const name = stripSize((tg.name || "").split(",")[0]);
  const brand = tg.brand && !norm(name).includes(norm(tg.brand)) ? tg.brand + " " : "";
  return (brand + name.split(/\s+/).slice(0, 4).join(" ")).trim();
}
const SAME_MIN = 0.5; // below this a candidate is not considered the same product

// Targeted product: the same product at each store (closest package size). With `subs`,
// an on-sale similar product replaces it when that is cheaper for the same amount.
function pickTargeted(need, byStore) {
  const tg = need.target;
  const pool = [...new Map(Object.values(byStore).flatMap(v => [...(v.exact || []), ...(v.generic || [])])
    .map(it => [`${it.store}|${it.id}`, it])).values()];
  const idf = buildIdf(pool);
  const parsed = parseTarget(tg.size || "");
  const dim = tg.unit?.dim || parsed?.dim;
  const tq = itemQty(tg) || parsed?.qty;
  const score = it => (tq && it.unit?.dim === dim) ? it.unit.value * (dim === "ea" ? tq : tq / 100) : it.price;
  const dist = it => { const q = itemQty(it); return q && tq ? Math.abs(Math.log(q / tq)) : 5; };
  // No barcode on the target (Walmart / Giant Tiger)? Borrow one from a confident match elsewhere
  // (similar name AND same package size), so stores naming it differently still match by barcode.
  let upc = tg.upc;
  if (!upc) {
    const byUpc = {};
    for (const it of pool.filter(i => i.upc)) {
      const s = sameProductScore(tg, it, idf);
      if (s < 0.7) continue;
      const r = s - 0.4 * Math.min(dist(it), 2);
      if (!byUpc[it.upc] || r > byUpc[it.upc]) byUpc[it.upc] = r;
    }
    const ranked = Object.entries(byUpc).sort((a, b) => b[1] - a[1]);
    if (ranked[0] && (!ranked[1] || ranked[0][1] - ranked[1][1] >= 0.05)) upc = ranked[0][0];
  }
  const tgm = upc ? { ...tg, upc } : tg;
  const genToks = needTokens(need.q);
  const onSale = it => it.sale || it.promo;
  // A substitute must be the same kind of thing: same main noun as the targeted product
  // (butter-flavoured popcorn and petit-beurre biscuits both contain "beurre").
  const brands = [...new Set(Object.values(byStore).flatMap(v => [...(v.exact || []), ...(v.generic || [])])
    .map(it => norm(it.brand || "")).filter(b => b.length > 1))].sort((a, b) => b.length - a.length);
  const head = headWord(tg, brands);
  // Brandless names that open with a capitalized brand: "Gay Lea Beurre Salé" is butter, but
  // "Biscuits petit beurre" / "Maïs à éclater à saveur de beurre" are not (lowercase lead-in).
  const brandLedHead = it => {
    if (it.brand || S.lang === "en") return false;
    const raw = (it.name || "").split(/\s+/).slice(0, 4);
    const i = raw.findIndex(w => sameStem(words(w)[0] || "", head));
    return i > 0 && raw.slice(0, i).every(w => /^\p{Lu}/u.test(w));
  };
  const similar = it => isMatch(it, genToks) && !!head && (sameStem(headWord(it, brands), head) || brandLedHead(it));
  const picks = {}, offers = [];
  for (const [k, { exact = [], generic = [] }] of Object.entries(byStore)) {
    const cands = [...new Map([...exact, ...generic].map(i => [String(i.id), i])).values()];
    const scored = cands.filter(it => it.stock !== false)
      .map(it => ({ it, s: sameProductScore(tgm, it, idf) })).filter(x => x.s >= SAME_MIN);
    // best = most similar, then closest package size, then cheapest
    const rank = x => x.s - 0.15 * Math.min(dist(x.it), 2);
    scored.sort((a, b) => rank(b) - rank(a) || score(a.it) - score(b.it));
    const same = scored.map(x => x.it);
    const exactBest = same[0] || null;
    let sub = null;
    const subPool = need.subs ? [...new Map([...generic, ...exact].map(i => [String(i.id), i])).values()].filter(it =>
      it !== exactBest && it.stock !== false && onSale(it) && it.unit?.dim === dim && similar(it) &&
      (!tq || (itemQty(it) >= tq / 2 && itemQty(it) <= tq * 2))) : [];
    if (subPool.length) {
      sub = subPool.reduce((a, b) => (score(b) < score(a) ? b : a));
      if (exactBest && score(sub) >= score(exactBest) - 0.005) sub = null; // no cheaper deal
    }
    const all = [...exact, ...generic];
    const chosen = need.pick?.[k] && all.find(it => String(it.id) === need.pick[k]);
    // The plan always prices the targeted product; a cheaper sale substitute is only *offered*
    // (the user accepts it with "Utiliser", which stores it as their pick for that store).
    // Once the user accepts a substitute for this item (need.subsOn), every store uses its
    // cheaper sale substitute, so the grid and the store choice reflect substitutes everywhere.
    const auto = need.subsOn && sub && !chosen;
    if (sub && sub !== chosen && !auto)
      offers.push({ store: k, item: sub, cost: score(sub) * need.qty,
                    save: exactBest ? (score(exactBest) - score(sub)) * need.qty : null });
    const best = chosen || (auto ? sub : exactBest);
    if (!best) continue;
    const cost = score(best) * need.qty;
    const isSub = (!!chosen && !same.includes(chosen)) || (auto && best === sub); // an accepted substitute
    const alts = [...new Map([...same, ...subPool].map(i => [String(i.id), i])).values()]
      .sort((a, b) => score(a) - score(b)).slice(0, 12);
    if (!alts.includes(best)) alts.unshift(best);
    picks[k] = { item: best, cost, adjusted: Math.abs(cost - best.price * need.qty) > 0.05 * cost, alts,
                 override: !!chosen, sub: isSub, instead: isSub ? exactBest : null,
                 save: isSub && exactBest ? (score(exactBest) - score(best)) * need.qty : 0 };
  }
  return { picks, offers };
}

function optimize(rows, stores) {
  const bestBy = {};
  for (let mask = 1; mask < (1 << stores.length); mask++) {
    const set = stores.filter((_, i) => mask & (1 << i));
    let total = 0, missing = 0;
    const assign = rows.map(r => {
      let best = null;
      for (const k of set) { const p = r.picks[k]; if (p && (!best || p.cost < best.cost)) best = { ...p, store: k }; }
      if (best) total += best.cost; else missing++;
      return best;
    });
    if (set.some(k => !assign.some(a => a && a.store === k))) continue; // a store you'd visit for nothing
    const plan = { set, total, missing, assign };
    const cur = bestBy[set.length];
    if (!cur || missing < cur.missing || (missing === cur.missing && total < cur.total)) bestBy[set.length] = plan;
  }
  const th = Number(S.settings.threshold) || 0;
  const maxK = Math.min(Number(S.settings.maxStores) || 3, stores.length);
  let rec = null, why = "";
  for (let k = 1; k <= maxK; k++) {
    const p = bestBy[k];
    if (!p) continue;
    if (!rec) { rec = p; continue; }
    if (p.missing < rec.missing) { rec = p; why = "cover"; }
    else if (p.missing === rec.missing && rec.total - p.total >= th) { rec = p; why = "go"; }
  }
  // explain why we did not go further
  let stay = null;
  if (rec) {
    const next = bestBy[rec.set.length + 1];
    if (next && rec.set.length < maxK && next.missing === rec.missing) stay = { k: next.set.length, save: rec.total - next.total };
  }
  return { bestBy, rec, why, stay, maxK };
}

// Free text: search it. Targeted product: a short brand + name query ("exact") and what was
// typed ("generic"); store search engines return nothing for a full 15-word product name.
function planJobs(stores) {
  const jobs = [];
  for (const n of S.needs) {
    const typed = stripSize(n.q);
    const exactQ = n.target ? targetQuery(n.target) : typed;
    for (const k of stores) {
      jobs.push([n, k, "exact", exactQ]);
      if (n.target && norm(typed) !== norm(exactQ)) jobs.push([n, k, "generic", typed]);
    }
  }
  return jobs;
}

// opts.refresh: ignore saved prices; opts.offline: saved results only (page load)
async function runPlan(opts = {}) {
  const stores = ORDER.filter(k => S.enabled.has(k));
  if (!S.needs.length || !stores.length) return;
  const ageFor = k => opts.refresh ? 0 : opts.offline ? Infinity : expiryMs(k);
  const gen = ++PLAN.gen;
  PLAN.running = true;
  PLAN.stale = false;
  PLAN.done = 0;
  const jobs = planJobs(stores);
  PLAN.total = jobs.length;
  if (!opts.offline) renderPlan(); // offline restore is instant: no progress bar flash
  const found = {}; // need id -> store -> {exact, generic}
  for (const n of S.needs) { found[n.id] = {}; for (const k of stores) found[n.id][k] = { exact: [], generic: [] }; }
  let next = 0, oldest = Infinity;
  const issues = {}; // store -> {stale, failed, oldest}: searches that couldn't reach the store
  let expired = false;
  const worker = async () => {
    while (next < jobs.length) {
      const [n, k, kind, q] = jobs[next++];
      const r = await planFetch(k, q, ageFor(k));
      found[n.id][k][kind] = r.items;
      if (r.t) oldest = Math.min(oldest, r.t);
      if (r.t && Date.now() - r.t > expiryMs(k)) expired = true;
      if (r.stale || r.failed) {
        const is = issues[k] ||= { stale: 0, failed: 0, oldest: Infinity };
        if (r.failed) is.failed++; else { is.stale++; is.oldest = Math.min(is.oldest, r.t); }
      }
      PLAN.done++;
      if (gen === PLAN.gen && !opts.offline) renderPlanProgress();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (gen !== PLAN.gen) return;
  PLAN.found = found;
  PLAN.pricesAt = oldest === Infinity ? Date.now() : oldest;
  PLAN.issues = issues;
  PLAN.expired = expired;
  PLAN.running = false;
  IDB.set("lastPlan", { t: Date.now() });
  recompute(stores);
}

// On page load: if the list was planned before and every search it needs is saved,
// rebuild the plan from those results (no network). Otherwise wait for the button.
async function restorePlan() {
  if (!S.needs.length || !(await IDB.get("lastPlan"))) return;
  const stores = ORDER.filter(k => S.enabled.has(k));
  const keys = new Set((await IDB.keys()) || []);
  if (!planJobs(stores).every(([, k, , q]) => keys.has(planKey(k, q)))) {
    PLAN.stale = true;
    return;
  }
  await runPlan({ offline: true });
}

// drop saved searches not used for two weeks
async function pruneSaved() {
  for (const key of (await IDB.keys()) || []) {
    if (!/^q\d*:/.test(String(key))) continue;
    if (!String(key).startsWith(PLAN_VER)) { IDB.del(key); continue; } // older format
    const v = await IDB.get(key);
    if (!v || Date.now() - v.t > KEEP_MS) IDB.del(key);
  }
}

// re-pick and re-optimize from the search results already fetched (after an override)
function recompute(stores = PLAN.result?.stores) {
  const rows = S.needs.filter(n => PLAN.found?.[n.id]).map(n => ({ need: n, ...pickForNeed(n, PLAN.found[n.id]) }));
  PLAN.result = { rows, stores, ...optimize(rows, stores) };
  renderPlan();
}

function renderList() {
  renderBaskets();
  const empty = !S.needs.length;
  $("#listEmpty").hidden = !empty;
  $("#planBox").hidden = empty;
  $("#needList").innerHTML = S.needs.map(n => `
    <li class="need${n.target ? " need--target" : ""}" data-id="${esc(n.id)}">
      <span class="qty"><button data-act="dec" aria-label="-">−</button><span>${n.qty}</span><button data-act="inc" aria-label="+">+</button></span>
      ${n.target?.image ? `<img class="need__img" src="${esc(n.target.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <span class="need__text">
        <span class="need__q">${esc(needLabel(n))}</span>
        <span class="need__meta">${n.target
          ? `${n.target.size ? esc(n.target.size) + " · " : ""}<label class="need__subs"><input type="checkbox" data-act="subs"${n.subs ? " checked" : ""}> ${t("allowSubs")}</label>${n.subsOn ? ` · <span class="subs-on">${t("subsOnLabel")}</span>` : ""}`
          : esc(t("anyBrand"))}</span>
      </span>
      <button class="need__rm" data-act="rm" aria-label="×">×</button>
    </li>`).join("");
  $("#thresholdIn").value = S.settings.threshold;
  $("#maxStoresSel").value = String(S.settings.maxStores);
  renderPlan();
}

function renderPlanProgress() {
  const el = $("#planProgress");
  if (!el) return;
  el.querySelector("span").textContent = t("planning")(PLAN.done, PLAN.total);
  el.querySelector("i").style.width = `${PLAN.total ? PLAN.done / PLAN.total * 100 : 0}%`;
}

const offerHtml = (r, o, showStore) => `<div class="offer">
  <span>${t("offer")}${showStore ? ` · <span class="badge badge--${o.store}" style="--c:${STORES[o.store].color}">${esc(storeName(o.store))}</span>` : ""} :
    <b>${esc(needText(o.item))}</b>${o.item.size ? " · " + esc(o.item.size) : ""} — ${money(o.cost)}
    ${o.save != null ? `<span class="offer__save">${t("saves")(money(o.save))}</span>` : `<span class="offer__save">${t("notHere")}</span>`}</span>
  <button class="btn btn--sm" data-act="usesub" data-need="${esc(r.need.id)}" data-store="${o.store}" data-id="${esc(o.item.id)}">${t("use")}</button>
</div>`;

// ---------- loyalty points (information only: never used to choose stores) ----------
// base: points per $ spent before tax on every purchase; value: $ per point.
// Sources: official program pages (Sept. 2026). Only Metro's moi gives points on everything;
// the others reward through offers, and only Maxi publishes product bonus points (PC Optimum).
const LOYALTY = {
  metro:      { name: "moi",        base: 1, value: 1 / 125 },  // 125 pts = 1 $ (redeem from 500 pts = 4 $)
  superc:     { name: "moi",        base: 0, value: 1 / 125 },  // offers only
  iga:        { name: "Scene+",     base: 0, value: 0.01 },     // 1 000 pts = 10 $, offers only
  maxi:       { name: "PC Optimum", base: 0, value: 0.001 },    // 10 000 pts = 10 $, offers + product bonus
  loblaws:    { name: "PC Optimum", base: 0, value: 0.001 },
  gianttiger: { name: "GT VIP",     none: true },               // member offers, no points
  walmart:    { none: true },
};
// lines: [need row, assignment] for one store's basket
function basketPoints(k, lines) {
  const L = LOYALTY[k];
  if (!L) return null;
  if (L.none) return { text: t(k === "walmart" ? "ptsWalmart" : "ptsNone")(L.name) };
  const spent = lines.reduce((acc, [r, a]) => acc + a.item.price * r.need.qty, 0);
  const base = Math.floor(spent * L.base);
  const bonus = lines.reduce((acc, [, a]) => acc + (a.item.points || 0), 0);
  const pts = base + bonus;
  const fmt = n => n.toLocaleString(S.lang === "fr" ? "fr-CA" : "en-CA");
  if (!pts) return { text: t("ptsOffersOnly")(L.name) };
  return { text: t("ptsEarn")(L.name, fmt(pts), money(pts * L.value), bonus ? t("ptsBonus")(fmt(bonus)) : "") };
}

// the item's price at the other stores, cheapest first, so nothing found is hidden
function elsewhereHtml(r, k, stores) {
  const others = stores.filter(s => s !== k && r.picks[s]).sort((a, b) => r.picks[a].cost - r.picks[b].cost);
  if (!others.length) return "";
  return `<div class="elsewhere">${t("elsewhere")} : ${others.map(s => {
    const p = r.picks[s];
    const label = `${needText(p.item)}${p.item.size ? " · " + p.item.size : ""}`;
    return `<a href="${esc(p.item.url || "#")}" target="_blank" rel="noopener" title="${esc(label)}"><span class="dot" style="background:${STORES[s].color}"></span>${esc(storeName(s))} ${money(p.cost)}${p.item.unit ? "" : "*"}</a>`;
  }).join(" · ")}</div>`;
}

function renderPlan() {
  const out = $("#planOut");
  $("#planBtn").textContent = PLAN.result ? t("replan") : t("plan");
  $("#planBtn").disabled = PLAN.running || !S.needs.length;
  if (PLAN.running) {
    out.innerHTML = `<div class="progress" id="planProgress"><span></span><div class="progress__bar"><i></i></div></div>`;
    renderPlanProgress();
    return;
  }
  const R = PLAN.result;
  if (!R) { out.innerHTML = ""; return; }
  const staleNote = PLAN.stale ? `<p class="note note--warn">${t("stale")} <button class="linklike" data-act="replan">${t("replan")}</button></p>` : "";
  const age = PLAN.pricesAt ? Date.now() - PLAN.pricesAt : 0;
  const when = PLAN.pricesAt ? new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA",
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(PLAN.pricesAt)) : "";
  const dfl = new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const iss = Object.entries(PLAN.issues || {});
  const allDown = iss.length && iss.length === R.stores.length;
  const oldestStale = Math.min(...iss.map(([, is]) => is.oldest));
  const issueNote = allDown
    // every store failed: most likely the Panier server itself is down, one message is enough
    ? `<p class="note note--warn issue">⚠ ${esc(isFinite(oldestStale) ? t("allDown")(dfl.format(new Date(oldestStale))) : t("allDownNoData"))}</p>`
    : iss.map(([k, is]) => `<p class="note note--warn issue">⚠ ${esc(storeName(k))} : ${
        is.failed ? esc(t("searchFailed")(is.failed)) : esc(t("searchStale")(is.stale, dfl.format(new Date(is.oldest))))}</p>`).join("");
  const ageNote = issueNote + (when ? `<p class="note prices-at${PLAN.expired ? " note--warn" : ""}">${t("pricesAt")(when)}${PLAN.expired ? " — " + t("pricesOld") : ""}
    · <button class="linklike" data-act="refresh">${t("refresh")}</button></p>` : "");
  if (!R.rec) { out.innerHTML = staleNote + `<p class="note">${t("none")}</p>`; return; }
  const th = money(Number(S.settings.threshold) || 0);
  const one = R.bestBy[1];

  // one card per number of stores
  const cards = [];
  for (let k = 1; k <= R.maxK; k++) {
    const p = R.bestBy[k];
    if (!p) continue;
    const isRec = p === R.rec;
    const save = one && k > 1 && p.missing === one.missing ? one.total - p.total : 0;
    cards.push(`<div class="pcard${isRec ? " is-rec" : ""}">
      <div class="pcard__head"><span>${t("storesN")(k)}</span>${isRec ? `<span class="best-tag">${t("recommended")}</span>` : ""}</div>
      <div class="pcard__stores">${p.set.map(s => `<span class="badge badge--${s}" style="--c:${STORES[s].color}">${esc(storeName(s))}</span>`).join(" ")}</div>
      <div class="pcard__total">${money(p.total)}</div>
      <div class="pcard__meta">${save > 0.005 ? `${t("saves")(money(save))} ${t("vsOne")}` : "&nbsp;"}</div>
      ${p.missing ? `<div class="pcard__miss">${t("missingN")(p.missing)}</div>` : ""}
    </div>`);
  }
  let why = "";
  if (R.why === "cover") why = t("whyCover");
  else if (R.why === "go" && one) why = t("whyGo")(R.rec.set.length, money(one.total - R.rec.total), th);
  if (R.stay) why += (why ? " " : "") + t("whyStay")(R.stay.k, money(Math.max(0, R.stay.save)), th);

  // recommended plan, grouped by store
  const groups = R.rec.set.map(k => {
    const lines = R.rows.map((r, i) => [r, R.rec.assign[i]]).filter(([, a]) => a && a.store === k);
    const sub = lines.reduce((acc, [, a]) => acc + a.cost, 0);
    return `<div class="lgroup" style="--c:${STORES[k].color}">
      <div class="lgroup__head">${esc(storeName(k))}<span class="lgroup__total">${money(sub)}</span></div>
      ${lines.map(([r, a]) => `<div class="litem">
        ${a.item.image ? `<img src="${esc(a.item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "<div></div>"}
        <div>
          <div class="litem__name">${r.need.qty > 1 ? `${r.need.qty} × ` : ""}${esc(needLabel(r.need))}${!a.item.unit ? ` <span class="badge badge--muted" title="${esc(t("unsizedHint"))}">${t("unsized")}</span>` : ""}</div>
          ${a.sub ? `<div class="subnote">${t("subFound")} — ${a.instead ? `${esc(t("insteadOf")(needText(a.instead)))} · ${t("saves")(money(a.save))}` : esc(t("subOnly"))}
            <button class="linklike" data-act="undosub" data-need="${esc(r.need.id)}" data-store="${k}">${t("undo")}</button></div>` : ""}
          <div class="litem__sub">
            <select class="pick" data-need="${esc(r.need.id)}" data-store="${k}" aria-label="${esc(t("choose"))}">
              ${a.alts.map(it => `<option value="${esc(it.id)}"${it === a.item ? " selected" : ""}>${esc(needText(it))}${it.size ? " · " + esc(it.size) : ""} — ${money(it.price)}</option>`).join("")}
            </select>
            ${a.item.url ? `<a class="pick__link" href="${esc(a.item.url)}" target="_blank" rel="noopener" aria-label="↗">↗</a>` : ""}
            ${a.item.sale ? `<span class="sale-text">${t("sale")}</span>` : ""}
          </div>
          ${(r.offers || []).filter(o => o.store === k).map(o => offerHtml(r, o, false)).join("")}
          ${elsewhereHtml(r, k, R.stores)}
        </div>
        <div class="litem__right"><span class="litem__price">${money(a.cost)}</span>${a.adjusted ? `<span class="litem__each">${t("shelf")(money(a.item.price))}</span>` : r.need.qty > 1 ? `<span class="litem__each">${money(a.item.price)} ×${r.need.qty}</span>` : ""}</div>
      </div>`).join("")}
      ${(() => { const bp = basketPoints(k, lines); return bp ? `<div class="lpoints" title="${esc(t("ptsHint"))}">🎁 ${esc(bp.text)}</div>` : ""; })()}
    </div>`;
  }).join("");
  const missing = R.rows.filter((r, i) => !R.rec.assign[i]);
  const planOffers = R.rows.flatMap((r, i) => (r.offers || []).filter(o => R.rec.assign[i] ? o.store === R.rec.assign[i].store : true));
  const offersNote = planOffers.length
    ? `<p class="offers-note">${esc(t("offersSum")(planOffers.length, planOffers.some(o => o.save) ? money(planOffers.reduce((a, o) => a + (o.save || 0), 0)) : ""))}</p>` : "";

  // price grid: every need × every store
  const grid = `<div class="grid-wrap"><table class="pgrid">
    <thead><tr><th>${t("need")}</th>${R.stores.map(k => `<th><span class="dot" style="background:${STORES[k].color}"></span>${esc(storeName(k))}</th>`).join("")}</tr></thead>
    <tbody>${R.rows.map((r, i) => {
      const costs = R.stores.map(k => r.picks[k]?.cost ?? Infinity);
      const min = Math.min(...costs);
      const chosen = R.rec.assign[i]?.store;
      return `<tr><td class="pgrid__need">${r.need.qty > 1 ? `${r.need.qty} × ` : ""}${esc(needLabel(r.need))}</td>${R.stores.map(k => {
        const p = r.picks[k];
        const o = (r.offers || []).find(x => x.store === k);
        const hint = o ? `<small class="offer-hint" title="${esc(needText(o.item))}">♻ ${money(o.cost)}</small>` : "";
        if (!p) return `<td class="pgrid__na">—${hint}</td>`;
        const cls = [p.cost === min ? "is-min" : "", chosen === k ? "is-chosen" : "", p.sub ? "is-sub" : ""].join(" ");
        const label = `${needText(p.item)}${p.item.size ? " · " + p.item.size : ""}`;
        return `<td class="${cls}"><a href="${esc(p.item.url || "#")}" target="_blank" rel="noopener" title="${esc(label)}">${p.sub ? "♻ " : ""}${money(p.cost)}</a>${hint}</td>`;
      }).join("")}</tr>`;
    }).join("")}</tbody>
    <tfoot><tr><td>${t("total")}</td>${R.stores.map(k => {
      const has = R.rows.filter(r => r.picks[k]);
      const tot = has.reduce((a, r) => a + r.picks[k].cost, 0);
      return `<td>${money(tot)}${has.length < R.rows.length ? `<small> (${has.length}/${R.rows.length})</small>` : ""}</td>`;
    }).join("")}</tr></tfoot>
  </table></div>`;

  out.innerHTML = staleNote + ageNote + `
    <div class="pcards">${cards.join("")}</div>
    ${why ? `<p class="why">${esc(why)}</p>` : ""}
    <h2 class="section-title">${t("whereTo")}</h2>
    ${offersNote}
    ${groups}
    ${missing.length ? `<div class="lgroup" style="--c:var(--s-other)"><div class="lgroup__head">${t("notFound")}</div>
      ${missing.map(r => `<div class="litem litem--plain"><div></div><div><div class="litem__name">${esc(needLabel(r.need))}</div>
        ${(r.offers || []).map(o => offerHtml(r, o, true)).join("")}</div><div></div></div>`).join("")}</div>` : ""}
    <div class="lfoot">
      <button class="btn" data-act="copy">${t("copy")}</button>
      <span class="lfoot__total">${t("total")} ${money(R.rec.total)}</span>
    </div>
    <h2 class="section-title">${t("byItem")}</h2>
    ${grid}
    <p class="note">${t("planHint")}</p>`;
}

// ---------- type-ahead product suggestions ----------
const SUG = { gen: 0, q: "", items: [], idx: -1, timer: null, open: false };
const needQty = () => Math.max(1, parseInt($("#needQty").value, 10) || 1);

function hideSug() {
  SUG.open = false;
  SUG.gen++;
  clearTimeout(SUG.timer);
  $("#needSuggest").hidden = true;
}
async function loadSug(q) {
  const gen = ++SUG.gen;
  renderSug(q, null);
  const p = new URLSearchParams({ q: stripSize(q), lang: S.lang });
  if (S.settings.maxi) p.set("maxiStore", S.settings.maxi);
  try {
    const d = await (await fetch(`/api/suggest?${p}`)).json();
    if (gen !== SUG.gen) return;
    const toks = needTokens(q);
    const want = parseTarget(q);
    // "Beurre salé" before "Biscuits petit beurre": rank by where the first typed word appears in the name
    const pos = it => { const w = words(it.name); const i = toks.length ? w.findIndex(x => x.startsWith(toks[0])) : 0; return i < 0 ? 99 : i; };
    let items = (d.items || []).filter(it => isMatch(it, toks))
      .map((it, i) => [it, pos(it), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
    if (want) { // asked for "4L": that size first
      const fits = it => { const x = itemQty(it); return it.unit?.dim === want.dim && x && Math.abs(Math.log(x / want.qty)) < 0.15; };
      items = [...items.filter(fits), ...items.filter(it => !fits(it))];
    }
    renderSug(q, items); // all matches; the dropdown scrolls
  } catch {
    if (gen === SUG.gen) renderSug(q, []);
  }
}
function renderSug(q, items) {
  SUG.q = q;
  SUG.items = items || [];
  SUG.idx = -1;
  SUG.open = true;
  const el = $("#needSuggest");
  el.hidden = false;
  el.innerHTML = `<li class="sug sug--generic" data-i="-1" role="option">${esc(t("anyProduct")(q))}</li>` + (
    items === null ? `<li class="sug sug--note"><span class="spinner"></span> ${t("loading")}</li>`
    : items.length ? items.map((it, i) => `<li class="sug" data-i="${i}" role="option">
        ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "<span></span>"}
        <span class="sug__text"><span class="sug__name">${esc(needText(it))}</span>
          <span class="sug__meta">${it.size ? esc(it.size) + " · " : ""}${t("from")(money(it.min_price ?? it.price))} · ${it.stores.map(storeName).map(esc).join(", ")}</span></span>
      </li>`).join("")
    : `<li class="sug sug--note">${t("noSug")}</li>`);
}
function markSug() {
  document.querySelectorAll("#needSuggest .sug[data-i]").forEach(li => {
    const on = Number(li.dataset.i) === SUG.idx;
    li.classList.toggle("is-active", on);
    if (on) li.scrollIntoView({ block: "nearest" }); // keep the keyboard selection visible
  });
}
function chooseSug(i) {
  const q = SUG.q || $("#needIn").value;
  if (i >= 0 && SUG.items[i]) addNeed(q, needQty(), slimProduct(SUG.items[i]));
  else addNeed(q, needQty());
  $("#needIn").value = "";
  $("#needQty").value = 1;
  hideSug();
  $("#needIn").focus();
}

$("#needIn").addEventListener("input", () => {
  clearTimeout(SUG.timer);
  const q = $("#needIn").value.trim();
  if (q.length < 2) { hideSug(); return; }
  SUG.timer = setTimeout(() => loadSug(q), 300);
});
$("#needIn").addEventListener("keydown", e => {
  if (!SUG.open) return;
  const n = SUG.items.length;
  if (e.key === "ArrowDown") { e.preventDefault(); SUG.idx = Math.min(n - 1, SUG.idx + 1); markSug(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); SUG.idx = Math.max(-1, SUG.idx - 1); markSug(); }
  else if (e.key === "Escape") hideSug();
});
$("#needIn").addEventListener("blur", () => setTimeout(hideSug, 150));
// mousedown (not click) so the input's blur doesn't close the list first
$("#needSuggest").addEventListener("mousedown", e => {
  const li = e.target.closest(".sug[data-i]");
  if (!li) return;
  e.preventDefault();
  chooseSug(Number(li.dataset.i));
});
$("#needForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!$("#needIn").value.trim()) return;
  SUG.q = $("#needIn").value.trim();
  chooseSug(SUG.open ? SUG.idx : -1);
});
$("#needList").addEventListener("click", e => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  const n = S.needs.find(x => x.id === e.target.closest(".need")?.dataset.id);
  if (!act || !n) return;
  if (act === "inc") n.qty++;
  if (act === "dec") n.qty = Math.max(1, n.qty - 1);
  if (act === "rm") S.needs.splice(S.needs.indexOf(n), 1);
  if (act === "subs") { n.subs = e.target.checked; if (!n.subs) delete n.subsOn; }
  needsChanged();
  if (PLAN.result && S.needs.length) runPlan(); // cached searches make this quick
});
// ---------- saved baskets ----------
// Named copies of the list, kept in this browser: [{id, name, savedAt, needs}]
const getBaskets = () => store.get("baskets", []);
const setBaskets = bs => store.set("baskets", bs);

function renderBaskets() {
  const bs = getBaskets();
  $("#saveBasket").disabled = !S.needs.length;
  $("#emptyBasket").disabled = !S.needs.length;
  const df = new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
  $("#savedBaskets").innerHTML = bs.length ? `
    <h2 class="section-title">${t("savedBaskets")}</h2>
    <ul class="baskets">${bs.map(b => `
      <li class="basket" data-id="${esc(b.id)}">
        <span class="basket__text"><span class="basket__name">${esc(b.name)}</span>
          <span class="basket__meta">${t("itemsN")(b.needs.length)} · ${df.format(new Date(b.savedAt))}</span></span>
        <button class="btn btn--ghost" type="button" data-act="load">${t("load")}</button>
        <button class="need__rm" type="button" data-act="del" aria-label="×">×</button>
      </li>`).join("")}</ul>` : "";
}

$("#saveBasket").addEventListener("click", () => {
  if (!S.needs.length) return;
  const df = new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { month: "long", day: "numeric" });
  $("#basketName").value = S.basketName || t("basketDefault")(df.format(new Date()));
  $("#basketDlg").showModal();
  $("#basketName").select();
});
$("#basketDlg").addEventListener("close", () => {
  if ($("#basketDlg").returnValue !== "save") return;
  const name = $("#basketName").value.trim() || t("basketDefault")(new Date().toLocaleDateString());
  const bs = getBaskets();
  const snapshot = JSON.parse(JSON.stringify(S.needs));
  const ex = bs.find(b => b.name.toLowerCase() === name.toLowerCase());
  if (ex) Object.assign(ex, { needs: snapshot, savedAt: Date.now() });
  else bs.unshift({ id: Date.now().toString(36), name, savedAt: Date.now(), needs: snapshot });
  setBaskets(bs);
  S.basketName = name;
  toast(t("basketSaved")(name));
  renderBaskets();
});
$("#emptyBasket").addEventListener("click", () => {
  if (!S.needs.length || !confirm(t("confirmEmpty"))) return;
  S.needs = [];
  S.basketName = null;
  PLAN.result = null;
  needsChanged();
  renderCompare();
});
$("#savedBaskets").addEventListener("click", e => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  const b = getBaskets().find(x => x.id === e.target.closest(".basket")?.dataset.id);
  if (!act || !b) return;
  if (act === "del") {
    if (!confirm(t("confirmDelBasket")(b.name))) return;
    setBaskets(getBaskets().filter(x => x.id !== b.id));
    renderBaskets();
    return;
  }
  // load: replaces the current list (the saved basket itself is untouched)
  if (S.needs.length && !confirm(t("replaceList")(b.name))) return;
  S.needs = JSON.parse(JSON.stringify(b.needs));
  S.basketName = b.name;
  PLAN.result = null;
  needsChanged();
  renderCompare();
  toast(t("basketLoaded")(b.name));
  runPlan(); // saved store searches make this quick
});
$("#planBtn").addEventListener("click", () => runPlan());
$("#thresholdIn").addEventListener("change", () => {
  S.settings.threshold = Math.max(0, parseFloat($("#thresholdIn").value) || 0);
  store.set("settings", S.settings);
  if (PLAN.result) PLAN.result = { ...PLAN.result, ...optimize(PLAN.result.rows, PLAN.result.stores) };
  renderPlan();
});
$("#maxStoresSel").addEventListener("change", () => {
  S.settings.maxStores = parseInt($("#maxStoresSel").value, 10);
  store.set("settings", S.settings);
  if (PLAN.result) PLAN.result = { ...PLAN.result, ...optimize(PLAN.result.rows, PLAN.result.stores) };
  renderPlan();
});
$("#planOut").addEventListener("change", e => {
  const sel = e.target.closest("select.pick");
  const n = sel && S.needs.find(x => x.id === sel.dataset.need);
  if (!n) return;
  n.pick = { ...(n.pick || {}), [sel.dataset.store]: sel.value };
  saveNeeds();
  recompute();
});
$("#planOut").addEventListener("click", async e => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "replan") runPlan();
  if (act === "refresh") runPlan({ refresh: true });
  if (act === "usesub" || act === "undosub") {
    const b = e.target.closest("[data-act]");
    const n = S.needs.find(x => x.id === b.dataset.need);
    if (!n) return;
    n.pick = { ...(n.pick || {}) };
    // accepting one substitute switches the whole item to "use substitutes" (all stores);
    // Annuler switches it back to the chosen product everywhere
    if (act === "usesub") { n.pick[b.dataset.store] = b.dataset.id; n.subsOn = true; }
    else {
      // back to the chosen product everywhere: drop every substitute pick for this item
      // (a manual pick of the same product in another size stays)
      const row = PLAN.result?.rows.find(r => r.need.id === n.id);
      for (const [s, p] of Object.entries(row?.picks || {})) if (p.sub) delete n.pick[s];
      delete n.pick[b.dataset.store];
      delete n.subsOn;
    }
    saveNeeds();
    recompute();
    renderList(); // the list row shows "substitutes in use"
  }
  if (act === "copy" && PLAN.result?.rec) {
    const R = PLAN.result;
    const txt = R.rec.set.map(k => `${storeName(k)}\n` + R.rows.map((r, i) => [r, R.rec.assign[i]])
      .filter(([, a]) => a && a.store === k)
      .map(([r, a]) => `  ☐ ${r.need.qty} × ${needLabel(r.need)} — ${needText(a.item)}${a.item.size ? " (" + a.item.size + ")" : ""} ${money(a.cost)}`).join("\n")
      + ((bp) => bp ? `\n  🎁 ${bp.text}` : "")(basketPoints(k, R.rows.map((r, i) => [r, R.rec.assign[i]]).filter(([, a]) => a && a.store === k))))
      .join("\n\n") + `\n\n${t("total")} ${money(R.rec.total)}`;
    try { await navigator.clipboard.writeText(txt); toast(t("copied")); } catch { /* clipboard blocked */ }
  }
});

// ---------- flyers ----------
// Browse: the list of this week's flyers (shelf), then every deal in the selected one.
// Search: flyer deals matching the current query, shown when no flyer is open.
const FL = { list: null, sel: null, items: {} };   // list: {status, flyers, key}; items: id -> {status, items}

const dateFmt = () => new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
const flyerLabel = f => f.store ? storeName(f.store) : f.merchant;
const flyerName = f => (f.name || "").replace(/\s*-\s*(valid|en vigueur).*$/i, "");
const flyerColor = store => (STORES[store] || FLYER_ONLY[store])?.color || "var(--s-other)";

function flyerVisible(f) {
  return !$("#myStoresOnly").checked || (f.store && (S.enabled.has(f.store) || FLYER_ONLY[f.store]));
}

async function loadFlyerList() {
  const key = `${S.lang}|${S.settings.postal}`;
  if (FL.list && FL.list.key === key) { renderShelf(); return; }
  FL.list = { status: "loading", flyers: [], key };
  FL.sel = null;
  renderShelf();
  try {
    const p = new URLSearchParams({ lang: S.lang, postal: S.settings.postal });
    const r = await fetch(`/api/flyers/list?${p}`);
    const d = await r.json();
    if (FL.list.key !== key) return;
    FL.list = r.ok ? { status: "ok", flyers: d.flyers, key } : { status: "error", flyers: [], error: d.error, key };
  } catch (e) {
    if (FL.list.key === key) FL.list = { status: "error", flyers: [], error: String(e), key };
  }
  // with nothing searched, open the first flyer so there is something to browse right away
  if (!S.query && !FL.sel) {
    const first = FL.list.flyers.find(flyerVisible);
    if (first) { selectFlyer(first.id); return; }
  }
  renderShelf();
}

function renderShelf() {
  const L = FL.list;
  const el = $("#flyerShelf");
  if (!L || L.status === "loading") { el.innerHTML = `<p class="note"><span class="spinner"></span> ${t("loading")}</p>`; renderFlyerView(); return; }
  if (L.status === "error") { el.innerHTML = `<p class="note">${t("flyerErr")} — ${esc(L.error)}</p>`; renderFlyerView(); return; }
  const fl = L.flyers.filter(flyerVisible);
  $("#flyerCount").textContent = t("flyerN")(fl.length);
  const now = Date.now(), df = dateFmt();
  el.innerHTML = fl.map(f => {
    const upcoming = new Date(f.valid_from).getTime() > now;
    return `<button class="flyer${FL.sel === f.id ? " is-sel" : ""}" type="button" data-id="${f.id}" style="--c:${flyerColor(f.store)}">
      <img class="flyer__thumb" src="${esc(f.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span class="flyer__body">
        <span class="badge badge--${f.store || "other"}" style="--c:${flyerColor(f.store)}">${esc(flyerLabel(f))}</span>
        <span class="flyer__name">${esc(flyerName(f))}</span>
        <span class="flyer__valid">${upcoming ? `<b>${t("upcoming")}</b> ` : ""}${df.format(new Date(f.valid_from))} – ${df.format(new Date(f.valid_to))}</span>
      </span>
    </button>`;
  }).join("") || `<p class="note">${t("flyerNone")}</p>`;
  renderFlyerView();
}

async function selectFlyer(id) {
  FL.sel = FL.sel === id ? null : id;
  $("#flyerFilter").value = "";
  renderShelf();
  if (!FL.sel || (FL.items[id] && FL.items[id].status === "ok")) return;
  FL.items[id] = { status: "loading", items: [] };
  renderFlyerView();
  try {
    const r = await fetch(`/api/flyers/${id}?lang=${S.lang}`);
    const d = await r.json();
    FL.items[id] = r.ok ? { status: "ok", items: d.items } : { status: "error", items: [], error: d.error };
  } catch (e) {
    FL.items[id] = { status: "error", items: [], error: String(e) };
  }
  if (FL.sel === id) renderFlyerView();
}

// "LAIT NATREL FINEMENT FILTRÉ 0%, 1%, 2%, 3.25%" -> "Lait natrel finement filtré 0%"
function flyerNeed(it) {
  let q = (it.name || "").split(",")[0].trim();
  if (q === q.toUpperCase()) q = q.charAt(0) + q.slice(1).toLowerCase();
  return q;
}

function renderFlyerView() {
  const f = FL.sel && FL.list?.flyers.find(x => x.id === FL.sel);
  $("#flyerView").hidden = !f;
  if (!f) { renderFlyerSearch(); return; }
  $("#flyerSearch").hidden = true;
  const df = dateFmt();
  $("#flyerTitle").innerHTML = `<span class="badge badge--${f.store || "other"}" style="--c:${flyerColor(f.store)}">${esc(flyerLabel(f))}</span> ${esc(flyerName(f))}`;
  $("#flyerValid").textContent = `${df.format(new Date(f.valid_from))} – ${df.format(new Date(f.valid_to))}`;
  const el = $("#flyerItems");
  const st = FL.items[f.id];
  if (!st || st.status === "loading") { el.innerHTML = `<li class="note"><span class="spinner"></span> ${t("loading")}</li>`; $("#flyerItemCount").textContent = ""; return; }
  if (st.status === "error") { el.innerHTML = `<li class="note">${t("flyerErr")} — ${esc(st.error)}</li>`; return; }

  const toks = tokens($("#flyerFilter").value);
  let items = st.items.filter(it => !toks.length || isMatch(it, toks));
  const sort = $("#flyerSort").value;
  if (sort === "price") items = [...items].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  if (sort === "discount") items = [...items].sort((a, b) => (b.discount || 0) - (a.discount || 0));
  $("#flyerItemCount").textContent = t("results")(items.length);

  let lastPage = null;
  el.innerHTML = items.map(it => {
    let head = "";
    if (sort === "page" && it.page != null && it.page !== lastPage) {
      lastPage = it.page;
      head = `<li class="pagehead">${t("page")} ${it.page}</li>`;
    }
    const canAdd = !!it.name;
    const need = canAdd && S.needs.find(n => keyOf(n) === needKey(flyerNeed(it)));
    return head + `<li class="fcard" data-id="${it.id}">
      <img class="fcard__img" src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <div class="fcard__body">
        <div class="fcard__name">${esc(it.name)}</div>
        ${it.brand ? `<div class="fcard__brand">${esc(it.brand)}</div>` : ""}
        <div class="fcard__foot">
          <span>${it.discount ? `<span class="badge badge--sale">−${it.discount}%</span>` : ""}</span>
          <span class="fcard__right">
            ${it.price != null ? `<span class="price is-sale">${money(it.price)}</span>` : ""}
            ${!canAdd ? "" : need
              ? `<span class="qty qty--sm"><button data-act="dec" type="button" aria-label="-">−</button><span>${need.qty}</span><button data-act="inc" type="button" aria-label="+">+</button></span>`
              : `<button class="add-btn" type="button" aria-label="+">+</button>`}
          </span>
        </div>
      </div>
    </li>`;
  }).join("") || `<li class="note">${t("none")}</li>`;
}

async function loadFlyers() {
  loadFlyerList();
  if (!S.query) { renderFlyerSearch(); return; }
  const key = `${S.query}|${S.lang}|${S.settings.postal}`;
  if (S.flyers && S.flyers.key === key) { renderFlyerSearch(); return; }
  S.flyers = { status: "loading", items: [], key };
  renderFlyerSearch();
  try {
    const p = new URLSearchParams({ q: S.query, lang: S.lang, postal: S.settings.postal });
    const r = await fetch(`/api/flyers?${p}`);
    const d = await r.json();
    if (S.flyers.key !== key) return;
    S.flyers = r.ok ? { status: "ok", items: d.items, key } : { status: "error", items: [], error: d.error, key };
  } catch (e) {
    if (S.flyers.key === key) S.flyers = { status: "error", items: [], error: String(e), key };
  }
  renderFlyerSearch();
}
const renderFlyers = () => { if (FL.list) renderShelf(); };

function renderFlyerSearch() {
  const f = S.flyers;
  const el = $("#flyers");
  $("#flyerSearch").hidden = !!FL.sel || !S.query;
  if (!S.query || !f) { el.innerHTML = ""; return; }
  $("#flyerSearchTitle").textContent = t("dealsFor")(S.query);
  if (f.status === "loading") { el.innerHTML = `<li class="note"><span class="spinner"></span> ${t("loading")}</li>`; return; }
  if (f.status === "error") { el.innerHTML = `<li class="note">${t("flyerErr")} — ${esc(f.error)}</li>`; return; }
  const mine = $("#myStoresOnly").checked;
  const items = f.items.filter(it => !mine || (it.store && (S.enabled.has(it.store) || FLYER_ONLY[it.store])));
  $("#flyerSearchTitle").textContent = `${t("dealsFor")(S.query)} · ${t("results")(items.length)}`;
  if (!items.length) {
    const others = f.items.length;
    el.innerHTML = `<li class="note">${t("flyerNone")}${mine && others ? " " + t("flyerOthers")(others) : ""}</li>`;
    return;
  }
  const df = dateFmt();
  el.innerHTML = items.map(it => {
    const label = it.store ? storeName(it.store) : it.merchant;
    const price = it.price != null
      ? `<div class="price is-sale">${it.pre ? `<small>${esc(it.pre)}</small> ` : ""}${money(it.price)}${it.post ? ` <small>${esc(it.post)}</small>` : ""}</div>`
      : "";
    const until = it.valid_to ? t("until")(df.format(new Date(it.valid_to))) : "";
    return `<li class="fcard">
      <a href="${esc(it.url)}" target="_blank" rel="noopener"><img class="fcard__img" src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>
      <div class="fcard__body">
        <span><span class="badge badge--${it.store || "other"}" style="--c:${flyerColor(it.store)}">${esc(label)}</span></span>
        <div class="fcard__name">${esc(it.name)}</div>
        ${it.story ? `<div class="fcard__story">${esc(it.story)}</div>` : ""}
        <div class="fcard__foot">
          <span class="fcard__valid">${esc(until)}</span>
          <span>${price}${it.regular && it.regular > it.price ? `<div class="was">${money(it.regular)}</div>` : ""}</span>
        </div>
      </div>
    </li>`;
  }).join("");
}

$("#flyerShelf").addEventListener("click", e => {
  const b = e.target.closest(".flyer");
  if (b) selectFlyer(Number(b.dataset.id));
});
$("#flyerItems").addEventListener("click", e => {
  const card = e.target.closest(".fcard");
  if (!card) return;
  const it = FL.items[FL.sel]?.items.find(i => String(i.id) === card.dataset.id);
  if (!it) return;
  if (e.target.closest(".add-btn")) { toggleNeed(flyerNeed(it)); renderFlyerView(); return; }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  const need = S.needs.find(n => keyOf(n) === needKey(flyerNeed(it)));
  if (!need) return;
  if (act === "inc") need.qty++;
  else if (--need.qty < 1) { S.needs.splice(S.needs.indexOf(need), 1); toast(t("removed")); }
  needsChanged();
  renderFlyerView();
});
$("#flyerFilter").addEventListener("input", renderFlyerView);
$("#flyerSort").addEventListener("change", renderFlyerView);
$("#myStoresOnly").addEventListener("change", () => { renderShelf(); renderFlyerSearch(); });

// ---------- tabs ----------
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
  ["compare", "flyers", "list"].forEach(p => $(`#panel-${p}`).hidden = p !== tab);
  if (tab === "flyers") loadFlyers();
  if (tab === "list") renderList();
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

// ---------- language ----------
$("#langBtn").addEventListener("click", () => {
  S.lang = S.lang === "fr" ? "en" : "fr";
  store.set("lang", S.lang);
  applyLang();
  if (PLAN.result) PLAN.stale = true;
  renderList();
  if (S.query) runSearch(S.query, { push: false }); else renderCompare();
  if (S.tab === "flyers") loadFlyers();
});

// ---------- settings ----------
let pcStoresLoaded = false;
async function loadPcStores() {
  if (pcStoresLoaded) return;
  for (const k of ["maxi"]) {
    try {
      const d = await (await fetch(`/api/pc-stores/${k}`)).json();
      const sel = $(`#${k}StoreSel`);
      const cur = S.settings[k] || d.default;
      sel.innerHTML = d.stores.map(s =>
        `<option value="${esc(s.id)}"${s.id === cur ? " selected" : ""}>${esc(s.town || "")} — ${esc(s.name)}</option>`).join("");
      pcStoresLoaded = true;
    } catch { /* keep placeholder */ }
  }
}
function renderExpiry() {
  const label = h => h < 24 ? `${h} h` : t("days")(h / 24);
  $("#expiryGrid").innerHTML = ORDER.map(k => `<label class="expiry">
    <span><span class="dot" style="background:${STORES[k].color}"></span>${esc(storeName(k))}</span>
    <select data-store="${k}">${EXPIRY_CHOICES.map(h => `<option value="${h}"${h === (Number(S.settings.expiry?.[k]) || DEFAULT_EXPIRY_H) ? " selected" : ""}>${label(h)}</option>`).join("")}</select>
  </label>`).join("");
}
async function renderCrawlStatus() {
  const el = $("#crawlStatus");
  try {
    const d = await (await fetch("/api/crawl/status")).json();
    const df = new Intl.DateTimeFormat(S.lang === "fr" ? "fr-CA" : "en-CA", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const keys = [...ORDER, ...Object.keys(FLYER_ONLY)];
    const rows = keys.map(k => {
      const r = d.runs?.[k];
      const when = r ? df.format(new Date((r.finished_at || r.started_at) * 1000)) : t("crawlNever");
      const st = !r ? "" : r.status === "ok" ? "✓" : r.status === "running" ? "…" : r.status === "test" ? "~" : "⚠";
      return `<li><span><span class="dot" style="background:${flyerColor(k)}"></span>${esc(storeName(k))}</span>
        <span class="crawl__when" title="${esc(r?.note || "")}">${st} ${esc(when)}${r?.products ? ` · ${r.products.toLocaleString()} ${t("crawlProducts")}` : ""}</span></li>`;
    }).join("");
    el.innerHTML = `<ul class="crawl">${rows}</ul><p class="note">${esc(t("crawlNote")(d.stats?.products?.toLocaleString() || "0"))}</p>`;
  } catch {
    el.innerHTML = `<p class="note">—</p>`;
  }
}
$("#settingsBtn").addEventListener("click", () => {
  renderExpiry();
  renderCrawlStatus();
  $("#postalIn").value = S.settings.postal;
  $("#settingsDlg").showModal();
  loadPcStores();
});
$("#postalLink").addEventListener("click", () => $("#settingsBtn").click());
$("#settingsDlg").addEventListener("close", () => {
  if ($("#settingsDlg").returnValue !== "save") return;
  const before = JSON.stringify(S.settings);
  const postal = $("#postalIn").value.toUpperCase().replace(/\s/g, "");
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)) S.settings.postal = postal.slice(0, 3) + " " + postal.slice(3);
  else if (postal) toast(t("invalidPostal"));
  if (pcStoresLoaded) {
    S.settings.maxi = $("#maxiStoreSel").value;
  }
  S.settings.expiry = Object.fromEntries([...document.querySelectorAll("#expiryGrid select")].map(sel => [sel.dataset.store, Number(sel.value)]));
  store.set("settings", S.settings);
  $("#postalLink").textContent = S.settings.postal;
  if (PLAN.result && before !== JSON.stringify(S.settings)) { PLAN.stale = true; renderPlan(); }
  if (before !== JSON.stringify(S.settings) && S.query) runSearch(S.query, { push: false });
  if (S.tab === "flyers") loadFlyers();
});

// ---------- barcode scanner ----------
const scan = { stream: null, timer: null, reader: null, busy: false };
function scanStatus(msg) { $("#scanStatus").textContent = msg; }

async function openScanner() {
  $("#scanDlg").showModal();
  $("#scanCode").value = "";
  scan.busy = false;
  scanStatus(t("scanStarting"));
  const video = $("#scanVideo");
  if (!navigator.mediaDevices?.getUserMedia) { scanStatus(t("scanNoCam")); return; }
  try {
    if ("BarcodeDetector" in window) {
      const formats = (await BarcodeDetector.getSupportedFormats?.()) || [];
      const want = ["ean_13", "ean_8", "upc_a", "upc_e"].filter(f => formats.includes(f));
      if (want.length) {
        const det = new BarcodeDetector({ formats: want });
        scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = scan.stream;
        await video.play();
        scanStatus(t("scanAim"));
        scan.timer = setInterval(async () => {
          if (scan.busy || video.readyState < 2) return;
          try { const codes = await det.detect(video); if (codes[0]) onCode(codes[0].rawValue); } catch { /* frame not ready */ }
        }, 200);
        return;
      }
    }
    // Fallback: ZXing (desktop Chrome/Edge on Windows have no BarcodeDetector)
    if (!window.ZXing) await loadScript("https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js");
    scan.reader = new ZXing.BrowserMultiFormatReader();
    scanStatus(t("scanAim"));
    await scan.reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video, res => { if (res) onCode(res.getText()); });
  } catch (e) {
    scanStatus(t("scanNoCam"));
  }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function stopScanner() {
  clearInterval(scan.timer);
  scan.timer = null;
  try { scan.reader?.reset(); } catch { /* already stopped */ }
  scan.reader = null;
  scan.stream?.getTracks().forEach(tr => tr.stop());
  scan.stream = null;
  $("#scanVideo").srcObject = null;
}

async function onCode(code) {
  code = String(code).replace(/\D/g, "");
  if (scan.busy || code.length < 6) return;
  scan.busy = true;
  navigator.vibrate?.(60);
  stopScanner();
  scanStatus(`${code} — ${t("scanLooking")}`);
  let q = code;
  try {
    const d = await (await fetch(`/api/barcode/${code}?lang=${S.lang}`)).json();
    if (d.found && d.query) { q = d.query; toast(t("scanFound")(d.query)); }
    else toast(t("scanUnknown"));
  } catch { toast(t("scanUnknown")); }
  $("#scanDlg").close();
  setTab("compare");
  runSearch(q);
}

$("#scanBtn").addEventListener("click", openScanner);
$("#scanClose").addEventListener("click", () => $("#scanDlg").close());
$("#scanDlg").addEventListener("close", stopScanner);
$("#scanManual").addEventListener("submit", e => { e.preventDefault(); onCode($("#scanCode").value); });

// ---------- image lightbox ----------
const ZOOMABLE_IMG = "img.need__img, img.fcard__img, .litem > img, .pcard img";   // (row pictures open the product popup)
document.addEventListener("click", e => {
  const img = e.target.closest("img");
  if (!img || !img.src || img.closest("a") || !img.matches(ZOOMABLE_IMG)) return;
  const lb = $("#lightboxImg"), big = bigImg(img.src);
  lb.onerror = () => { lb.onerror = null; lb.src = img.src; };   // no bigger version on that server: show what we have
  lb.src = big;
  lb.alt = img.alt || "";
  $("#lightboxDlg").showModal();
});
$("#lightboxClose").addEventListener("click", () => $("#lightboxDlg").close());
$("#lightboxDlg").addEventListener("click", e => { if (e.target === $("#lightboxDlg") || e.target === $("#lightboxImg")) $("#lightboxDlg").close(); });

// ---------- boot ----------
// ?testlist restores the saved test list (data/test-list.json) into this browser, then reloads clean
if (new URL(location.href).searchParams.has("testlist")) {
  fetch("/api/test-list").then(r => r.json()).then(d => {
    if (d.needs) {
      store.set("needs", d.needs);
      if (d.settings) store.set("settings", d.settings);
      if (d.storesOff) store.set("storesOff", d.storesOff);
    }
    location.replace("/#list");
  });
}
if (location.hash === "#list") setTimeout(() => setTab("list"));
applyLang();
saveNeeds();
renderList();
restorePlan();
setTimeout(pruneSaved, 5000);
const initial = new URL(location.href).searchParams.get("q");
if (initial) runSearch(initial, { push: false }); else renderCompare();
