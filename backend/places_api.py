"""Google Places API search — replaces the google-maps-scraper binary.

Uses GOOGLE_API_KEY from .env. Falls back gracefully if key not set.
Supports nextPageToken pagination to get up to 60 results per search."""

import csv
import os
from pathlib import Path

import requests

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
_HAS_KEY = bool(GOOGLE_API_KEY)

FIELD_MASK = (
    "places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.websiteUri,"
    "places.googleMapsUri,places.rating,places.userRatingCount,"
    "places.id,nextPageToken"
)

HEADERS_CSV = ["input_id", "title", "address", "website", "phone", "review_rating", "review_count"]
MAX_PAGINAS = 3   # ate 3 paginas de 20 = 60 resultados


def buscar_por_texto(query, arquivo_saida, max_results=60):
    """Search Places API by text query with pagination, write CSV."""
    if not _HAS_KEY:
        raise RuntimeError("GOOGLE_API_KEY nao configurada no .env")

    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    todos = []
    page_token = None

    for pagina in range(MAX_PAGINAS):
        body = {
            "textQuery": query,
            "languageCode": "pt-BR",
            "maxResultCount": min(max_results, 20),
        }
        if page_token:
            body["pageToken"] = page_token

        resp = requests.post(url, json=body, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        lugares = data.get("places", [])
        todos.extend(lugares)

        page_token = data.get("nextPageToken")
        if not page_token or len(lugares) < 20:
            break

    arquivo = Path(arquivo_saida)
    arquivo.parent.mkdir(parents=True, exist_ok=True)

    with open(arquivo, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS_CSV)
        writer.writeheader()
        for i, p in enumerate(todos):
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

    return len(todos)
