import requests
from bs4 import BeautifulSoup
import time
import random
import json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from schema import validate_listings

def get_magicbricks_listings(city, limit=10):
    """
    Scrapes MagicBricks for property listings in a specific city.
    Returns a list of dictionaries with property details.
    """
    
    # Map city names to MagicBricks format if needed
    city_map = {
        "mumbai": "Mumbai",
        "delhi": "New-Delhi",
        "hyderabad": "Hyderabad",
        "bangalore": "Bangalore",
        "chennai": "Chennai",
        "pune": "Pune"
    }
    
    formatted_city = city_map.get(city.lower(), city)
    
    # Base URL for property search
    # Note: MagicBricks URLs can be complex. We'll use a search URL pattern.
    # Targeted: Commercial Office Space, Office in IT Park/SEZ
    url = f"https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName={formatted_city}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/"
    }
    
    properties = []
    
    try:
        # print(f"Fetching listings from: {url}")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            # print(f"Failed to fetch page. Status code: {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # MagicBricks structure often changes, but listings usually have specific classes
        # We will try to find listing cards. 
        # Common classes: 'mb-srp-item', 'mb-srp__card'
        
        cards = soup.find_all('div', class_='mb-srp__card')
        
        # print(f"Found {len(cards)} cards on the page.")
        
        count = 0
        for card in cards:
            if count >= limit:
                break
                
            try:
                # Extract details
                # Title/Name
                title_elem = card.find('h2', class_='mb-srp__card--title')
                title = title_elem.text.strip() if title_elem else "Office Space"
                
                # Price
                price_elem = card.find('div', class_='mb-srp__card__price--amount')
                price_text = price_elem.text.strip() if price_elem else "0"
                # Parse price (e.g., "₹ 2.5 Cr", "₹ 85 Lac")
                price = parse_price(price_text)
                
                # Area
                # Commercial cards have a different structure for area
                area = 0
                summary_items = card.find_all('div', class_='mb-srp__card__summary-commercial__list--item')
                for item in summary_items:
                    label = item.find('div', class_='mb-srp__card__summary--label')
                    if label and ('Area' in label.text or 'area' in label.text):
                        val = item.find('div', class_='mb-srp__card__summary--value')
                        if val:
                            area = parse_area(val.text)
                            break
                            
                # Fallback for old structure
                if area == 0:
                     area_elem = card.find('div', {'data-summary': 'super-area'})
                     if area_elem:
                        area_text = area_elem.find('div', class_='mb-srp__card__summary--value').text.strip()
                        area = parse_area(area_text)
                
                # Locality
                # Sometimes in title or separate
                locality = city # Default
                # title usually has "in Locality"
                if " in " in title:
                    locality = title.split(" in ")[1].strip()
                
                # Append city if not present to aid matching
                if city.lower() not in locality.lower():
                    locality = f"{locality}, {city}"
                
                # URL
                # The card usually wraps a link or has a link
                link_elem = card.find('a', class_='mb-srp__card--title')
                if not link_elem:
                   link_elem = card.find('a', href=True)
                   
                prop_url = link_elem['href'] if link_elem else ""
                if prop_url and not prop_url.startswith('http'):
                    prop_url = "https://www.magicbricks.com" + prop_url
                    
                # Description
                desc_elem = card.find('div', class_='mb-srp__card--desc--text')
                description = desc_elem.text.strip() if desc_elem else f"Office space in {locality}"
                
                # ID
                # Extract from card id or URL
                external_id = card.get('id', '')
                if not external_id and prop_url:
                     external_id = prop_url.split('-id-')[-1]

                # Extract amenities from description
                amenities = []
                desc_lower = description.lower()
                keywords = {
                    "parking": "Parking",
                    "wifi": "Wi-Fi",
                    "power backup": "Power Backup",
                    "ac": "Air Conditioning",
                    "furnished": "Furnished",
                    "security": "Security",
                    "cctv": "CCTV",
                    "lift": "Lift",
                    "elevator": "Elevator",
                    "water": "Water Storage",
                    "maintainance": "Maintenance Staff"
                }
                
                for key, value in keywords.items():
                    if key in desc_lower:
                        amenities.append(value)
                
                if not amenities:
                    amenities = ["Office Space"]

                # Seller Info
                seller_name = "Unknown"
                seller_type = "Agent" # Default to Agent if unknown, or check buttons
                
                # Try to find advertiser name
                advertiser_elem = card.find('div', class_='mb-srp__card__ads--name')
                if advertiser_elem:
                    raw_name = advertiser_elem.text.strip()
                    # Often format is "Builder: Name" or "Agent: Name"
                    if ":" in raw_name:
                        parts = raw_name.split(":", 1)
                        seller_type = parts[0].strip()
                        seller_name = parts[1].strip()
                    else:
                        seller_name = raw_name
                else:
                    # Fallback strategies for type
                    action_btns = card.find_all('span', class_='mb-srp__action--btn')
                    for btn in action_btns:
                        btn_text = btn.text.strip().lower()
                        if 'agent' in btn_text:
                            seller_type = "Agent"
                            break
                        elif 'owner' in btn_text:
                            seller_type = "Owner"
                            break
                        elif 'builder' in btn_text:
                            seller_type = "Builder"
                            break

                property_data = {
                    "title": title,
                    "price": price,
                    "area": area,
                    "locality": locality,
                    "city": city,
                    "description": description,
                    "sourceUrl": prop_url,
                    "externalId": external_id,
                    "source": "MagicBricks",
                    "bhk": 0, # Commercial often doesn't have BHK, default to 0
                    "amenities": amenities,
                    "propertyType": "commercial",
                    "sellerName": seller_name,
                    "sellerType": seller_type
                }
                
                properties.append(property_data)
                count += 1
                
            except Exception as e:
                # print(f"Error parsing card: {str(e)}")
                continue
                
    except Exception as e:
        # print(f"Error scraping MagicBricks: {str(e)}")
        pass
        
    return validate_listings(properties)

def parse_price(price_text):
    """
    Parses price text like '₹ 2.5 Cr' or '₹ 85 Lac' into integer (Rupees).
    """
    clean_text = price_text.replace('₹', '').strip()
    try:
        if 'Cr' in clean_text:
            val = float(clean_text.replace('Cr', '').strip())
            return int(val * 10000000)
        elif 'Lac' in clean_text:
            val = float(clean_text.replace('Lac', '').strip())
            return int(val * 100000)
        elif 'Call for Price' in clean_text:
            return 0
        else:
            # remove commas
            return int(float(clean_text.replace(',', '')))
    except:
        return 0

def parse_area(area_text):
    """
    Parses area text like '1200 sqft' into integer.
    """
    try:
        import re
        # Find first number
        match = re.search(r'(\d+)', area_text.replace(',', ''))
        if match:
            return int(match.group(1))
        return 0
    except:
        return 0

if __name__ == "__main__":
    # Test
    results = get_magicbricks_listings("mumbai", limit=3)
    print(json.dumps(results, indent=2))
