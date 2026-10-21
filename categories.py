"""One shared set of grocery categories across stores.

Every store has its own category names and depth ("Fruits et légumes > Fruits > Baies et cerises"
at Metro, "Petits fruits" at IGA, "Fresh Produce" at Giant Tiger...). `classify()` maps any of them
to one of GROUPS by checking each level from the most specific to the most general, against rules
in priority order: "Petits fruits surgelés" is frozen food, "Jus de fruits" a drink, "Fruits de mer"
seafood, before anything counts as fruit.
"""
import re
import unicodedata

# key -> (French label, English label), in display order
GROUPS = {
    "fruits": ("Fruits et légumes", "Fruits & vegetables"),
    "laitiers": ("Produits laitiers et œufs", "Dairy & eggs"),
    "viandes": ("Viandes et volailles", "Meat & poultry"),
    "poissons": ("Poissons et fruits de mer", "Fish & seafood"),
    "charcuterie": ("Charcuterie et prêt-à-manger", "Deli & ready meals"),
    "boulangerie": ("Boulangerie", "Bakery"),
    "garde_manger": ("Garde-manger", "Pantry"),
    "collations": ("Collations et bonbons", "Snacks & candy"),
    "boissons": ("Boissons", "Drinks"),
    "surgeles": ("Surgelés", "Frozen"),
    "bebe": ("Bébé", "Baby"),
    "sante": ("Santé et beauté", "Health & beauty"),
    "maison": ("Maison et entretien", "Household"),
    "animaux": ("Animaux", "Pets"),
}

# (group, pattern) in priority order; patterns run on lowercase, accent-free text
_RULES = [
    ("surgeles", r"surgel|frozen|congel|creme glacee|ice cream|friandises glacees"),
    ("bebe", r"\bbebe|\bbaby|nourrisson|couche|diaper|prepar\w* pour nourrisson"),
    ("animaux", r"animaux|animal|\bpet\b|\bpets\b|chien|chat\b|chats\b|\bdog|\bcat\b"),
    ("sante", r"sante|beaute|health|beauty|pharmac|vitamin|supplement|soins|hygiene|cosmet|personal care"),
    ("maison", r"entretien|nettoy|menag|household|cleaning|lessive|laundry|papier|vaisselle|decoration|maison"),
    ("boissons", r"boisson|beverage|drink|\bjus\b|juice|\beau\b|\beaux\b|water|soda|gazeus|cafe|coffee|\bthe\b|\btea\b"
                 r"|biere|beer|\bvin\b|\bvins\b|wine|alcool|spiritueux|kombucha|lait vegetal|boissons vegetales"),
    ("collations", r"collation|snack|grignotine|croustille|chips|bonbon|candy|chocolat|confiserie|friandise"
                   r"|maïs souffle|mais souffle|popcorn|biscuit|cookie|craquelin|cracker|barre"),
    ("poissons", r"poisson|fruits de mer|seafood|\bfish|sushi|crevette|saumon|thon frais"),
    ("laitiers", r"laitier|dairy|\boeuf\b|\boeufs\b|\begg|fromage|cheese|yogourt|yogurt|yaourt|beurre|butter"
                 r"|creme\b|\bcream\b|\blait\b|\bmilk\b|margarine"),
    ("charcuterie", r"charcut|\bdeli\b|pret.a.manger|plats? prepares?|repas prepares?|prepared|traiteur|ready meal"
                    r"|saucisson|jambon tranche|viandes froides|cold cuts"),
    ("viandes", r"viande|\bmeat|volaille|poultry|poulet|chicken|boeuf|\bbeef|porc\b|\bpork|agneau|lamb|veau"
                r"|dinde|turkey|saucisse|sausage|bacon"),
    ("boulangerie", r"boulang|bakery|\bpain|\bbread|patisser|pastr|bagel|muffin|croissant|tortilla"),
    ("fruits", r"fruit|legume|vegetable|produce|salade|laitue|herbes fraiches|champignon|pomme de terre|potato"),
    ("garde_manger", r"garde.manger|pantry|epicerie|conserve|canned|pates|pasta|\briz\b|\brice\b|cereale|cereal"
                     r"|condiment|epice|spice|sauce|farine|flour|sucre|sugar|huile|\boil\b|vinaigre|confiture|\bjams?\b"
                     r"|tartinade|spread|soupe|soup|cuisson|baking|cuisine du monde|international|biologique|organic"
                     r"|vegetarien|vegan|vegetalien|naturel|sans gluten|gluten free|aliments"),
]
_RULES = [(g, re.compile(p)) for g, p in _RULES]
# generic levels that say nothing about the product
_SKIP = re.compile(r"^(allees|aisles|epicerie|grocery|alimentation|food|tous les produits|produits|epicerie en ligne)$")


def _norm(s):
    """Lower-case, strip accents, and fold punctuation so category names compare equal."""
    s = unicodedata.normalize("NFD", s.lower().replace("œ", "oe").replace("_", " "))
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def _match(level):
    """First shared group whose rule matches this store category level, or None."""
    return next((g for g, rx in _RULES if rx.search(level)), None)


def classify(category):
    """'Fruits et légumes > Fruits > Baies et cerises' (general > specific) -> 'fruits', or None.

    The store's top department decides ("Collations > Barres > Pâtisseries" is a snack), except
    when it's a catch-all ("Épicerie biologique", "Cuisine du monde": pantry-type) or when a
    deeper level says frozen ("Fruits et légumes > Fruits surgelés")."""
    if not category:
        return None
    levels = [_norm(x) for x in re.split(r"\s*>\s*|\|", category) if x.strip()]
    levels = [lv for lv in levels if not _SKIP.match(lv)]
    if not levels:
        return None
    deep = [_match(lv) for lv in reversed(levels[1:])]           # most specific first
    if "surgeles" in deep:
        return "surgeles"
    top = _match(levels[0])
    if top and top != "garde_manger":
        return top
    # catch-all or unknown top level: the most specific meaningful level decides
    return (next((g for g in deep if g and g != "garde_manger"), None) or top
            or next((g for g in deep if g), None))
