import os
import requests  # For downloading images[2][3][4]
import json

# --------------- CONFIGURATION ---------------

# Directory to save images
IMAGE_DIR = 'images'

# List of card IDs (replace with your actual list)
with open('card_ids.json', 'r') as f:
    card_ids = json.load(f)

# Base URL for YGOPRODeck full-size images
BASE_URL = 'https://images.ygoprodeck.com/images/cards/'

# --------------- SCRIPT ---------------

# Create the directory if it doesn't exist
os.makedirs(IMAGE_DIR, exist_ok=True)

for card_id in card_ids:
    image_url = f"{BASE_URL}{card_id}.jpg"
    save_path = os.path.join(IMAGE_DIR, f"{card_id}.jpg")
    try:
        response = requests.get(image_url, timeout=10)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded {card_id}.jpg")
        else:
            print(f"Failed to download {card_id}: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error downloading {card_id}: {e}")
