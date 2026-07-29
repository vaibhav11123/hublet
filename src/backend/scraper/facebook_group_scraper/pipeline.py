"""
pipeline.py — Main entry point for the Facebook Real Estate Pipeline.

Usage:
    python pipeline.py                 # Run full pipeline (scrape + extract)
    python pipeline.py --scrape-only   # Only scrape, save raw CSV
    python pipeline.py --extract-only  # Only extract from existing raw CSV
"""
import argparse
import os
import sys

import pandas as pd

import settings
from scraper import scrape_all_groups, save_raw
from extractor import GroqExtractor, save_extracted


def run_scrape() -> pd.DataFrame:
    """Step 1: Scrape Facebook group posts from all groups in groups.txt."""
    print("=" * 55)
    print("  STEP 1 — Scraping Facebook Groups")
    print("=" * 55)
    df = scrape_all_groups()
    save_raw(df)
    return df


def run_extract(raw_df: pd.DataFrame = None) -> pd.DataFrame:
    """Step 2: Extract structured data via LLM."""
    print("\n" + "=" * 55)
    print("  STEP 2 — Extracting Structured Data (Groq LLM)")
    print("=" * 55)

    if raw_df is None:
        if not os.path.exists(settings.RAW_CSV):
            print(f"❌ No raw data found at {settings.RAW_CSV}")
            print("   Run with --scrape-only first, or run the full pipeline.")
            sys.exit(1)
        raw_df = pd.read_csv(settings.RAW_CSV)

    if raw_df.empty:
        print("[EXTRACT][WARN] Raw scrape result is empty. Writing empty extracted output.")
        empty_df = pd.DataFrame(columns=settings.EXPECTED_COLUMNS)
        save_extracted(empty_df)
        return empty_df

    extractor = GroqExtractor()
    result_df = extractor.extract_all(raw_df)
    save_extracted(result_df)
    return result_df


def main():
    parser = argparse.ArgumentParser(
        description="Facebook Real Estate Scraping & Extraction Pipeline"
    )
    parser.add_argument(
        "--scrape-only",
        action="store_true",
        help="Only scrape the Facebook group (skip extraction)",
    )
    parser.add_argument(
        "--extract-only",
        action="store_true",
        help="Only run extraction on existing raw CSV (skip scraping)",
    )
    args = parser.parse_args()

    # Ensure data directory exists
    os.makedirs(settings.DATA_DIR, exist_ok=True)

    print("\n[Facebook Real Estate Pipeline]")
    print("-" * 55)

    if args.scrape_only:
        run_scrape()
        print("\nScraping complete.")

    elif args.extract_only:
        run_extract()
        print("\nExtraction complete.")

    else:
        # Full pipeline
        raw_df = run_scrape()
        run_extract(raw_df)
        print("\n✅ Full pipeline complete.")

    print(f"\n📁 Output directory: {settings.DATA_DIR}/")


if __name__ == "__main__":
    main()
