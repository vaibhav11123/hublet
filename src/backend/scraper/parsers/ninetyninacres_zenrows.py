"""
99acres ZenRows scraper — uses ZenRows Universal Scraper API for anti-bot bypass,
then parses the returned HTML with BeautifulSoup.
Requires ZENROWS_API_KEY.
"""

import requests
from bs4 import BeautifulSoup
import re
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from schema import validate_listings

ZENROWS_API_URL = "https://api.zenrows.com/v1/"

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


def get_99acres_zenrows_listings(city, limit=10, zenrows_key=None, **kwargs):
    """
    Fetches 99acres listings via ZenRows API (anti-bot bypass) + BS4 parsing.
    Returns a list of schema-validated dicts.
    """
    zenrows_key = zenrows_key or os.environ.get("ZENROWS_API_KEY")
    if not zenrows_key:
        raise ValueError("ZenRows API key is required. Set ZENROWS_API_KEY env var or pass --zenrows-key.")

    search_url = CITY_URL_MAP.get(city.lower())
    if not search_url:
        formatted_city = city.lower().replace(" ", "-")
        search_url = f"https://www.99acres.com/search/property/buy/{formatted_city}?preference=S&area_unit=1&res_com=R"

    # Call ZenRows API with adaptive stealth mode
    params = {
        "url": search_url,
        "apikey": zenrows_key,
        "mode": "auto",
        "proxy_country": "in",
    }

    response = requests.get(ZENROWS_API_URL, params=params, timeout=60)

    if response.status_code != 200:
        raise RuntimeError(f"ZenRows request failed with status {response.status_code}: {response.text[:200]}")

    soup = BeautifulSoup(response.content, 'html.parser')

    properties = []

    # Strategy 1: Try to extract from embedded JSON (99acres uses client-side rendering)
    properties = _try_json_extraction(soup, city, limit)

    # Strategy 2: Parse HTML cards if JSON extraction didn't work
    if not properties:
        properties = _parse_html_cards(soup, city, limit)

    return validate_listings(properties)


def _try_json_extraction(soup, city, limit):
    """Extract listings from embedded JSON in script tags."""
    properties = []
    scripts = soup.find_all('script')

    for script in scripts:
        if not script.string:
            continue
        text = script.string

        # 99acres embeds large JSON objects in script tags
        if any(marker in text for marker in ['srpData', 'listingData', '"spid"', '"prop_heading"', '__NEXT_DATA__']):
            try:
                # Try to find JSON arrays containing listing data
                json_arrays = re.findall(r'\[{[^]]{50,}}\]', text)
                for arr_str in json_arrays:
                    try:
                        arr = json.loads(arr_str)
                        if isinstance(arr, list) and len(arr) > 0 and isinstance(arr[0], dict):
                            if any(k in arr[0] for k in ('prop_heading', 'spid', 'prop_id', 'locality', 'min_price')):
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

        # Try __NEXT_DATA__
        if '__NEXT_DATA__' in text:
            try:
                json_match = re.search(r'__NEXT_DATA__\s*=\s*({.+?});\s*</script>', text, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(1))
                    # Navigate to listings in Next.js data structure
                    page_props = data.get('props', {}).get('pageProps', {})
                    listings = page_props.get('listings', []) or page_props.get('searchResults', [])
                    for item in listings[:limit]:
                        prop = _map_json_item(item, city)
                        if prop:
                            properties.append(prop)
                    if properties:
                        return properties
            except (json.JSONDecodeError, Exception):
                pass

    return properties


def _map_json_item(item, city):
    """Map a 99acres JSON item to our schema."""
    price = 0
    min_price = item.get('min_price') or item.get('price')
    if min_price:
        if isinstance(min_price, (int, float)):
            price = int(min_price)
        else:
            price = _parse_price(str(min_price))

    area = 0
    area_raw = item.get('covered_area') or item.get('area') or item.get('min_area_sqft')
    if area_raw:
        if isinstance(area_raw, (int, float)):
            area = int(area_raw)
        else:
            match = re.search(r'([\d,]+)', str(area_raw).replace(',', ''))
            if match:
                area = int(match.group(1))

    bhk = 0
    bhk_raw = item.get('bedroom_num')
    if bhk_raw:
        try:
            bhk = int(bhk_raw)
        except (ValueError, TypeError):
            pass

    locality = item.get('locality', '') or item.get('localitylabel', '') or ''
    loc_data = item.get('location', {})
    if not locality and isinstance(loc_data, dict):
        locality = loc_data.get('show_case_label', '') or loc_data.get('locality_name', '')

    seller_name = item.get('contact_name', '') or 'Unknown'
    company_name = item.get('contact_company_name', '') or ''
    seller_type = 'Agent'
    class_label = item.get('class_label', '') or item.get('class_heading', '')
    if 'owner' in str(class_label).lower() or item.get('owntype') == '1':
        seller_type = 'Owner'
    elif 'builder' in str(class_label).lower():
        seller_type = 'Builder'

    pd_url = item.get('pd_url', '') or item.get('prop_details_url', '')
    source_url = f"https://www.99acres.com/{pd_url}" if pd_url and not pd_url.startswith('http') else pd_url

    title = item.get('prop_heading', '') or f"Property in {locality or city}"

    return {
        "title": title,
        "price": price,
        "area": area,
        "locality": locality or city,
        "city": city,
        "description": item.get('description', '') or f"Property in {locality or city}",
        "sourceUrl": source_url,
        "externalId": str(item.get('spid', '') or item.get('prop_id', '') or ''),
        "source": "99acres-ZenRows",
        "bhk": bhk,
        "amenities": [],
        "propertyType": item.get('property_type', 'residential') or 'residential',
        "sellerName": seller_name,
        "sellerType": seller_type,
        "ownerName": seller_name if seller_type == 'Owner' else '',
        "companyName": company_name,
        "imageUrl": item.get('photo_url', '') or item.get('medium_photo_url', '') or '',
        "landmark": '',
        "postedDate": item.get('register_date', '') or '',
    }


def _parse_html_cards(soup, city, limit):
    """Parse listing cards from HTML as fallback."""
    properties = []

    cards = soup.find_all('div', class_='tupleNew__tupleWrap')
    if not cards:
        cards = soup.find_all('div', class_='srpTuple__tupleWrap')
    if not cards:
        cards = soup.find_all('section', {'data-label': 'SEARCH_TUPLE'})

    count = 0
    for card in cards:
        if count >= limit:
            break
        try:
            # Title
            title_elem = card.find('h2') or card.find('a', class_='body_med')
            title = title_elem.text.strip() if title_elem else ""
            if not title:
                continue

            # Price
            price_elem = card.find('td', class_='srpTuple__price') or card.find('span', class_='tupleNew__priceWrap')
            price = _parse_price(price_elem.text if price_elem else "0")

            # Area
            area = 0
            area_elem = card.find('td', class_='srpTuple__areaWrap')
            if area_elem:
                match = re.search(r'([\d,]+)', area_elem.text.replace(',', ''))
                if match:
                    area = int(match.group(1))

            # BHK
            bhk = 0
            bhk_match = re.search(r'(\d+)\s*BHK', title, re.I)
            if bhk_match:
                bhk = int(bhk_match.group(1))

            # Locality
            loc_elem = card.find('span', class_='tupleNew__locName') or card.find('td', class_='srpTuple__locWrap')
            locality = loc_elem.text.strip() if loc_elem else city

            # URL
            link = card.find('a', href=True)
            href = link.get('href', '') if link else ''
            source_url = f"https://www.99acres.com{href}" if href and not href.startswith('http') else href

            properties.append({
                "title": title,
                "price": price,
                "area": area,
                "locality": locality,
                "city": city,
                "description": f"Property in {locality}",
                "sourceUrl": source_url,
                "externalId": "",
                "source": "99acres-ZenRows",
                "bhk": bhk,
                "amenities": [],
                "propertyType": "residential",
                "sellerName": "Unknown",
                "sellerType": "Unknown",
                "ownerName": "",
                "companyName": "",
                "imageUrl": "",
                "landmark": "",
                "postedDate": "",
            })
            count += 1
        except Exception:
            continue

    return properties


def _parse_price(price_text):
    """Parse price text from 99acres."""
    if not price_text:
        return 0
    clean = str(price_text).replace('₹', '').replace(',', '').strip()
    try:
        if 'Cr' in clean or 'cr' in clean:
            val = float(re.sub(r'[^\d.]', '', clean.lower().split('cr')[0]))
            return int(val * 10000000)
        elif 'Lac' in clean or 'lac' in clean or 'Lakh' in clean:
            val = float(re.sub(r'[^\d.]', '', clean.lower().split('lac')[0].split('lakh')[0]))
            return int(val * 100000)
        else:
            return int(float(re.sub(r'[^\d.]', '', clean)))
    except (ValueError, TypeError):
        return 0


if __name__ == "__main__":
    key = os.environ.get("ZENROWS_API_KEY")
    if not key:
        print("Set ZENROWS_API_KEY environment variable first", file=sys.stderr)
        sys.exit(1)
    results = get_99acres_zenrows_listings("mumbai", limit=3, zenrows_key=key)
    print(json.dumps(results, indent=2))
