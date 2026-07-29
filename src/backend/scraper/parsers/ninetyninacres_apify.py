"""
99acres Apify scraper — uses the Apify actor API.
Actor: stealth_mode/99acres-property-search-scraper
Requires APIFY_TOKEN.
"""

import requests
import time
import os
import sys
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from schema import validate_listings

APIFY_BASE_URL = "https://api.apify.com/v2"
ACTOR_ID = "stealth_mode~99acres-property-search-scraper"

# Map city names to 99acres search URLs
CITY_URL_MAP = {
    "mumbai": "https://www.99acres.com/search/property/buy/mumbai?city=19&preference=S&area_unit=1&res_com=R",
    "new-delhi": "https://www.99acres.com/search/property/buy/new-delhi?city=9&preference=S&area_unit=1&res_com=R",
    "delhi": "https://www.99acres.com/search/property/buy/new-delhi?city=9&preference=S&area_unit=1&res_com=R",
    "hyderabad": "https://www.99acres.com/search/property/buy/hyderabad?city=23&preference=S&area_unit=1&res_com=R",
    "bangalore": "https://www.99acres.com/search/property/buy/bangalore?city=21&preference=S&area_unit=1&res_com=R",
    "chennai": "https://www.99acres.com/search/property/buy/chennai?city=10&preference=S&area_unit=1&res_com=R",
    "pune": "https://www.99acres.com/search/property/buy/pune?city=17&preference=S&area_unit=1&res_com=R",
}


def get_99acres_apify_listings(city, limit=10, token=None, **kwargs):
    """
    Fetches 99acres listings via the Apify actor API.
    Returns a list of schema-validated dicts.
    """
    token = token or os.environ.get("APIFY_TOKEN")
    if not token:
        raise ValueError("Apify API token is required. Set APIFY_TOKEN env var or pass --token.")

    search_url = CITY_URL_MAP.get(city.lower())
    if not search_url:
        formatted_city = city.lower().replace(" ", "-")
        search_url = f"https://www.99acres.com/search/property/buy/{formatted_city}?preference=S&area_unit=1&res_com=R"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Start actor run
    run_input = {
        "urls": [search_url],
        "max_items_per_url": limit,
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
            "apifyProxyCountry": "IN",
        },
    }

    run_url = f"{APIFY_BASE_URL}/acts/{ACTOR_ID}/runs"
    run_resp = requests.post(run_url, headers=headers, json=run_input, timeout=30, verify=False)
    run_resp.raise_for_status()
    run_data = run_resp.json()["data"]
    run_id = run_data["id"]
    dataset_id = run_data["defaultDatasetId"]

    # Poll for completion
    status_url = f"{APIFY_BASE_URL}/actor-runs/{run_id}"
    max_wait = 300
    poll_interval = 5
    elapsed = 0

    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval

        status_resp = requests.get(status_url, headers=headers, timeout=15, verify=False)
        status_resp.raise_for_status()
        status = status_resp.json()["data"]["status"]

        if status in ("SUCCEEDED", "FINISHED"):
            break
        elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise RuntimeError(f"Apify actor run failed with status: {status}")

    if elapsed >= max_wait:
        raise TimeoutError("Apify actor run timed out after 5 minutes")

    # Fetch dataset items
    items_url = f"{APIFY_BASE_URL}/datasets/{dataset_id}/items?format=json&limit={limit}"
    items_resp = requests.get(items_url, headers=headers, timeout=30, verify=False)
    items_resp.raise_for_status()
    raw_items = items_resp.json()

    # Map to our schema
    properties = []
    for item in raw_items:
        try:
            prop = _map_99acres_item(item, city)
            properties.append(prop)
        except Exception:
            continue

    return validate_listings(properties)


def _parse_price(val):
    """Parse various price formats from 99acres Apify output."""
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return int(val)
    # String like "1.15 Cr"
    s = str(val).replace('₹', '').replace(',', '').strip()
    try:
        if 'Cr' in s or 'cr' in s:
            num = float(s.lower().split('cr')[0].strip())
            return int(num * 10000000)
        elif 'Lac' in s or 'lac' in s or 'Lakh' in s:
            num = float(s.lower().split('lac')[0].split('lakh')[0].strip())
            return int(num * 100000)
        else:
            return int(float(s))
    except (ValueError, TypeError):
        return 0


def _map_99acres_item(item, city):
    """Map a 99acres Apify result to our schema."""
    # Price
    price = _parse_price(item.get('min_price') or item.get('price'))

    # Area
    area = 0
    for field in ('covered_area', 'area', 'super_area', 'min_area_sqft'):
        raw = item.get(field)
        if raw:
            if isinstance(raw, (int, float)):
                area = int(raw)
                break
            else:
                import re
                match = re.search(r'([\d,]+)', str(raw).replace(',', ''))
                if match:
                    area = int(match.group(1))
                    break

    # BHK
    bhk = 0
    bhk_raw = item.get('bedroom_num')
    if bhk_raw:
        try:
            bhk = int(bhk_raw)
        except (ValueError, TypeError):
            bhk = 0

    # Locality
    locality = item.get('locality', '') or item.get('localitylabel', '') or ''
    loc_data = item.get('location', {})
    if not locality and loc_data:
        locality = loc_data.get('show_case_label', '') or loc_data.get('locality_name', '')
    city_name = item.get('city', '') or ''
    if loc_data:
        city_name = loc_data.get('city_name', city_name) or city_name

    # Seller
    seller_name = ''
    profile = item.get('profile', {})
    formatted = item.get('formatted', {})
    if profile:
        seller_name = profile.get('contact_name', '')
    if not seller_name:
        seller_name = item.get('contact_name', '') or 'Unknown'

    company_name = item.get('contact_company_name', '')
    if profile:
        company_name = profile.get('contact_company_name', company_name) or company_name

    # Seller type
    seller_type = 'Agent'
    if formatted:
        if formatted.get('isowner'):
            seller_type = 'Owner'
        elif formatted.get('isbuilder'):
            seller_type = 'Builder'
    class_label = item.get('class_label', '') or item.get('class_heading', '')
    if 'owner' in str(class_label).lower():
        seller_type = 'Owner'
    elif 'builder' in str(class_label).lower():
        seller_type = 'Builder'

    # URL
    pd_url = item.get('pd_url', '') or item.get('prop_details_url', '')
    source_url = ''
    if pd_url:
        source_url = f"https://www.99acres.com/{pd_url}" if not pd_url.startswith('http') else pd_url

    # Images
    image_url = item.get('photo_url', '') or item.get('medium_photo_url', '')

    # Title
    title = ''
    if formatted:
        title = formatted.get('proptypeheading', '') or ''
        loc_heading = formatted.get('proplocationheading', '')
        if loc_heading and title:
            title = f"{title} in {loc_heading}"
    if not title:
        title = item.get('prop_heading', '') or f"Property in {locality}"

    # Description
    description = item.get('description', '') or ''
    if formatted and not description:
        description = formatted.get('desc', '') or formatted.get('shortdesc', '') or ''
    if not description:
        description = f"Property in {locality or city}"

    # Amenities
    amenities_raw = item.get('amenities', '')
    amenities = []
    if isinstance(amenities_raw, str) and amenities_raw:
        amenities = [a.strip() for a in amenities_raw.split(',') if a.strip()]
    elif isinstance(amenities_raw, list):
        amenities = amenities_raw

    # Property type
    prop_type = item.get('property_type', 'residential') or 'residential'
    res_com = item.get('res_com', '')
    if res_com == 'C':
        prop_type = 'commercial'

    return {
        "title": title,
        "price": price,
        "area": area,
        "locality": locality or city,
        "city": city_name or city,
        "description": description,
        "sourceUrl": source_url,
        "externalId": str(item.get('spid', '') or item.get('prop_id', '') or ''),
        "source": "99acres-Apify",
        "bhk": bhk,
        "amenities": amenities,
        "propertyType": prop_type,
        "sellerName": seller_name,
        "sellerType": seller_type,
        "ownerName": seller_name if seller_type == 'Owner' else '',
        "companyName": company_name,
        "imageUrl": image_url,
        "landmark": '',
        "postedDate": item.get('register_date', '') or '',
    }


if __name__ == "__main__":
    import json
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("Set APIFY_TOKEN environment variable first", file=sys.stderr)
        sys.exit(1)
    results = get_99acres_apify_listings("mumbai", limit=3, token=token)
    print(json.dumps(results, indent=2))
