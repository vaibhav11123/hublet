import requests
from bs4 import BeautifulSoup
import json

def get_property_details(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.magicbricks.com/",
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error fetching property details: {str(e)}")
        return None

def main():
    # Property URL to analyze
    property_url = "https://www.magicbricks.com/property-for-sale/commercial-real-estate?bedroom=&proptype=Commercial-Office-Space,Office-ITPark-SEZ&cityName=New-Delhi"
    print(f"Fetching property details from: {property_url}")
    html_content = get_property_details(property_url)
    
    if html_content:
        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Save the prettified HTML content to a file
        with open('property_details.html', 'w', encoding='utf-8') as f:
            f.write(soup.prettify())
        print("\nPrettified HTML content has been saved to 'property_details.html'")
        
        # Also print the JSON-LD data if available
        json_ld = soup.find('script', type='application/ld+json')
        if json_ld:
            try:
                json_data = json.loads(json_ld.string)
                print("\nJSON-LD data found:")
                print(json.dumps(json_data, indent=2))
            except Exception as e:
                print(f"Error parsing JSON-LD: {str(e)}")
    else:
        print("Failed to fetch property details")

if __name__ == "__main__":
    main()
