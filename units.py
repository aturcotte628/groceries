"""Price / size parsing and unit-price normalization.

Every unit price is expressed per 100 g, per 100 mL, or per 1 unit ("ea"),
so items from different stores can be compared directly.
"""
import re

_NUM = r"(\d+(?:[.,]\d+)?)"

# unit word -> (dimension, multiplier to base unit g / ml / ea)
_UNITS = {
    "kg": ("g", 1000), "kilo": ("g", 1000), "kilos": ("g", 1000), "kilogramme": ("g", 1000), "kilogrammes": ("g", 1000),
    "g": ("g", 1), "gr": ("g", 1), "gram": ("g", 1), "grams": ("g", 1), "gramme": ("g", 1), "grammes": ("g", 1),
    "mg": ("g", 0.001),
    "lb": ("g", 453.592), "lbs": ("g", 453.592), "livre": ("g", 453.592), "livres": ("g", 453.592),
    "oz": ("g", 28.3495),
    "l": ("ml", 1000), "litre": ("ml", 1000), "litres": ("ml", 1000), "liter": ("ml", 1000), "liters": ("ml", 1000),
    "ml": ("ml", 1), "millilitre": ("ml", 1), "millilitres": ("ml", 1),
    "cl": ("ml", 10), "dl": ("ml", 100),
    "fl oz": ("ml", 29.5735), "floz": ("ml", 29.5735),
    "un": ("ea", 1), "unit": ("ea", 1), "units": ("ea", 1), "unité": ("ea", 1), "unités": ("ea", 1),
    "unite": ("ea", 1), "unites": ("ea", 1), "ea": ("ea", 1), "each": ("ea", 1), "ch": ("ea", 1),
    "ct": ("ea", 1), "count": ("ea", 1), "pk": ("ea", 1), "pack": ("ea", 1), "pcs": ("ea", 1), "pc": ("ea", 1),
    "sachets": ("ea", 1), "bags": ("ea", 1), "rolls": ("ea", 1), "rouleaux": ("ea", 1),
}
_UNIT_RE = "|".join(sorted((re.escape(u) for u in _UNITS), key=len, reverse=True))

# "4 x 100 g", "6x355 mL", "12 X 1 L"
_MULTI = re.compile(rf"(\d+)\s*[x×]\s*{_NUM}\s*({_UNIT_RE})\b", re.I)
# "454 g", "2L", "1,36 kg"
_SINGLE = re.compile(rf"{_NUM}\s*-?\s*({_UNIT_RE})\b", re.I)
_DOZEN = re.compile(r"\b(dozen|douzaine)\b", re.I)


def _f(s):
    """Parse a number written with a decimal comma or point."""
    return float(s.replace(",", "."))


def parse_size(text):
    """Return (quantity_in_base_unit, dim) with dim in g|ml|ea, or None."""
    if not text:
        return None
    t = text.replace(" ", " ")
    m = _MULTI.search(t)
    if m:
        dim, mult = _UNITS[m.group(3).lower()]
        return int(m.group(1)) * _f(m.group(2)) * mult, dim
    # last match wins: names often read "Brand Thing 12 x ... 2L"
    matches = list(_SINGLE.finditer(t))
    for m in reversed(matches):
        dim, mult = _UNITS[m.group(2).lower()]
        q = _f(m.group(1)) * mult
        if q > 0:
            return q, dim
    if _DOZEN.search(t):
        return 12, "ea"
    return None


def parse_price(text):
    """'$6.78', '5,97 $', '39 ¢', '3 / $15.00' -> float (last price in text)."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    t = text.replace(" ", " ")
    cents = re.search(r"(\d+)\s*¢", t)
    if cents and "$" not in t:
        return int(cents.group(1)) / 100
    nums = re.findall(r"\d+(?:[.,]\d{1,2})?", t)
    return _f(nums[-1]) if nums else None


def normalize(value, qty, dim):
    """Price for qty base units -> price per 100 g / 100 mL / 1 ea."""
    if value is None or not qty:
        return None
    per = 100 if dim in ("g", "ml") else 1
    return {"value": round(value / qty * per, 4), "dim": dim}


def unit_from_size(price, size_text):
    """Unit price for a price and a size string like '2 x 500 g'; None if size or price is unknown."""
    s = parse_size(size_text)
    if not s or price is None:
        return None
    return normalize(price, s[0], s[1])


# "$0.25 /100 ml", "34¢/100ml", "$2.18 / kg", "0,99 $/100 g", "$0.99 / lb", "1,07 $ /100 g"
_UNIT_PRICE = re.compile(
    rf"(?:\$\s*{_NUM}|{_NUM}\s*\$|{_NUM}\s*¢)\s*/\s*(\d+(?:[.,]\d+)?)?\s*({_UNIT_RE})\b", re.I)


def unit_from_text(text):
    """Parse a store's own unit-price text (e.g. '1,25 $/100 g') into a normalised unit price."""
    if not text:
        return None
    m = _UNIT_PRICE.search(text.replace(" ", " "))
    if not m:
        return None
    if m.group(1) or m.group(2):
        value = _f(m.group(1) or m.group(2))
    else:
        value = int(_f(m.group(3))) / 100
    qty = _f(m.group(4)) if m.group(4) else 1
    dim, mult = _UNITS[m.group(5).lower()]
    return normalize(value, qty * mult, dim)


def unit_from_comparison(value, qty, unit):
    """Structured comparison price, e.g. (0.99, 100, 'g')."""
    u = _UNITS.get((unit or "").lower())
    if value is None or not u:
        return None
    return normalize(value, (qty or 1) * u[1], u[0])
