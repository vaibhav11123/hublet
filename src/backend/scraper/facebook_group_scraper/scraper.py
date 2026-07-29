"""
scraper.py — Facebook Group Scraper using Apify.

Scrapes posts from one or more Facebook groups and returns a DataFrame.
Groups are loaded from groups.txt (one URL per line).
"""
import pandas as pd
from apify_client import ApifyClient
from apify_client.errors import ApifyApiError

import settings


def _candidate_view_options(preferred: str) -> list[str]:
    """Return unique view-option candidates in preferred-first order."""
    normalized = (preferred or "").strip().upper()
    candidates = [normalized, "CHRONOLOGICAL", "RECENT", "TOP_POSTS"]
    return [opt for opt in dict.fromkeys(candidates) if opt]


def _is_x402_payment_error(exc: Exception) -> bool:
    """Detect x402 paid-gateway failures returned by actor endpoints."""
    msg = str(exc)
    return "PAYMENT-SIGNATURE" in msg or "x402.org" in msg


def _run_actor_with_fallback(client: ApifyClient, run_input: dict) -> tuple[list[dict], str]:
    """Try configured actor IDs in order and return (items, actor_id) on first success."""
    last_error = None

    for actor_id in settings.APIFY_ACTOR_FALLBACK_IDS:
        try:
            print(f"[SCRAPER] Trying Apify actor: {actor_id}")
            run = client.actor(actor_id).call(run_input=run_input)
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
            return items, actor_id
        except ApifyApiError as exc:
            last_error = exc
            # If actor is behind x402 billing, try the next fallback actor.
            if _is_x402_payment_error(exc):
                print(f"[SCRAPER] Actor {actor_id} requires x402 payment headers, trying fallback...")
                continue
            # Non-payment API errors should fail immediately.
            raise

    if last_error is not None:
        raise RuntimeError(
            "All configured Apify actors failed. The current actor(s) may require paid x402 access. "
            "Set APIFY_ACTOR_ID_FB in .env to a working actor ID. "
            f"Last error: {last_error}"
        )

    raise RuntimeError("No Apify actor IDs configured for Facebook scraping.")


def load_group_urls(path: str = settings.GROUPS_FILE) -> list[str]:
    """
    Read group URLs from a text file.
    Ignores blank lines and lines starting with #.
    """
    urls = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    if not urls:
        raise ValueError(f"No group URLs found in {path}")
    print(f"[SCRAPER] Loaded {len(urls)} group URL(s) from {path}")
    return urls


def scrape_group(
    group_url: str,
    limit: int = settings.RESULTS_LIMIT,
    view_option: str = settings.VIEW_OPTION,
) -> pd.DataFrame:
    """
    Scrape a single Facebook group using the Apify actor.

    Returns:
        DataFrame with the raw scraped data.
    """
    print(f"\n[SCRAPER] Scraping: {group_url}")
    print(f"   Limit: {limit} | View: {view_option}")

    if not settings.APIFY_TOKEN:
        raise RuntimeError(
            "APIFY token is missing. Set APIFY_TOKEN_FB (or APIFY_TOKEN) in src/backend/.env and retry."
        )

    if not settings.APIFY_ACTOR_FALLBACK_IDS:
        raise RuntimeError(
            "APIFY_ACTOR_ID_FB is missing. Set a single actor ID/slug in src/backend/.env and retry."
        )

    client = ApifyClient(settings.APIFY_TOKEN)

    last_actor_id = "-"
    for candidate_view in _candidate_view_options(view_option):
        run_input = {
            "startUrls": [{"url": group_url}],
            "resultsLimit": limit,
            "viewOption": candidate_view,
        }

        items, actor_id = _run_actor_with_fallback(client, run_input)
        last_actor_id = actor_id
        if items:
            df = pd.DataFrame(items)
            print(
                f"[OK] Scraped {len(df)} posts from this group "
                f"(actor: {actor_id}, view: {candidate_view})"
            )
            return df

        print(f"[SCRAPER] 0 posts with view={candidate_view}; trying next view option...")

    print(
        "[SCRAPER][WARN] Actor run succeeded but returned 0 posts for all view options "
        f"(actor: {last_actor_id})."
    )
    return pd.DataFrame()


def scrape_all_groups(
    urls: list[str] = None,
    limit: int = settings.RESULTS_LIMIT,
    view_option: str = settings.VIEW_OPTION,
) -> pd.DataFrame:
    """
    Scrape all groups listed in groups.txt.
    Combines results into a single DataFrame.
    """
    if urls is None:
        urls = load_group_urls()

    all_dfs = []
    for url in urls:
        try:
            df = scrape_group(url, limit, view_option)
            all_dfs.append(df)
        except RuntimeError as exc:
            # Keep pipeline alive when an actor becomes unavailable/paid-only.
            print(f"[SCRAPER][WARN] Failed for {url}: {exc}")
            continue

    if not all_dfs:
        print("\n[SCRAPER][WARN] No groups were scraped successfully. Returning empty dataset.")
        return pd.DataFrame()

    combined = pd.concat(all_dfs, ignore_index=True)
    print(f"\n[DONE] Total scraped: {len(combined)} posts from {len(urls)} group(s)")
    return combined


def save_raw(df: pd.DataFrame, path: str = settings.RAW_CSV) -> None:
    """Save the raw scraped DataFrame to CSV."""
    df.to_csv(path, index=False)
    print(f"[SAVE] Saved raw data -> {path}")


if __name__ == "__main__":
    import os
    os.makedirs(settings.DATA_DIR, exist_ok=True)

    df = scrape_all_groups()
    save_raw(df)
