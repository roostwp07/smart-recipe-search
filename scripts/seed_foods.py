#!/usr/bin/env python3
"""
Transform an Open Food Facts CSV export into a foods table import CSV.

Usage:
    python scripts/seed_foods.py <input_off_csv> <output_csv>

The output CSV can be loaded into Supabase with:
    psql <connection_string> -c "\COPY foods(name,brand,barcode,serving_size_g,calories,protein_g,carbs_g,fat_g,fiber_g,sodium_mg) FROM '<output_csv>' CSV HEADER"
"""

import csv
import sys
import argparse

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
    "image_url": "image_front_url",
}

OUTPUT_COLUMNS = [
    "name", "brand", "barcode", "serving_size_g",
    "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "image_url",
]


def parse_float(value: str) -> float | None:
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def transform(input_path: str, output_path: str) -> None:
    written = 0
    skipped = 0

    with open(input_path, encoding="utf-8", errors="replace") as infile, \
         open(output_path, "w", newline="", encoding="utf-8") as outfile:

        csv.field_size_limit(sys.maxsize)
        reader = csv.DictReader(infile, delimiter="\t")
        writer = csv.DictWriter(outfile, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()

        for row in reader:
            name = row.get(OFF_COLUMNS["name"], "").strip()
            if not name:
                skipped += 1
                continue

            calories = parse_float(row.get(OFF_COLUMNS["calories"], ""))
            protein = parse_float(row.get(OFF_COLUMNS["protein_g"], ""))
            carbs = parse_float(row.get(OFF_COLUMNS["carbs_g"], ""))
            fat = parse_float(row.get(OFF_COLUMNS["fat_g"], ""))

            # Require at least calories + one macro to be present and non-negative
            has_calories = calories is not None and calories >= 0
            has_macro = any(v is not None and v >= 0 for v in [protein, carbs, fat])
            if not has_calories or not has_macro:
                skipped += 1
                continue

            sodium_g = parse_float(row.get(OFF_COLUMNS["sodium_mg"], ""))
            sodium_mg = sodium_g * 1000 if sodium_g is not None else None

            writer.writerow({
                "name": name,
                "brand": row.get(OFF_COLUMNS["brand"], "").strip() or None,
                "barcode": row.get(OFF_COLUMNS["barcode"], "").strip() or None,
                "serving_size_g": 100,
                "calories": calories,
                "protein_g": protein,
                "carbs_g": carbs,
                "fat_g": fat,
                "fiber_g": parse_float(row.get(OFF_COLUMNS["fiber_g"], "")),
                "sodium_mg": sodium_mg,
                "image_url": row.get(OFF_COLUMNS["image_url"], "").strip() or None,
            })
            written += 1

            if written % 100_000 == 0:
                print(f"  {written:,} rows written, {skipped:,} skipped...", flush=True)

    print(f"Done. {written:,} rows written, {skipped:,} skipped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Transform OFFs CSV for foods table import")
    parser.add_argument("input", help="Path to the Open Food Facts CSV export")
    parser.add_argument("output", help="Path for the output CSV")
    args = parser.parse_args()
    transform(args.input, args.output)


if __name__ == "__main__":
    main()
