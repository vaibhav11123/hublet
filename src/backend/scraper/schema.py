"""
Strict JSON schema for scraped property listings.
All scrapers MUST output data conforming to this schema.
Missing fields are filled with safe defaults (null/0/[]).
"""

# The canonical field definitions with types and defaults
LISTING_SCHEMA = {
    "title":        {"type": str,   "default": "Unknown Property"},
    "price":        {"type": int,   "default": 0},
    "area":         {"type": int,   "default": 0},
    "locality":     {"type": str,   "default": ""},
    "city":         {"type": str,   "default": ""},
    "description":  {"type": str,   "default": ""},
    "sourceUrl":    {"type": str,   "default": ""},
    "externalId":   {"type": str,   "default": ""},
    "source":       {"type": str,   "default": "Unknown"},
    "bhk":          {"type": int,   "default": 0},
    "amenities":    {"type": list,  "default": []},
    "propertyType": {"type": str,   "default": "unknown"},
    "sellerName":   {"type": str,   "default": "Unknown"},
    "sellerType":   {"type": str,   "default": "Unknown"},
    "ownerName":    {"type": str,   "default": ""},
    "companyName":  {"type": str,   "default": ""},
    "imageUrl":     {"type": str,   "default": ""},
    "landmark":     {"type": str,   "default": ""},
    "postedDate":   {"type": str,   "default": ""},
}


def _coerce(value, target_type, default):
    """Coerce a value to the target type, returning default on failure."""
    if value is None:
        return default
    if target_type == int:
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return default
    if target_type == str:
        return str(value) if value else default
    if target_type == list:
        if isinstance(value, list):
            return value
        if isinstance(value, str) and value:
            return [v.strip() for v in value.split(",") if v.strip()]
        return default
    return value


def validate_listing(raw: dict) -> dict:
    """
    Validate and normalize a raw scraped listing dict against the schema.
    - Missing fields → filled with defaults
    - Wrong types → coerced or default
    - Extra fields → dropped
    Returns a clean dict matching the schema exactly.
    """
    clean = {}
    for field, spec in LISTING_SCHEMA.items():
        raw_value = raw.get(field)
        clean[field] = _coerce(raw_value, spec["type"], spec["default"])
    return clean


def validate_listings(raw_list: list) -> list:
    """Validate a list of raw listings. Skips items that fail validation."""
    results = []
    for item in raw_list:
        try:
            results.append(validate_listing(item))
        except Exception:
            continue
    return results


def get_schema_fields() -> list:
    """Return the list of field names in the schema."""
    return list(LISTING_SCHEMA.keys())


if __name__ == "__main__":
    import json
    # Demo: validate an empty dict to show defaults
    print("Schema fields:", get_schema_fields())
    print("Empty listing defaults:")
    print(json.dumps(validate_listing({}), indent=2))
