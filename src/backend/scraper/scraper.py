"""
Scraper entry point — registry-based dispatch.
Usage:
  python scraper.py --scraper magicbricks-direct --city mumbai --limit 10
  python scraper.py --list-scrapers
"""

import argparse
import json
import sys
import os
from registry import list_scrapers, get_scraper


def _load_env_file(path):
    """Load KEY=VALUE pairs from .env into os.environ without overriding existing vars."""
    if not os.path.exists(path):
        return

    with open(path, 'r', encoding='utf-8') as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith('#'):
                continue

            if line.startswith('export '):
                line = line[len('export '):].strip()

            if '=' not in line:
                continue

            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            if key and key not in os.environ:
                os.environ[key] = value


def _load_runtime_env():
    """Load local and parent .env files for local development runs."""
    base_dir = os.path.dirname(__file__)
    for env_path in (
        os.path.join(base_dir, '.env'),
        os.path.join(base_dir, '..', '.env'),
    ):
        _load_env_file(env_path)


_load_runtime_env()


def main():
    parser = argparse.ArgumentParser(description='Modular real estate listing scraper.')
    parser.add_argument('--scraper', type=str, default='magicbricks-direct',
                        help='Scraper to use (run --list-scrapers to see available)')
    parser.add_argument('--city', type=str, help='City to scrape (e.g., mumbai, delhi, hyderabad)')
    parser.add_argument('--limit', type=int, default=10, help='Max number of listings to scrape')
    parser.add_argument('--token', type=str, default=None, help='Apify API token (for Apify scrapers)')
    parser.add_argument('--zenrows-key', type=str, default=None, help='ZenRows API key (for ZenRows scrapers)')
    parser.add_argument('--list-scrapers', action='store_true', help='List all available scrapers and exit')

    args = parser.parse_args()

    # List scrapers mode
    if args.list_scrapers:
        scrapers = list_scrapers()
        print(json.dumps(scrapers, indent=2))
        return

    # Validate required args
    if not args.city:
        parser.error("--city is required when scraping (not using --list-scrapers)")

    # Get scraper
    scraper_entry = get_scraper(args.scraper)
    if not scraper_entry:
        available = [s["name"] for s in list_scrapers()]
        print(json.dumps({"error": f"Unknown scraper '{args.scraper}'. Available: {available}"}), file=sys.stderr)
        sys.exit(1)

    # Build kwargs based on what the scraper needs
    kwargs = {}
    if scraper_entry["needs_token"] == "apify":
        kwargs["token"] = args.token
    elif scraper_entry["needs_token"] == "zenrows":
        kwargs["zenrows_key"] = args.zenrows_key

    try:
        listings = scraper_entry["fn"](args.city, args.limit, **kwargs)
        # Output JSON to stdout so Node.js can capture it
        print(json.dumps(listings))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
