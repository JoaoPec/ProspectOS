"""Google Places API search — replaces the google-maps-scraper binary.

Uses the same GOOGLE_API_KEY from .env (Gemini key works for Places API
because we enabled it in GCloud). Falls back gracefully if key not set."""

import csv
import os
import time
from pathlib import Path

import requests

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
_HAS_KEY = bool(GOOGLE_API_KEY)

FIELD_MASK = (
    "places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.websiteUri,"
    "places.googleMapsUri,places.rating,places.userRatingCount,"
    "places.id"
)

HEADERS_CSV = ["input_id", "title", "address", "website", "phone", "review_rating", "review_count"]


def buscar_por_texto(query, arquivo_saida, max_results=20):
    """Search Places API by text query, write CSV matching scraper format."""
    if not _HAS_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada no .env")

    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body = {"textQuery": query, "languageCode": "pt-BR", "maxResultCount": max_results}

    resp = requests.post(url, json=body, headers=headers, timeout=15)
    resp.raise_for_status()
    places = resp.json().get("places", [])

    arquivo = Path(arquivo_saida)
    arquivo.parent.mkdir(parents=True, exist_ok=True)

    with open(arquivo, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS_CSV)
        writer.writeheader()
        for i, p in enumerate(places):
            nome = p.get("displayName", {}).get("text", "")
            endereco = p.get("formattedAddress", "")
            website = p.get("websiteUri", "")
            telefone = p.get("nationalPhoneNumber", "")
            rating = p.get("rating", 0) or 0
            reviews = p.get("userRatingCount", 0) or 0

            writer.writerow({
                "input_id": f"places_{i}",
                "title": nome,
                "address": endereco,
                "website": website,
                "phone": telefone,
                "review_rating": f"{rating:.1f}" if rating else "",
                "review_count": str(reviews),
            })

    return len(places)
