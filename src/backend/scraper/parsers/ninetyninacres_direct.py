"""
99acres direct HTML scraper — pure requests + BeautifulSoup.
No API keys needed. Self-reliant, runs entirely from your device.
"""

import requests
from bs4 import BeautifulSoup
import re
import json
import sys
import os
from typing import Tuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from schema import validate_listings


# Map city names to 99acres URL format
CITY_URL_MAP = {
    "mumbai": "https://www.99acres.com/search/property/buy/mumbai?city=19&preference=S&area_unit=1&res_com=R",
    "new-delhi": "https://www.99acres.com/search/property/buy/new-delhi?city=9&preference=S&area_unit=1&res_com=R",
    "delhi": "https://www.99acres.com/search/property/buy/new-delhi?city=9&preference=S&area_unit=1&res_com=R",
    "hyderabad": "https://www.99acres.com/search/property/buy/hyderabad?city=23&preference=S&area_unit=1&res_com=R",
    "bangalore": "https://www.99acres.com/search/property/buy/bangalore?city=21&preference=S&area_unit=1&res_com=R",
    "chennai": "https://www.99acres.com/search/property/buy/chennai?city=10&preference=S&area_unit=1&res_com=R",
    "pune": "https://www.99acres.com/search/property/buy/pune?city=17&preference=S&area_unit=1&res_com=R",
}


def parse_price_99acres(price_text):
    """Parse price text like '₹ 1.15 Cr', '₹ 85 Lac', '₹ 45,00,000' into integer."""
    if not price_text:
        return 0
    clean = price_text.replace('₹', '').replace(',', '').strip()
    try:
        if 'Cr' in clean or 'cr' in clean:
            val = float(re.sub(r'[^\d.]', '', clean.split('Cr')[0].split('cr')[0]))
            return int(val * 10000000)
        elif 'Lac' in clean or 'lac' in clean or 'Lakh' in clean or 'lakh' in clean:
            val = float(re.sub(r'[^\d.]', '', clean.split('Lac')[0].split('lac')[0].split('Lakh')[0].split('lakh')[0]))
            return int(val * 100000)
        else:
            return int(float(re.sub(r'[^\d.]', '', clean)))
    except (ValueError, TypeError):
        return 0


def parse_area_99acres(area_text):
    """Parse area text like '1200 sqft', '1,130 sq.ft.' into integer sqft."""
    if not area_text:
        return 0
    try:
        match = re.search(r'([\d,]+)', area_text.replace(',', ''))
        if match:
            return int(match.group(1))
        return 0
    except (ValueError, TypeError):
        return 0


def get_99acres_listings(city, limit=10, **kwargs):
    """
    Scrapes 99acres.com for property listings using direct HTTP requests + BS4.
    Returns a list of dicts conforming to the strict schema.
    """
    import sys as _sys

    search_url = CITY_URL_MAP.get(city.lower())
    if not search_url:
        formatted_city = city.lower().replace(" ", "-")
        search_url = f"https://www.99acres.com/search/property/buy/{formatted_city}?preference=S&area_unit=1&res_com=R"

    print(f"[99acres-direct] URL: {search_url}", file=_sys.stderr)

    properties = []

    try:
        response, blocked = _fetch_99acres_html(search_url)
        print(f"[99acres-direct] HTTP {response.status_code}, blocked={blocked}, body_len={len(response.text)}", file=_sys.stderr)

        if blocked:
            print(f"[99acres-direct] Blocked by 99acres, falling back to Apify", file=_sys.stderr)
            return _fallback_to_apify(city, limit)

        if response.status_code != 200:
            print(f"[99acres-direct] Non-200 status {response.status_code}, falling back to Apify", file=_sys.stderr)
            return _fallback_to_apify(city, limit)

        soup = BeautifulSoup(response.content, 'html.parser')

        page_text = response.text.lower()
        if any(marker in page_text for marker in ("access denied", "forbidden", "you don't have permission", "captcha")):
            print(f"[99acres-direct] Block marker found in page, falling back to Apify", file=_sys.stderr)
            return _fallback_to_apify(city, limit)

        # 99acres uses various card structures. Try multiple selectors.
        cards = soup.find_all('div', class_='tupleNew__tupleWrap')
        if not cards:
            cards = soup.find_all('div', class_='srpTuple__tupleWrap')
        if not cards:
            cards = soup.find_all('section', {'data-label': 'SEARCH_TUPLE'})
        if not cards:
            # Fallback: try script tags with JSON data
            print(f"[99acres-direct] No HTML cards found, trying JSON extraction", file=_sys.stderr)
            properties = _try_json_extraction(soup, city, limit)
            if not properties:
                print(f"[99acres-direct] JSON extraction also empty, falling back to Apify", file=_sys.stderr)
                return _fallback_to_apify(city, limit)
            return validate_listings(properties)

        print(f"[99acres-direct] Found {len(cards)} HTML cards", file=_sys.stderr)
        count = 0
        for card in cards:
            if count >= limit:
                break

            try:
                prop = _parse_card(card, city)
                if prop:
                    properties.append(prop)
                    count += 1
            except Exception:
                continue

    except Exception as e:
        print(f"[99acres-direct] Exception: {e}, falling back to Apify", file=_sys.stderr)
        return _fallback_to_apify(city, limit)

    if not properties:
        print(f"[99acres-direct] 0 properties parsed, falling back to Apify", file=_sys.stderr)
        return _fallback_to_apify(city, limit)

    return validate_listings(properties)


def _fetch_99acres_html(search_url: str) -> Tuple[requests.Response, bool]:
    """Fetch a 99acres page with header fallbacks; return response and whether it was blocked."""
    header_variants = [
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/",
            "DNT": "1",
        },
        {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
            "Referer": "https://www.google.com/",
            "DNT": "1",
        },
    ]

    session = requests.Session()
    last_response = None

    for headers in header_variants:
        resp = session.get(search_url, headers=headers, timeout=30)
        last_response = resp
        if resp.status_code in (403, 429):
            continue
        return resp, False

    if last_response is None:
        raise RuntimeError("Failed to fetch 99acres page")

    return last_response, last_response.status_code in (403, 429)


def _fallback_to_apify(city, limit):
    """Fallback to Apify listings when 99acres blocks direct requests from this host."""
    import sys as _sys
    token = os.environ.get("APIFY_TOKEN", "").strip()
    print(f"[99acres-direct] Apify fallback: APIFY_TOKEN={'set (' + token[:10] + '...)' if token else 'NOT SET'}", file=_sys.stderr)
    if not token:
        print(f"[99acres-direct] No APIFY_TOKEN, returning empty", file=_sys.stderr)
        return []

    try:
        from parsers.ninetyninacres_apify import get_99acres_apify_listings
        results = get_99acres_apify_listings(city, limit=limit, token=token)
        print(f"[99acres-direct] Apify fallback returned {len(results)} listings", file=_sys.stderr)
        return results
    except Exception as e:
        print(f"[99acres-direct] Apify fallback failed: {e}", file=_sys.stderr)
        return []


def _try_json_extraction(soup, city, limit):
    """
    99acres often embeds listing data in script tags as JSON.
    Try to extract from __NEXT_DATA__ or similar embedded JSON.
    """
    properties = []
    scripts = soup.find_all('script')

    for script in scripts:
        text = script.get_text() or ""
        if not text:
            continue

        if script.get("id") == "__NEXT_DATA__":
            try:
                data = json.loads(text)
                listings = _extract_from_json(data, city, limit)
                properties.extend(listings)
                if properties:
                    return properties
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        # Try __NEXT_DATA__ (Next.js pattern)
        if '__NEXT_DATA__' in text or 'window.__DATA__' in text or '"listingData"' in text:
            try:
                # Extract JSON from the script
                json_match = re.search(r'(?:__NEXT_DATA__|__DATA__|listingData)\s*=\s*({.+?});?\s*(?:</script>|$)', text, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(1))
                    listings = _extract_from_json(data, city, limit)
                    properties.extend(listings)
                    if properties:
                        return properties
            except (json.JSONDecodeError, Exception):
                continue

        # Look for "srpData" or similar patterns
        if 'srpData' in text or '"listings"' in text or '"propertyData"' in text:
            try:
                # Try to find JSON arrays
                json_arrays = re.findall(r'\[{[^]]+}\]', text)
                for arr_str in json_arrays:
                    try:
                        arr = json.loads(arr_str)
                        if isinstance(arr, list) and len(arr) > 0 and isinstance(arr[0], dict):
                            if any(k in arr[0] for k in ('prop_heading', 'property_type', 'locality', 'min_price', 'price')):
                                for item in arr[:limit]:
                                    prop = _map_json_item(item, city)
                                    if prop:
                                        properties.append(prop)
                                if properties:
                                    return properties
                    except json.JSONDecodeError:
                        continue
            except Exception:
                continue

    return properties


def _extract_from_json(payload, city, limit):
    """Recursively scan JSON payload and map listing-like dicts to schema items."""
    extracted = []

    def walk(node):
        if len(extracted) >= limit:
            return

        if isinstance(node, dict):
            if any(k in node for k in ('prop_heading', 'property_type', 'locality', 'min_price', 'price', 'spid', 'prop_id')):
                mapped = _map_json_item(node, city)
                if mapped:
                    extracted.append(mapped)
                    if len(extracted) >= limit:
                        return

            for value in node.values():
                walk(value)
                if len(extracted) >= limit:
                    return

        elif isinstance(node, list):
            for item in node:
                walk(item)
                if len(extracted) >= limit:
                    return

    walk(payload)
    return extracted[:limit]


def _map_json_item(item, city):
    """Map a JSON item from embedded script data to our schema."""
    # Handle 99acres JSON format
    price = 0
    min_price = item.get('min_price') or item.get('price') or item.get('formatted_price')
    if min_price:
        if isinstance(min_price, (int, float)):
            price = int(min_price)
        else:
            price = parse_price_99acres(str(min_price))

    area = 0
    area_raw = item.get('covered_area') or item.get('area') or item.get('super_area')
    if area_raw:
        if isinstance(area_raw, (int, float)):
            area = int(area_raw)
        else:
            area = parse_area_99acres(str(area_raw))

    bhk = 0
    bhk_raw = item.get('bedroom_num') or item.get('bedrooms')
    if bhk_raw:
        try:
            bhk = int(bhk_raw)
        except (ValueError, TypeError):
            bhk = 0

    locality = item.get('locality', '') or item.get('localitylabel', '') or ''
    if city.lower() not in locality.lower() and locality:
        locality = f"{locality}, {city}"

    amenities = []
    amenities_raw = item.get('amenities', '')
    if isinstance(amenities_raw, str) and amenities_raw:
        # 99acres often stores amenities as comma-separated IDs
        # Map common ones
        amenities = [a.strip() for a in amenities_raw.split(',') if a.strip()]
    elif isinstance(amenities_raw, list):
        amenities = amenities_raw

    pd_url = item.get('pd_url', '') or item.get('prop_details_url', '')
    source_url = ''
    if pd_url:
        source_url = f"https://www.99acres.com{pd_url}" if not pd_url.startswith('http') else pd_url

    seller_name = item.get('contact_name', '') or 'Unknown'
    company_name = item.get('contact_company_name', '') or ''

    owner_type = item.get('class_label', '') or item.get('owntype', '')
    if 'owner' in str(owner_type).lower() or owner_type == '1':
        seller_type = 'Owner'
    elif 'builder' in str(owner_type).lower():
        seller_type = 'Builder'
    else:
        seller_type = 'Agent'

    title = item.get('prop_heading', '') or item.get('name', '') or f"Property in {locality}"

    return {
        "title": title,
        "price": price,
        "area": area,
        "locality": locality,
        "city": item.get('city_name', city) or city,
        "description": item.get('description', '') or f"Property in {locality}",
        "sourceUrl": source_url,
        "externalId": str(item.get('spid', '') or item.get('prop_id', '') or ''),
        "source": "99acres",
        "bhk": bhk,
        "amenities": amenities if amenities else [],
        "propertyType": item.get('property_type', 'residential') or 'residential',
        "sellerName": seller_name,
        "sellerType": seller_type,
        "ownerName": seller_name if seller_type == 'Owner' else '',
        "companyName": company_name,
        "imageUrl": item.get('photo_url', '') or item.get('medium_photo_url', '') or '',
        "landmark": '',
        "postedDate": item.get('register_date', '') or '',
    }


def _parse_card(card, city):
    """Parse a single listing card from 99acres HTML."""
    # Title
    title_elem = card.find('h2') or card.find('a', class_='body_med')
    title = title_elem.text.strip() if title_elem else ""

    if not title:
        heading = card.find('td', class_='srpTuple__heading')
        if heading:
            title = heading.text.strip()

    if not title:
        return None

    # Price
    price = 0
    price_elem = card.find('td', class_='srpTuple__price') or card.find('span', class_='tupleNew__priceWrap')
    if price_elem:
        price = parse_price_99acres(price_elem.text)

    # Area
    area = 0
    area_elem = card.find('td', class_='srpTuple__areaWrap') or card.find('span', string=re.compile(r'sq\.?ft', re.I))
    if area_elem:
        area = parse_area_99acres(area_elem.text)

    # Locality
    locality_elem = card.find('span', class_='tupleNew__locName') or card.find('td', class_='srpTuple__locWrap')
    locality = locality_elem.text.strip() if locality_elem else city
    if city.lower() not in locality.lower():
        locality = f"{locality}, {city}"

    # BHK (from title usually)
    bhk = 0
    bhk_match = re.search(r'(\d+)\s*BHK', title, re.I)
    if bhk_match:
        bhk = int(bhk_match.group(1))

    # URL
    link_elem = card.find('a', href=True)
    source_url = ""
    if link_elem:
        href = link_elem.get('href', '')
        source_url = f"https://www.99acres.com{href}" if href and not href.startswith('http') else href

    # External ID from URL
    external_id = ""
    if source_url:
        id_match = re.search(r'spid-([A-Z]?\d+)', source_url, re.I)
        if id_match:
            external_id = id_match.group(1)

    # Description
    desc_elem = card.find('div', class_='tupleNew__descWrap') or card.find('td', class_='srpTuple__descWrap')
    description = desc_elem.text.strip() if desc_elem else f"Property in {locality}"

    # Amenities from description keywords
    amenities = []
    desc_lower = (description + " " + title).lower()
    keywords = {
        "parking": "Parking", "lift": "Lift", "gym": "Gym",
        "swimming": "Swimming Pool", "security": "Security",
        "power backup": "Power Backup", "garden": "Garden",
        "club": "Club House", "furnished": "Furnished",
        "park": "Park", "water": "Water Supply",
    }
    for key, value in keywords.items():
        if key in desc_lower:
            amenities.append(value)

    # Seller info
    seller_elem = card.find('div', class_='tupleNew__agentName') or card.find('span', class_='srpTuple__agentName')
    seller_name = seller_elem.text.strip() if seller_elem else "Unknown"

    type_elem = card.find('div', class_='tupleNew__ownerLabel') or card.find('span', class_='srpTuple__ownerLabel')
    seller_type = "Agent"
    if type_elem:
        type_text = type_elem.text.strip().lower()
        if 'owner' in type_text:
            seller_type = "Owner"
        elif 'builder' in type_text:
            seller_type = "Builder"

    # Property type
    prop_type = "residential"
    if any(kw in title.lower() for kw in ['commercial', 'office', 'shop', 'showroom']):
        prop_type = "commercial"

    # Image
    img_elem = card.find('img')
    image_url = ""
    if img_elem:
        image_url = img_elem.get('data-src', '') or img_elem.get('src', '')

    return {
        "title": title,
        "price": price,
        "area": area,
        "locality": locality,
        "city": city,
        "description": description,
        "sourceUrl": source_url,
        "externalId": external_id,
        "source": "99acres",
        "bhk": bhk,
        "amenities": amenities if amenities else [],
        "propertyType": prop_type,
        "sellerName": seller_name,
        "sellerType": seller_type,
        "ownerName": seller_name if seller_type == "Owner" else "",
        "companyName": "",
        "imageUrl": image_url,
        "landmark": "",
        "postedDate": "",
    }


if __name__ == "__main__":
    results = get_99acres_listings("mumbai", limit=3)
    print(json.dumps(results, indent=2))
