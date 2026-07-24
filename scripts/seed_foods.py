#!/usr/bin/env python3
"""
Transform an Open Food Facts CSV export into a foods table import CSV.

Usage:
    python scripts/seed_foods.py <input_off_csv> <output_csv>

The output CSV can be loaded into Supabase with:
    psql <connection_string> -c "\COPY foods(name,brand,barcode,serving_size_g,calories,protein_g,carbs_g,fat_g,fiber_g,sodium_mg,image_url) FROM '<output_csv>' CSV HEADER"

Filters applied (in order):
    1. Must have a product_name
    2. Must have calories + protein + carbs + fat (all non-negative)
    3. no_nutrition_data must be null or "off" (not "on" / "true")
    4. completeness >= 0.3 (OFF's own quality score, 0–1)
    5. countries_en must contain "United States" or "Canada"
    6. data_quality_errors_tags must not contain known bad-data tags
       (nutrition values > 105g/100g, implausible energy values)
    7. Deduplicated on barcode — one row per barcode, keeping the most complete entry
"""

import csv
import sys
import argparse
from collections import defaultdict

OFF_COLUMNS = {
    "name": "product_name",
    "brand": "brands",
    "barcode": "code",
    "calories": "energy-kcal_100g",
    "protein_g": "proteins_100g",
    "carbs_g": "carbohydrates_100g",
    "fat_g": "fat_100g",
    "fiber_g": "fiber_100g",
    "sodium_mg": "sodium_100g",
    "image_url": "image_url",
    # filter-only columns
    "no_nutrition_data": "no_nutrition_data",
    "completeness": "completeness",
    "countries_en": "countries_en",
    "data_quality_errors_tags": "data_quality_errors_tags",
}

OUTPUT_COLUMNS = [
    "name", "brand", "barcode", "serving_size_g",
    "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "image_url",
]

# Nutrition quality error tags that indicate the row's values are unreliable
BAD_QUALITY_TAGS = {
    "en:nutrition-value-total-over-105",
    "en:nutrition-value-over-105-carbohydrates",
    "en:nutrition-value-over-105-fat",
    "en:nutrition-value-over-105-proteins",
    "en:nutrition-value-over-3800-energy",
}

COMPLETENESS_MIN = 0.3

# Case-insensitive substrings to match in countries_en
ALLOWED_COUNTRIES = ("united states", "canada")


def parse_float(value: str) -> float | None:
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def has_bad_quality_tags(tags_str: str) -> bool:
    if not tags_str:
        return False
    tags = {t.strip() for t in tags_str.split(",")}
    return bool(tags & BAD_QUALITY_TAGS)


def is_allowed_country(countries_str: str) -> bool:
    if not countries_str:
        return False
    lower = countries_str.lower()
    return any(c in lower for c in ALLOWED_COUNTRIES)


def transform(input_path: str, output_path: str) -> None:
    written = 0
    skipped = 0

    # barcode -> (completeness, row_dict) for deduplication
    best_by_barcode: dict[str, tuple[float, dict]] = {}
    no_barcode_rows: list[dict] = []

    print("Pass 1: reading and filtering...", flush=True)

    with open(input_path, encoding="utf-8", errors="replace") as infile:
        csv.field_size_limit(sys.maxsize)
        reader = csv.DictReader(infile, delimiter="\t")

        for i, row in enumerate(reader):
            if i % 500_000 == 0 and i > 0:
                print(f"  {i:,} rows read...", flush=True)

            # 1. Must have a name
            name = row.get(OFF_COLUMNS["name"], "").strip()
            if not name:
                skipped += 1
                continue

            # 2. Require calories + all three macros, non-negative
            calories = parse_float(row.get(OFF_COLUMNS["calories"], ""))
            protein  = parse_float(row.get(OFF_COLUMNS["protein_g"], ""))
            carbs    = parse_float(row.get(OFF_COLUMNS["carbs_g"], ""))
            fat      = parse_float(row.get(OFF_COLUMNS["fat_g"], ""))

            if not all(v is not None and v >= 0 for v in [calories, protein, carbs, fat]):
                skipped += 1
                continue

            # 3. no_nutrition_data must be null or "off"
            no_nutrition = row.get(OFF_COLUMNS["no_nutrition_data"], "").strip().lower()
            if no_nutrition and no_nutrition != "off":
                skipped += 1
                continue

            # 4. completeness >= 0.3
            completeness = parse_float(row.get(OFF_COLUMNS["completeness"], ""))
            if completeness is None or completeness < COMPLETENESS_MIN:
                skipped += 1
                continue

            # 5. Country filter: US or Canada only
            if not is_allowed_country(row.get(OFF_COLUMNS["countries_en"], "")):
                skipped += 1
                continue

            # 6. Drop rows with known bad nutrition quality tags
            if has_bad_quality_tags(row.get(OFF_COLUMNS["data_quality_errors_tags"], "")):
                skipped += 1
                continue

            sodium_g = parse_float(row.get(OFF_COLUMNS["sodium_mg"], ""))

            out_row = {
                "name":         name,
                "brand":        row.get(OFF_COLUMNS["brand"], "").strip() or None,
                "barcode":      row.get(OFF_COLUMNS["barcode"], "").strip() or None,
                "serving_size_g": 100,
                "calories":     calories,
                "protein_g":    protein,
                "carbs_g":      carbs,
                "fat_g":        fat,
                "fiber_g":      parse_float(row.get(OFF_COLUMNS["fiber_g"], "")),
                "sodium_mg":    sodium_g * 1000 if sodium_g is not None else None,
                "image_url":    row.get(OFF_COLUMNS["image_url"], "").strip() or None,
                "_completeness": completeness,
            }

            # 7. Deduplicate on barcode — keep the most complete entry per barcode
            barcode = out_row["barcode"]
            if barcode:
                existing = best_by_barcode.get(barcode)
                if existing is None or completeness > existing[0]:
                    best_by_barcode[barcode] = (completeness, out_row)
            else:
                no_barcode_rows.append(out_row)

    print(f"Pass 1 done. {skipped:,} rows filtered out.", flush=True)
    print("Pass 2: writing output...", flush=True)

    with open(output_path, "w", newline="", encoding="utf-8") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
        writer.writeheader()

        for _, out_row in best_by_barcode.values():
            writer.writerow(out_row)
            written += 1

        for out_row in no_barcode_rows:
            writer.writerow(out_row)
            written += 1

        if written % 100_000 == 0 and written > 0:
            print(f"  {written:,} rows written...", flush=True)

    print(f"Done. {written:,} rows written, {skipped:,} skipped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Transform OFF CSV for foods table import")
    parser.add_argument("input", help="Path to the Open Food Facts CSV export")
    parser.add_argument("output", help="Path for the output CSV")
    args = parser.parse_args()
    transform(args.input, args.output)


if __name__ == "__main__":
    main()
