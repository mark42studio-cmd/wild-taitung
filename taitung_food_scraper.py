import os
import re
import time
from dataclasses import asdict, dataclass
from typing import Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from supabase import create_client


BASE_URL = "https://tour.taitung.gov.tw"
START_URL = f"{BASE_URL}/zh-tw/tourism/spot"
TYPE_KEYWORDS = ("餐廳", "小吃", "飲", "店", "美食", "味")
CATEGORY_RULES = {
    "sea": ("東河", "成功", "長濱"),
    "mtn": ("關山", "池上", "鹿野", "延平", "卑南"),
    "city": ("台東市", "臺東市"),
    "rail": ("太麻里", "金峰", "大武", "達仁"),
}


@dataclass
class FoodRow:
    name: str
    description: str
    district: str
    lat: float
    lng: float
    type: str
    category: str
    source_url: str


def supabase_client():
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return create_client(url, key)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def classify_category(district: str, text: str) -> str:
    for category, keywords in CATEGORY_RULES.items():
        if any(keyword in district or keyword in text for keyword in keywords):
            return category
    return "mtn"


def classify_type(name: str, text: str) -> str:
    joined = f"{name} {text}"
    return "food" if any(keyword in joined for keyword in TYPE_KEYWORDS) else "spot"


def fetch_soup(url: str) -> BeautifulSoup:
    response = requests.get(
        url,
        timeout=30,
        headers={
            "User-Agent": "Mozilla/5.0 WildTaitungFoodScraper/1.0",
            "Accept-Language": "zh-TW,zh;q=0.9",
        },
    )
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def existing_names(client) -> set[str]:
    response = client.table("food").select("name").execute()
    names = {clean_text(row["name"]) for row in (response.data or []) if row.get("name")}
    print(f"[food] existing names: {len(names)}")
    return names


def collect_detail_links(max_pages: int = 12) -> list[str]:
    links: set[str] = set()
    for page in range(1, max_pages + 1):
        url = START_URL if page == 1 else f"{START_URL}?page={page}"
        soup = fetch_soup(url)
        before = len(links)
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            if "/zh-tw/tourism/spot/" not in href:
                continue
            full = urljoin(BASE_URL, href.split("#")[0]).rstrip("/")
            if full != START_URL:
                links.add(full)
        print(f"[crawl] page {page}: total links {len(links)}")
        if page > 1 and len(links) == before:
            break
        time.sleep(0.35)
    return sorted(links)


def extract_coordinates(html: str) -> tuple[float | None, float | None]:
    patterns = (
        r'"latitude"\s*:\s*"?([0-9.]+)"?\s*,\s*"longitude"\s*:\s*"?([0-9.]+)"?',
        r'"lat"\s*:\s*"?([0-9.]+)"?\s*,\s*"(?:lng|lon)"\s*:\s*"?([0-9.]+)"?',
        r"!3d([0-9.]+)!4d([0-9.]+)",
        r"center=([0-9.]+),([0-9.]+)",
        r"LatLng\(([0-9.]+),\s*([0-9.]+)\)",
        r"data-lat(?:itude)?=[\"']([0-9.]+)[\"'][^>]+data-lng=[\"']([0-9.]+)[\"']",
    )
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None, None


def extract_district(text: str) -> str:
    match = re.search(r"(台東市|臺東市|東河|成功|長濱|關山|池上|鹿野|延平|卑南|太麻里|金峰|大武|達仁)", text)
    return match.group(1).replace("臺", "台") if match else ""


def parse_detail(url: str) -> FoodRow | None:
    response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0 WildTaitungFoodScraper/1.0"})
    response.raise_for_status()
    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    title = soup.select_one("h1")
    name = clean_text(title.get_text(" ", strip=True)) if title else ""
    if not name:
        og_title = soup.select_one('meta[property="og:title"]')
        name = clean_text(og_title.get("content", "")) if og_title else ""

    meta_desc = soup.select_one('meta[name="description"], meta[property="og:description"]')
    description = clean_text(meta_desc.get("content", "")) if meta_desc else ""
    if not description:
        paragraphs = [clean_text(p.get_text(" ", strip=True)) for p in soup.select("p")]
        description = max(paragraphs, key=len, default="")

    page_text = clean_text(soup.get_text(" ", strip=True))
    district = extract_district(page_text)
    lat, lng = extract_coordinates(html)
    if not name or lat is None or lng is None:
        print(f"[skip] missing name/coords: {url}")
        return None

    row_type = classify_type(name, f"{description} {page_text}")
    category = classify_category(district, f"{name} {description} {page_text}")
    if row_type == "food" and category not in ("sea", "mtn", "rail"):
        category = "city"

    return FoodRow(
        name=name,
        description=description,
        district=district,
        lat=lat,
        lng=lng,
        type=row_type,
        category=category,
        source_url=url,
    )


def should_upsert(row: FoodRow, names: set[str]) -> bool:
    if not names:
        return True
    return row.name in names or any(row.name in name or name in row.name for name in names)


def upsert_rows(client, rows: Iterable[FoodRow]) -> None:
    payload = [asdict(row) for row in rows]
    if not payload:
        print("[food] no matching rows to upsert")
        return
    client.table("food").upsert(payload, on_conflict="name").execute()
    print(f"[food] upserted rows: {len(payload)}")


def main() -> None:
    client = supabase_client()
    names = existing_names(client)
    links = collect_detail_links()
    rows: list[FoodRow] = []
    for index, link in enumerate(links, 1):
        try:
            row = parse_detail(link)
            if row and should_upsert(row, names):
                rows.append(row)
                print(f"[{index}/{len(links)}] {row.name} {row.district} {row.type}/{row.category} ({row.lat}, {row.lng})")
        except Exception as exc:
            print(f"[error] {link}: {exc}")
        time.sleep(0.45)
    upsert_rows(client, rows)


if __name__ == "__main__":
    main()
