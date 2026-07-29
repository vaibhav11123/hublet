#  Facebook Real Estate Pipeline

Scrape real estate listings from Facebook groups and extract structured property data using AI (Groq LLM).

## How It Works

```
groups.txt → Scraper (Apify) → raw_listings.csv → Extractor (Groq LLM) → extracted_listings.csv
```

1. **Scrape** — Fetches posts from Facebook groups listed in `groups.txt` via Apify
2. **Extract** — Sends each listing to Groq's LLM to pull out structured fields
3. **Deduplicate** — Removes duplicate listings automatically

## Prerequisites

- Python 3.10+
- An [Apify](https://apify.com/) account (for the Facebook scraper actor)
- A [Groq](https://console.groq.com/) API key (for LLM-based extraction)

## Setup

1. **Create and activate a virtual environment**

```bash
python -m venv venv
source venv/bin/activate   # Linux / macOS
# venv\Scripts\activate    # Windows
```

2. **Install dependencies**

```bash
pip install -r requirements.txt
```

3. **Configure environment variables**

Use the main backend environment file at `src/backend/.env`:

```env
# Apify
APIFY_TOKEN_FB=your_apify_token_here
APIFY_ACTOR_ID_FB=your_actor_id_or_slug
FB_RESULTS_LIMIT=20
FB_VIEW_OPTION=CHRONOLOGICAL

# Groq API Keys (at least one is required)
GROQ_API_KEY=your_groq_api_key_here
GROQ_API_KEY_1=your_groq_api_key_here
GROQ_API_KEY_2=your_second_groq_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile
FB_LLM_TEMPERATURE=0
FB_API_DELAY_SECONDS=1
```

4. **Add Facebook group URLs**

Edit `groups.txt` and add one Facebook group URL per line:

```
# Lines starting with # are ignored
https://www.facebook.com/groups/1410941459137932/
https://www.facebook.com/groups/ANOTHER_GROUP_ID/
```

## Usage

```bash
# Full pipeline: scrape + extract
python pipeline.py

# Scrape only (just fetch posts from Facebook)
python pipeline.py --scrape-only

# Extract only (process existing raw CSV through LLM)
python pipeline.py --extract-only
```

You can also run individual modules directly:

```bash
# Scrape only
python scraper.py

# Extract only (requires data/raw_listings.csv to exist)
python extractor.py
```

## Output Fields

| Field       | Description                                        |
| ----------- | -------------------------------------------------- |
| TITLE       | Cleaned listing title                              |
| LOCALITY    | Location extracted from text                       |
| TYPE        | Apartment, Plot, Villa, etc.                       |
| BHK         | Number of bedrooms                                 |
| AREA        | Area in sqft                                       |
| PRICE       | Numeric price                                      |
| AMENITIES   | Parking, gym, pool, etc.                           |
| SELLER      | Builder / broker / owner info                      |
| STATUS      | ready_to_move / under_construction / resale        |
| CREATED_AT  | Listing date                                       |
| CONTACT     | Phone / WhatsApp numbers                           |
| GROUP_URL   | Source Facebook group URL                          |

Fields that can't be determined show `-`.

## Project Structure

```
facebook_group_scraper/
├── README.md           # This file
├── requirements.txt    # Python dependencies
├── groups.txt          # Input: Facebook group URLs
├── settings.py         # Reads all runtime settings from src/backend/.env
├── scraper.py          # Apify Facebook group scraper
├── extractor.py        # Groq LLM extraction + deduplication
├── pipeline.py         # Main entry point (CLI)
├── data/
│   ├── raw_listings.csv         # Raw scraped posts
│   └── extracted_listings.csv   # Final structured output
└── venv/               # Python virtual environment (not committed)
```

## Configuration

All runtime settings are loaded from `src/backend/.env`.

- **Apify**: `APIFY_TOKEN_FB` (or `APIFY_TOKEN`), `APIFY_ACTOR_ID_FB`
- **Scraper**: `FB_RESULTS_LIMIT`, `FB_VIEW_OPTION`
- **Groq**: `GROQ_API_KEY` (or `GROQ_API_KEY_1`/`GROQ_API_KEY_2`), `GROQ_BASE_URL`, `GROQ_MODEL`, `FB_LLM_TEMPERATURE`, `FB_API_DELAY_SECONDS`
