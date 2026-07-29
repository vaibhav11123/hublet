#!/usr/bin/env python3
"""
Test script — runs all 5 scrapers one by one and writes a formatted comparison report.
Usage:
    python test_all_scrapers.py [--city mumbai] [--limit 3]

Results are written to: scraper_test_results.txt
"""

import subprocess
import json
import sys
import os
import time
from datetime import datetime


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
    """Load local and parent .env files so token-gated scrapers run in local dev."""
    base_dir = os.path.dirname(__file__)
    for env_path in (
        os.path.join(base_dir, '.env'),
        os.path.join(base_dir, '..', '.env'),
    ):
        _load_env_file(env_path)


_load_runtime_env()

# Config
_LOCAL_VENV_PYTHON = os.path.join(os.path.dirname(__file__), 'venv/bin/python')
# Prefer active interpreter so the script works in system/conda/venv setups.
PYTHON = _LOCAL_VENV_PYTHON if os.path.exists(_LOCAL_VENV_PYTHON) else sys.executable
SCRAPER_SCRIPT = os.path.join(os.path.dirname(__file__), 'scraper.py')
DEFAULT_CITY = 'mumbai'
DEFAULT_LIMIT = 1
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'scraper_test_results.txt')

SCRAPERS = [
    "magicbricks-direct",
    "magicbricks-apify",
    "99acres-direct",
    "99acres-apify",
    "99acres-zenrows",
]

SCHEMA_FIELDS = [
    "title", "price", "area", "locality", "city", "description",
    "sourceUrl", "externalId", "source", "bhk", "amenities",
    "propertyType", "sellerName", "sellerType", "ownerName",
    "companyName", "imageUrl", "landmark", "postedDate",
]


def run_scraper(scraper_name, city, limit):
    """Run a single scraper and return (listings, error, duration)."""
    cmd = [PYTHON, SCRAPER_SCRIPT, '--scraper', scraper_name, '--city', city, '--limit', str(limit)]

    # Add tokens from env if available
    apify_token = os.environ.get('APIFY_TOKEN', '')
    zenrows_key = os.environ.get('ZENROWS_API_KEY', '')

    if 'apify' in scraper_name and apify_token:
        cmd.extend(['--token', apify_token])
    if 'zenrows' in scraper_name and zenrows_key:
        cmd.extend(['--zenrows-key', zenrows_key])

    start = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=360)
        duration = time.time() - start

        if result.returncode != 0:
            err_text = result.stderr.strip()
            try:
                err_payload = json.loads(err_text)
                if isinstance(err_payload, dict) and err_payload.get("error"):
                    err_text = err_payload["error"]
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
            return None, err_text, duration

        listings = json.loads(result.stdout)
        return listings, None, duration

    except subprocess.TimeoutExpired:
        return None, "TIMEOUT (>6 min)", time.time() - start
    except json.JSONDecodeError as e:
        return None, f"Invalid JSON: {e}", time.time() - start
    except Exception as e:
        return None, str(e), time.time() - start


def truncate(text, max_len=60):
    """Truncate text for display."""
    if not text:
        return "(empty)"
    s = str(text).replace('\n', ' ').strip()
    return s[:max_len] + "..." if len(s) > max_len else s


def format_price(price):
    """Format price in lakhs/crores for readability."""
    if not price or price == 0:
        return "₹0 (N/A)"
    if price >= 10000000:
        return f"₹{price / 10000000:.2f} Cr"
    elif price >= 100000:
        return f"₹{price / 100000:.2f} Lac"
    else:
        return f"₹{price:,}"


def write_report(results, city, limit, output_file):
    """Write a nicely formatted comparison report."""
    lines = []
    sep = "=" * 100
    thin_sep = "-" * 100
    dot_sep = "·" * 100

    lines.append(sep)
    lines.append(f"  SCRAPER COMPARISON REPORT")
    lines.append(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"  City: {city}  |  Limit: {limit}")
    lines.append(sep)
    lines.append("")

    # ── Summary Table ──
    lines.append("┌─────────────────────────┬──────────┬───────────┬────────────────────────────────┐")
    lines.append("│ Scraper                 │ Listings │ Time (s)  │ Status                         │")
    lines.append("├─────────────────────────┼──────────┼───────────┼────────────────────────────────┤")

    for name, data in results.items():
        listings = data.get("listings")
        error = data.get("error")
        duration = data.get("duration", 0)
        count = len(listings) if listings else 0

        if error:
            status = truncate(error, 30)
        elif count == 0:
            status = "OK (0 results)"
        else:
            status = f"✓ OK"

        lines.append(f"│ {name:<23} │ {count:>8} │ {duration:>8.1f}s │ {status:<30} │")

    lines.append("└─────────────────────────┴──────────┴───────────┴────────────────────────────────┘")
    lines.append("")
    lines.append("")

    # ── Field Coverage Matrix ──
    lines.append(sep)
    lines.append("  FIELD COVERAGE MATRIX")
    lines.append("  ✓ = has data  |  ✗ = missing/empty/default  |  - = scraper failed")
    lines.append(sep)
    lines.append("")

    # Header
    scraper_short = {
        "magicbricks-direct": "MB-Dir",
        "magicbricks-apify": "MB-Api",
        "99acres-direct": "99a-Dir",
        "99acres-apify": "99a-Api",
        "99acres-zenrows": "99a-Zen",
    }

    header = f"  {'Field':<16}"
    for name in SCRAPERS:
        header += f" │ {scraper_short.get(name, name[:7]):^7}"
    lines.append(header)
    lines.append(f"  {'─' * 16}" + "─┼─".join(["─" * 7 for _ in SCRAPERS]) + "──")

    for field in SCHEMA_FIELDS:
        row = f"  {field:<16}"
        for name in SCRAPERS:
            data = results.get(name, {})
            listings = data.get("listings")
            if not listings:
                row += f" │ {'  -  ':^7}"
                continue

            # Check if ANY listing has a non-empty/non-default value for this field
            has_data = False
            for listing in listings:
                val = listing.get(field)
                if val is not None and val != "" and val != 0 and val != [] and val != "Unknown" and val != "unknown" and val != "Unknown Property":
                    has_data = True
                    break

            row += f" │ {'  ✓  ' if has_data else '  ✗  ':^7}"
        lines.append(row)

    lines.append("")
    lines.append("")

    # ── Detailed Output Per Scraper ──
    for name in SCRAPERS:
        data = results.get(name, {})
        listings = data.get("listings")
        error = data.get("error")
        duration = data.get("duration", 0)

        lines.append(sep)
        lines.append(f"  SCRAPER: {name}")
        lines.append(f"  Duration: {duration:.1f}s  |  Results: {len(listings) if listings else 0}")
        lines.append(sep)

        if error:
            lines.append(f"  ❌ ERROR: {error}")
            lines.append("")
            continue

        if not listings:
            lines.append("  ⚠ No listings returned (page may have changed or blocked request).")
            lines.append("")
            continue

        for i, listing in enumerate(listings):
            lines.append("")
            lines.append(f"  ── Listing {i + 1} ────────────────────────────────────────────────")
            lines.append("")

            for field in SCHEMA_FIELDS:
                val = listing.get(field)
                label = f"    {field:<16}"

                if field == "price":
                    display = format_price(val)
                elif field == "amenities":
                    if isinstance(val, list) and val:
                        display = ", ".join(val[:5])
                        if len(val) > 5:
                            display += f" (+{len(val) - 5} more)"
                    else:
                        display = "(none)"
                elif field == "description":
                    display = truncate(val, 80)
                elif field == "sourceUrl":
                    display = truncate(val, 80)
                else:
                    display = truncate(str(val), 80) if val else "(empty)"

                # Mark empty/default values
                is_empty = val is None or val == "" or val == 0 or val == [] or val == "Unknown" or val == "unknown"
                marker = "  ◄ N/A" if is_empty else ""

                lines.append(f"{label} : {display}{marker}")

        lines.append("")

    # ── Footer ──
    lines.append(sep)
    lines.append(f"  End of report. File: {output_file}")
    lines.append(sep)

    # Write to file
    report = "\n".join(lines)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)

    return report


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Test all scrapers and generate comparison report.')
    parser.add_argument('--city', default=DEFAULT_CITY, help=f'City to scrape (default: {DEFAULT_CITY})')
    parser.add_argument('--limit', type=int, default=DEFAULT_LIMIT, help=f'Listings per scraper (default: {DEFAULT_LIMIT})')
    parser.add_argument('--output', default=OUTPUT_FILE, help=f'Output file path (default: {OUTPUT_FILE})')
    parser.add_argument('--scrapers', nargs='*', default=None, help='Specific scrapers to test (default: all)')
    args = parser.parse_args()

    scrapers_to_test = args.scrapers if args.scrapers else SCRAPERS

    print(f"\n{'=' * 60}")
    print(f"  Testing {len(scrapers_to_test)} scrapers for city: {args.city}")
    print(f"  Limit: {args.limit} listings each")
    print(f"{'=' * 60}\n")

    results = {}

    for i, name in enumerate(scrapers_to_test, 1):
        print(f"  [{i}/{len(scrapers_to_test)}] Running: {name} ...", end=" ", flush=True)

        # Check if token is needed and missing
        needs_skip = False
        if 'apify' in name and not os.environ.get('APIFY_TOKEN'):
            print("⏭ SKIPPED (no APIFY_TOKEN)")
            results[name] = {"listings": None, "error": "SKIPPED: APIFY_TOKEN not set", "duration": 0}
            continue
        if 'zenrows' in name and not os.environ.get('ZENROWS_API_KEY'):
            print("⏭ SKIPPED (no ZENROWS_API_KEY)")
            results[name] = {"listings": None, "error": "SKIPPED: ZENROWS_API_KEY not set", "duration": 0}
            continue

        listings, error, duration = run_scraper(name, args.city, args.limit)

        if error:
            print(f"❌ ERROR ({duration:.1f}s)")
        elif listings and len(listings) > 0:
            print(f"✓ {len(listings)} listings ({duration:.1f}s)")
        else:
            print(f"⚠ 0 listings ({duration:.1f}s)")

        results[name] = {"listings": listings, "error": error, "duration": duration}

    # Write report
    print(f"\n  Writing report to: {args.output}")
    report = write_report(results, args.city, args.limit, args.output)

    # Print report to console too
    print(f"\n{report}")


if __name__ == "__main__":
    main()
