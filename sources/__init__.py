from . import gianttiger, iga, metro, pc, walmart

# key -> search(q, lang, opts) -> list[item]
STORES = {
    "iga": iga.search,
    "metro": metro.search_metro,
    "superc": metro.search_superc,
    "maxi": pc.search_maxi,
    # "loblaws": pc.search_loblaws,  # disabled: no Québec stores (API code kept in pc.py)
    "gianttiger": gianttiger.search,
    "walmart": walmart.search,
}
