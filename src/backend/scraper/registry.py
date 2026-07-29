"""
Scraper registry — maps scraper names to their fetch functions.
Each scraper function has signature: (city: str, limit: int, **kwargs) -> list[dict]
"""

from parsers.magicbricks_direct import get_magicbricks_listings
from parsers.magicbricks_apify import get_apify_listings as get_magicbricks_apify_listings
from parsers.ninetyninacres_direct import get_99acres_listings
from parsers.ninetyninacres_apify import get_99acres_apify_listings
from parsers.ninetyninacres_zenrows import get_99acres_zenrows_listings

# Registry: name -> { "fn": callable, "needs_token": str|None, "description": str }
SCRAPERS = {
    "magicbricks-direct": {
        "fn": get_magicbricks_listings,
        "needs_token": None,
        "description": "MagicBricks — direct HTML scraping (free, no API key needed)",
    },
    "magicbricks-apify": {
        "fn": get_magicbricks_apify_listings,
        "needs_token": "apify",
        "description": "MagicBricks — via Apify actor API (needs APIFY_TOKEN)",
    },
    "99acres-direct": {
        "fn": get_99acres_listings,
        "needs_token": None,
        "description": "99acres — direct HTML scraping (free, no API key needed)",
    },
    "99acres-apify": {
        "fn": get_99acres_apify_listings,
        "needs_token": "apify",
        "description": "99acres — via Apify actor API (needs APIFY_TOKEN)",
    },
    "99acres-zenrows": {
        "fn": get_99acres_zenrows_listings,
        "needs_token": "zenrows",
        "description": "99acres — via ZenRows API + HTML parsing (needs ZENROWS_API_KEY)",
    },
}


def list_scrapers() -> list:
    """Return list of available scraper names and descriptions."""
    return [
        {"name": name, "description": info["description"], "needs_token": info["needs_token"]}
        for name, info in SCRAPERS.items()
    ]


def get_scraper(name: str):
    """Get a scraper entry by name. Returns None if not found."""
    return SCRAPERS.get(name)


def get_scraper_names() -> list:
    """Return just the scraper names."""
    return list(SCRAPERS.keys())
