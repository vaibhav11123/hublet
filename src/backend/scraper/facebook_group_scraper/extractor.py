"""
extractor.py — Structured data extraction using Groq LLM.

Reads raw Facebook listings and extracts structured real estate fields.
"""
import json
import time

import pandas as pd
from openai import OpenAI

import settings


class GroqExtractor:
    """Wraps the Groq LLM client for real estate data extraction."""

    def __init__(
        self,
        api_key: str = settings.GROQ_API_KEY,
        base_url: str = settings.GROQ_BASE_URL,
        model: str = settings.GROQ_MODEL,
    ):
        if not api_key:
            raise RuntimeError("Missing Groq API key. Set GROQ_API_KEY_1 or GROQ_API_KEY_2 in src/backend/.env")
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.prompt = settings.EXTRACTION_PROMPT

    # ── Single row extraction ──────────────────────────

    def extract_one(
        self, title: str, text: str, location: str, price: str, post_time: str
    ) -> dict:
        """
        Send one listing to the LLM and return a dict of extracted fields.
        Returns a fallback dict on error.
        """
        listing_info = (
            f"TITLE: {title}\n"
            f"TEXT: {text}\n"
            f"LOCATION: {location}\n"
            f"PRICE: {price}\n"
            f"POST TIME: {post_time}"
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.prompt},
                    {"role": "user", "content": listing_info},
                ],
                temperature=settings.LLM_TEMPERATURE,
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)

        except Exception as e:
            print(f"  [ERROR] {e}")
            return self._fallback(title)

    # ── Batch extraction ───────────────────────────────

    def extract_all(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Process every valid row in the raw DataFrame.

        - Filters rows with no useful info
        - Deduplicates raw input by (title, location, price)
        - Sends each unique listing to the LLM
        - Deduplicates final output by (TITLE, LOCALITY, PRICE)
        """
        text_col = df.get("text", pd.Series(index=df.index, dtype=str)).fillna("")
        title_col = df.get("title", pd.Series(index=df.index, dtype=str)).fillna("")
        location_col = df.get("location", pd.Series(index=df.index, dtype=str)).fillna("")
        price_col = df.get("price", pd.Series(index=df.index, dtype=str)).fillna("")
        time_col = df.get("time", pd.Series(index=df.index, dtype=str)).fillna("")
        fb_url_col = df.get("facebookUrl", pd.Series(index=df.index, dtype=str)).fillna("")

        # Filter rows with useful info
        valid_mask = (text_col.str.strip() != "") | (title_col.str.strip() != "")
        valid_df = df[valid_mask].copy()
        total_valid = len(valid_df)

        # Deduplicate raw input by (title, location, price)
        before_dedup = len(valid_df)
        subset = [col for col in ["title", "location", "price"] if col in valid_df.columns]
        if subset:
            valid_df = valid_df.drop_duplicates(subset=subset, keep="first")
        dupes_removed = before_dedup - len(valid_df)
        total = len(valid_df)

        print(f"📊 {len(df)} rows loaded, {total_valid} valid, {dupes_removed} duplicates removed")
        print(f"   → {total} unique listings to process\n")

        results = []
        for i, (idx, row) in enumerate(valid_df.iterrows()):
            title = str(row.get("title", "")).strip()
            text = str(row.get("text", "")).strip()
            location = str(row.get("location", "")).strip()
            price = str(row.get("price", "")).strip()
            post_time = str(row.get("time", "")).strip()
            group_url = str(row.get("facebookUrl", "")).strip()

            print(f"[{i + 1}/{total}] {title[:65]}")

            extracted = self.extract_one(title, text, location, price, post_time)
            extracted["GROUP_URL"] = group_url or "-"
            results.append(extracted)

            if i < total - 1:
                time.sleep(settings.API_DELAY_SECONDS)

        out_df = pd.DataFrame(results)

        # Ensure every expected column exists
        for col in settings.EXPECTED_COLUMNS:
            if col not in out_df.columns:
                out_df[col] = "-"

        out_df = out_df[settings.EXPECTED_COLUMNS]

        # Final deduplication on extracted output
        before_final = len(out_df)
        out_df = out_df.drop_duplicates(
            subset=["TITLE", "LOCALITY", "PRICE"], keep="first"
        ).reset_index(drop=True)
        final_dupes = before_final - len(out_df)
        if final_dupes > 0:
            print(f"\n[DEDUPLICATION] Removed {final_dupes} duplicate(s) from extracted output")

        return out_df

    # ── Helpers ────────────────────────────────────────

    @staticmethod
    def _fallback(title: str) -> dict:
        """Return a dict of dashes for when extraction fails."""
        return {col: "-" for col in settings.EXPECTED_COLUMNS} | {
            "TITLE": title or "-"
        }


def save_extracted(df: pd.DataFrame, path: str = settings.EXTRACTED_CSV) -> None:
    """Save the extracted DataFrame to CSV."""
    df.to_csv(path, index=False)
    print(f"\n💾 Saved {len(df)} extracted listings → {path}")


if __name__ == "__main__":
    import os
    os.makedirs(settings.DATA_DIR, exist_ok=True)

    raw_df = pd.read_csv(settings.RAW_CSV)
    extractor = GroqExtractor()
    result_df = extractor.extract_all(raw_df)
    save_extracted(result_df)
