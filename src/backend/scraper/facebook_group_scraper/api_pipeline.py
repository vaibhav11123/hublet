"""
api_pipeline.py — API-friendly entry point for the Facebook scraper pipeline.

Accepts --group-url and --limit as CLI args, runs scrape + extract,
and writes the final results as JSON to stdout.

Usage:
    python api_pipeline.py --group-url "https://..." --limit 10
"""
import argparse
import json
import os
import sys

# Ensure we can import local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import settings
from scraper import scrape_group
from extractor import GroqExtractor


def main():
    parser = argparse.ArgumentParser(description="FB Group Scraper API")
    parser.add_argument("--group-url", required=True, help="Facebook group URL")
    parser.add_argument("--limit", type=int, default=10, help="Number of posts to scrape")
    args = parser.parse_args()

    os.makedirs(settings.DATA_DIR, exist_ok=True)

    # Step 1: Scrape
    raw_df = scrape_group(args.group_url, limit=args.limit)

    if raw_df.empty:
        print(json.dumps([]))
        return

    # Step 2: Extract
    extractor = GroqExtractor()
    result_df = extractor.extract_all(raw_df)

    # Convert to list of dicts and output JSON
    records = result_df.to_dict(orient="records")

    # Ensure GROUP_URL is set on every record
    for rec in records:
        if not rec.get("GROUP_URL") or rec["GROUP_URL"] == "-":
            rec["GROUP_URL"] = args.group_url

    # Print JSON to stdout (the Node backend captures this)
    print(json.dumps(records, ensure_ascii=False))


if __name__ == "__main__":
    main()
