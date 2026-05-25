import os
import re
import time
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from supabase import create_client


BASE_URL = "https://tour.taitung.gov.tw"
START_URL = f"{BASE_URL}/zh-tw/tourism/spot"
SOUTH_LINK_TOWNS = ("大武", "太麻里", "金峰", "達仁")
FOOD_KEYWORDS = ("餐廳", "小吃", "味")


@dataclass
class Spot:
    name: str
    description: str
    district: str
    lat: float
    lng: float
    type: str
    category: str
    source_url: str


def classify_type(text: str) -> str:
    return "food" if any(keyword in text for keyword in FOOD_KEYWORDS) else "spot"


def classify_category(district: str, text: str) -> str:
    if any(town in district or town in text for town in SOUTH_LINK_TOWNS):
        return "rail"
    if any(keyword in text for keyword in ("海", "港", "浪", "漁", "三仙台", "都蘭", "成功", "長濱", "東河")):
        return "sea"
    if any(keyword in text for keyword in ("台東市", "鐵花", "市區")):
        return "city"
    return "mtn"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def fetch_soup(url: str) -> BeautifulSoup:
    res = requests.get(
        url,
        timeout=25,
        headers={
            "User-Agent": "Mozilla/5.0 WildTaitungBot/1.0",
            "Accept-Language": "zh-TW,zh;q=0.9",
        },
    )
    res.raise_for_status()
    return BeautifulSoup(res.text, "html.parser")


def extract_links() -> list[str]:
    links: set[str] = set()
    for page in range(1, 8):
        url = START_URL if page == 1 else f"{START_URL}?page={page}"
        soup = fetch_soup(url)
        before = len(links)
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            if "/zh-tw/tourism/spot/" not in href:
                continue
            full = urljoin(BASE_URL, href.split("#")[0])
            if full.rstrip("/") != START_URL:
                links.add(full)
        if len(links) == before and page > 1:
            break
        time.sleep(0.4)
    return sorted(links)


def extract_coordinates(html: str) -> tuple[float | None, float | None]:
    patterns = [
        r'"lat(?:itude)?"\s*:\s*"?([0-9.]+)"?\s*,\s*"lng|longitude"\s*:\s*"?([0-9.]+)"?',
        r'"latitude"\s*:\s*"?([0-9.]+)"?\s*,\s*"longitude"\s*:\s*"?([0-9.]+)"?',
        r"center=([0-9.]+),([0-9.]+)",
        r"!3d([0-9.]+)!4d([0-9.]+)",
        r"LatLng\(([0-9.]+),\s*([0-9.]+)\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None, None


def parse_detail(url: str) -> Spot | None:
    res = requests.get(url, timeout=25, headers={"User-Agent": "Mozilla/5.0 WildTaitungBot/1.0"})
    res.raise_for_status()
    html = res.text
    soup = BeautifulSoup(html, "html.parser")

    title = soup.select_one("h1")
    name = clean_text(title.get_text(" ", strip=True)) if title else ""
    if not name:
        og_title = soup.select_one('meta[property="og:title"]')
        name = clean_text(og_title.get("content", "")) if og_title else ""

    desc_node = soup.select_one('meta[name="description"], meta[property="og:description"]')
    description = clean_text(desc_node.get("content", "")) if desc_node else ""
    if not description:
        candidates = [clean_text(p.get_text(" ", strip=True)) for p in soup.select("p")]
        description = max(candidates, key=len, default="")

    district = ""
    text = clean_text(soup.get_text(" ", strip=True))
    district_match = re.search(r"(台東市|卑南|鹿野|關山|海端|池上|東河|成功|長濱|太麻里|金峰|大武|達仁|綠島|蘭嶼|延平)", text)
    if district_match:
        district = district_match.group(1)

    lat, lng = extract_coordinates(html)
    if not name or lat is None or lng is None:
        print(f"[skip] missing name or coordinates: {url}")
        return None

    joined = f"{name} {description} {district}"
    spot_type = classify_type(joined)
    category = classify_category(district, joined)
    if spot_type == "food":
        category = "city"

    return Spot(
        name=name,
        description=description,
        district=district,
        lat=lat,
        lng=lng,
        type=spot_type,
        category=category,
        source_url=url,
    )


def upsert_spots(spots: Iterable[Spot]) -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)
    rows = [spot.__dict__ for spot in spots]
    if not rows:
        print("No rows to upsert.")
        return
    client.table("spots").upsert(rows, on_conflict="name").execute()
    print(f"Upserted {len(rows)} spots.")


def main() -> None:
    links = extract_links()
    print(f"Found {len(links)} spot links.")
    spots: list[Spot] = []
    for index, link in enumerate(links, 1):
        try:
            spot = parse_detail(link)
            if spot:
                spots.append(spot)
                print(f"[{index}/{len(links)}] {spot.name} ({spot.lat}, {spot.lng}) {spot.type}/{spot.category}")
        except Exception as exc:
            print(f"[error] {link}: {exc}")
        time.sleep(0.5)
    upsert_spots(spots)


if __name__ == "__main__":
    main()
