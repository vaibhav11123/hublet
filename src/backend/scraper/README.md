# MagicBricks Web Scraping Project

This project scrapes property listings from MagicBricks.com and saves the data in both CSV and Excel formats.

## Features

- Scrapes property details including:
  - Title and Project Name
  - Price and Price per sqft
  - Property Description
  - Builder Information
  - Property Specifications
  - Location Details
  - And more...

## Requirements

- Python 3.x
- Required packages:
  - requests
  - beautifulsoup4
  - pandas
  - xlsxwriter
  - fake-useragent

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Real-Estate-DISA/web_scraping.git
cd web_scraping
```

2. Install required packages:
```bash
pip install -r requirements.txt
```

## Usage

1. Run the scraping script:
```bash
python magic_bricks_M1.py
```

2. Convert CSV to Excel (optional):
```bash
python convert_to_excel.py
```

## Output

The script generates two files:
- `magicbricks_properties.csv`: Raw data in CSV format
- `magicbricks_properties.xlsx`: Formatted data in Excel format

## Note

Please ensure you comply with MagicBricks' terms of service and robots.txt when using this script. Srisailam highway road to 1km Karthal town 378 Noth East Corner,-,-,-,-,-,-,-,-,-,-,https://www.facebook.com/groups/1410941459137932/
