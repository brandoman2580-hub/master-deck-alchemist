from playwright.sync_api import sync_playwright
import json
import os
import urllib.parse
from bs4 import BeautifulSoup

def parse_ban_status(src):
    if "forbidden" in src:
        return "Forbidden"
    elif "limited-1" in src:
        return "Limited"
    elif "limited-2" in src:
        return "Semi-Limited"
    else:
        return "Unlimited"

def scrape_banlist():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("https://www.masterduelmeta.com/forbidden-limited-list", timeout=60000)
        page.wait_for_selector('a.image-wrapper', timeout=60000)
        html = page.content()
        soup = BeautifulSoup(html, "html.parser")
        banlist = {}

        for a_tag in soup.find_all("a", class_="image-wrapper"):
            imgs = a_tag.find_all("img")
            if len(imgs) < 2:
                continue

            # Ban status from first img src
            status_src = imgs[0].get("src", "")
            status = parse_ban_status(status_src)

            # Card name from href or second img alt
            href = a_tag.get("href", "")
            card_name = ""
            if href.startswith("/cards/"):
                card_name = urllib.parse.unquote(href.replace("/cards/", ""))
            else:
                card_name = imgs[1].get("alt", "").strip()

            if card_name:
                banlist[card_name] = status

        # Ensure output directory exists
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, "..", "public", "data")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "master-duel-banlist.json")
        print(f"Writing banlist with {len(banlist)} cards to {output_path}")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(banlist, f, ensure_ascii=False, indent=2)
        print("Banlist written to file successfully at:", output_path)

        browser.close()

if __name__ == "__main__":
    scrape_banlist()
