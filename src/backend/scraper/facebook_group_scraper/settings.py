"""
settings.py — Environment-backed settings for the Facebook scraper pipeline.

All runtime settings are sourced from src/backend/.env.
"""
import os
from dotenv import load_dotenv


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ENV_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".env"))

# Load the main backend .env only.
load_dotenv(BACKEND_ENV_PATH, override=False)


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# API tokens/IDs
APIFY_TOKEN = os.getenv("APIFY_TOKEN_FB") or os.getenv("APIFY_TOKEN")
APIFY_ACTOR_ID = (os.getenv("APIFY_ACTOR_ID_FB") or "").strip()
APIFY_ACTOR_FALLBACK_IDS = [actor_id for actor_id in [APIFY_ACTOR_ID] if actor_id]

# Scraper settings
RESULTS_LIMIT = _get_int("FB_RESULTS_LIMIT", 20)
VIEW_OPTION = (os.getenv("FB_VIEW_OPTION") or "CHRONOLOGICAL").strip().upper()

# Groq settings
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API_KEY_1") or os.getenv("GROQ_API_KEY_2")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
LLM_TEMPERATURE = _get_float("FB_LLM_TEMPERATURE", 0.0)
API_DELAY_SECONDS = _get_float("FB_API_DELAY_SECONDS", 1.0)

# File paths
DATA_DIR = os.path.join(BASE_DIR, "data")
GROUPS_FILE = os.path.join(BASE_DIR, "groups.txt")
RAW_CSV = os.path.join(DATA_DIR, "raw_listings.csv")
EXTRACTED_CSV = os.path.join(DATA_DIR, "extracted_listings.csv")

# Output schema
EXPECTED_COLUMNS = [
    "TITLE",
    "LOCALITY",
    "TYPE",
    "BHK",
    "AREA",
    "PRICE",
    "AMENITIES",
    "SELLER",
    "STATUS",
    "CREATED_AT",
    "CONTACT",
    "GROUP_URL",
]

# LLM extraction prompt (optional override from .env)
EXTRACTION_PROMPT = os.getenv(
    "FB_EXTRACTION_PROMPT",
    """You are a real estate data extractor. Given a Facebook group listing, extract the following fields. Return ONLY a JSON object with these keys. Use \"-\" if a field cannot be determined.

Fields:
- TITLE: Use the provided title. Clean it if necessary.
- LOCALITY: Extract the locality from location or description text.
- TYPE: Property type if mentioned (Apartment, Flat, Villa, Plot, Independent house, Builder floor, etc.). \"-\" if not mentioned.
- BHK: Number before \"BHK\" (e.g. \"3 BHK\" -> 3). \"-\" if not mentioned.
- AREA: Area in square feet (numeric value only). \"-\" if not mentioned.
- PRICE: Numeric property price. Remove commas and currency symbols. \"-\" if not available.
- AMENITIES: List of amenities mentioned (parking, gym, swimming pool, security, lift, garden, clubhouse, etc.). \"-\" if none.
- SELLER: Seller info (builder name, broker, owner). \"-\" if not present.
- STATUS: Classify as ready_to_move, under_construction, or resale if mentioned. \"-\" if not mentioned.
- CREATED_AT: Listing creation date if mentioned. \"-\" if not present.
- CONTACT: Extract phone numbers, WhatsApp numbers, or email addresses. \"-\" if not present.

Return ONLY valid JSON. No markdown, no explanation.""",
)
