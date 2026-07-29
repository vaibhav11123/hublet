import requests
import time
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from schema import validate_listings
from parsers.magicbricks_direct import get_magicbricks_listings

APIFY_BASE_URL = "https://api.apify.com/v2"
DEFAULT_ACTOR_ID = "ecomscrape~magicbricks-property-search-scraper"

# Map city names to MagicBricks search URL format
CITY_URL_MAP = {
    "mumbai": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=Mumbai",
    "new-delhi": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=New-Delhi",
    "delhi": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=New-Delhi",
    "hyderabad": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=Hyderabad",
    "bangalore": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=Bangalore",
    "chennai": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=Chennai",
    "pune": "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=Pune",
}


def get_apify_listings(city, limit=10, token=None):
    """
    Fetches property listings from MagicBricks via the Apify actor API.
    Returns a list of dicts matching the ScrapedProperty interface.

    Args:
        city: City name (e.g. 'mumbai', 'new-delhi')
        limit: Max number of listings to return
        token: Apify API token (reads from APIFY_TOKEN env var if not provided)
    """
    import sys as _sys

    token = token or os.environ.get("APIFY_TOKEN")
    if not token:
        print(f"[magicbricks-apify] No APIFY_TOKEN, falling back to direct scraper", file=_sys.stderr)
        return get_magicbricks_listings(city, limit)

    # Build the MagicBricks search URL for this city
    search_url = CITY_URL_MAP.get(city.lower())
    if not search_url:
        # Fallback: construct a generic URL
        formatted_city = city.replace(" ", "-").title()
        search_url = f"https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName={formatted_city}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    actor_ids = _resolve_actor_ids()
    print(f"[magicbricks-apify] Trying actors: {actor_ids}", file=_sys.stderr)

    # 1. Start the actor run
    run_input = {
        "urls": [search_url],
        "max_items_per_url": limit,
        "max_retries_per_url": 2,
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
            "apifyProxyCountry": "IN",
        },
    }

    run_id = None
    dataset_id = None
    last_error = None

    for actor_id in actor_ids:
        run_url = f"{APIFY_BASE_URL}/acts/{actor_id}/runs"
        try:
            run_resp = requests.post(run_url, headers=headers, json=run_input, timeout=30)
        except Exception as e:
            print(f"[magicbricks-apify] Actor '{actor_id}' request failed: {e}", file=_sys.stderr)
            last_error = e
            continue

        if run_resp.status_code in (401, 403, 404):
            print(f"[magicbricks-apify] Actor '{actor_id}' unavailable (HTTP {run_resp.status_code})", file=_sys.stderr)
            last_error = RuntimeError(
                f"Actor '{actor_id}' unavailable for this token (HTTP {run_resp.status_code})"
            )
            continue

        run_resp.raise_for_status()
        run_data = run_resp.json()["data"]
        run_id = run_data["id"]
        dataset_id = run_data["defaultDatasetId"]
        print(f"[magicbricks-apify] Actor '{actor_id}' started, run_id={run_id}", file=_sys.stderr)
        break

    if not run_id or not dataset_id:
        # Keep service functional even when actor permissions are restricted.
        print(f"[magicbricks-apify] No actor available, falling back to direct scraper", file=_sys.stderr)
        return get_magicbricks_listings(city, limit)

    # 2. Poll for completion (max ~5 minutes)
    status_url = f"{APIFY_BASE_URL}/actor-runs/{run_id}"
    max_wait = 300  # seconds
    poll_interval = 5
    elapsed = 0

    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval

        status_resp = requests.get(status_url, headers=headers, timeout=15)
        status_resp.raise_for_status()
        status = status_resp.json()["data"]["status"]
        print(f"[magicbricks-apify] Poll ({elapsed}s): status={status}", file=_sys.stderr)

        if status in ("SUCCEEDED", "FINISHED"):
            break
        elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
            print(f"[magicbricks-apify] Actor run failed ({status}), falling back to direct", file=_sys.stderr)
            return get_magicbricks_listings(city, limit)

    if elapsed >= max_wait:
        print(f"[magicbricks-apify] Actor run timed out, falling back to direct", file=_sys.stderr)
        return get_magicbricks_listings(city, limit)

    # 3. Fetch dataset items
    items_url = f"{APIFY_BASE_URL}/datasets/{dataset_id}/items?format=json&limit={limit}"
    items_resp = requests.get(items_url, headers=headers, timeout=30)
    items_resp.raise_for_status()
    raw_items = items_resp.json()

    print(f"[magicbricks-apify] Apify returned {len(raw_items)} raw items", file=_sys.stderr)

    # 4. Map Apify output to our ScrapedProperty format
    properties = []
    for item in raw_items:
        try:
            prop = _map_apify_item(item, city)
            properties.append(prop)
        except Exception:
            continue

    # If Apify returned 0 usable items, fallback to direct scraping
    if not properties:
        print(f"[magicbricks-apify] 0 usable items from Apify, falling back to direct scraper", file=_sys.stderr)
        return get_magicbricks_listings(city, limit)

    return validate_listings(properties)


def _resolve_actor_ids():
    """Resolve actor candidates from env with sane default and no duplicates."""
    ids = []

    explicit = os.environ.get("APIFY_MAGICBRICKS_ACTOR_ID", "").strip()
    if explicit:
        ids.append(explicit)

    csv_ids = os.environ.get("APIFY_MAGICBRICKS_ACTOR_IDS", "").strip()
    if csv_ids:
        ids.extend([item.strip() for item in csv_ids.split(",") if item.strip()])

    ids.append(DEFAULT_ACTOR_ID)
    return list(dict.fromkeys(ids))


def _map_apify_item(item, city):
    """
    Maps a single Apify result item to the ScrapedProperty dict format
    expected by the TypeScript service.
    """
    # Price: Apify gives us numeric price directly
    price = 0
    if item.get("price"):
        try:
            price = int(float(item["price"]))
        except (ValueError, TypeError):
            price = 0

    # Area: prefer covered_area, fallback to carpet_area
    area = 0
    for field in ("covered_area", "carpet_area"):
        if item.get(field):
            try:
                area = int(float(item[field]))
                break
            except (ValueError, TypeError):
                pass

    # Locality from address or city_name
    address = item.get("address", "")
    locality = address if address else item.get("city_name", city)

    # BHK / bedrooms
    bhk = 0
    if item.get("bedrooms"):
        try:
            bhk = int(item["bedrooms"])
        except (ValueError, TypeError):
            bhk = 0

    # Amenities
    amenities_raw = item.get("amenities", "")
    if isinstance(amenities_raw, str) and amenities_raw:
        amenities = [a.strip() for a in amenities_raw.split(",") if a.strip()]
    elif isinstance(amenities_raw, list):
        amenities = amenities_raw
    else:
        amenities = ["Office Space"]

    if not amenities:
        amenities = ["Office Space"]

    # Description
    description = item.get("description", "") or item.get("seo_description", "") or f"Property in {locality}"

    # Seller info
    seller_name = item.get("owner_name", "") or item.get("company_name", "") or "Unknown"
    seller_type = "Owner" if item.get("owner_name") else "Agent"

    # URL
    source_url = item.get("url", "")
    if source_url and not source_url.startswith("http"):
        source_url = f"https://www.magicbricks.com/{source_url}"

    # External ID
    external_id = str(item.get("id", ""))

    return {
        "title": item.get("name", "Property Listing"),
        "price": price,
        "area": area,
        "locality": locality,
        "city": item.get("city_name", city),
        "description": description,
        "sourceUrl": source_url,
        "externalId": external_id,
        "source": "MagicBricks-Apify",
        "bhk": bhk,
        "amenities": amenities,
        "propertyType": "commercial",
        "sellerName": seller_name,
        "sellerType": seller_type,
        # Extra fields from Apify (not in direct scraper)
        "ownerName": item.get("owner_name", ""),
        "companyName": item.get("company_name", ""),
        "imageUrl": item.get("image_url", ""),
        "landmark": item.get("landmark", ""),
        "postedDate": item.get("posted_date", ""),
    }


if __name__ == "__main__":
    import json
    import sys

    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("Set APIFY_TOKEN environment variable first", file=sys.stderr)
        sys.exit(1)

    results = get_apify_listings("mumbai", limit=3, token=token)
    print(json.dumps(results, indent=2))
