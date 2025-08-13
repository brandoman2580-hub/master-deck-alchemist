from dotenv import load_dotenv
import os
import requests
from supabase import create_client, Client

# --- CONFIGURATION ---
# Set these as environment variables or directly here:
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
YGO_API = "https://db.ygoprodeck.com/api/v7/cardinfo.php"
BATCH_SIZE = 1000

# --- INITIALIZE SUPABASE ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# --- FETCH ALL YGO CARDS ---
print("Fetching card data from YGOPRODeck...")
resp = requests.get(YGO_API)
resp.raise_for_status()  # halt if error
data = resp.json()["data"]

print(f"Fetched {len(data)} cards.")

# --- PREPARE/BULK UPSERT INTO SUPABASE ---
for i in range(0, len(data), BATCH_SIZE):
    batch = data[i : i + BATCH_SIZE]
    records = []
    for card in batch:
        banlist = card.get("banlist_info", {}) or {}
        card_row = {
            "id": card["id"],
            "name": card.get("name"),
            "type": card.get("type"),
            "race": card.get("race"),
            "attribute": card.get("attribute"),
            "level": card.get("level"),
            "atk": card.get("atk"),
            "def": card.get("def"),
            "desc": card.get("desc"),
            "archetype": card.get("archetype"),
            "ban_tcg": banlist.get("ban_tcg"),
        }
        records.append(card_row)

    try:
        resp = supabase.table("cards").upsert(records).execute()
        # resp should always have .data for upserted results
        print(f"Upserted cards {i+1} to {i+len(records)}")
        if hasattr(resp, "data") and resp.data is None:
            print(f"Warning: No data for cards {i+1} to {i+len(records)}. Response: {resp}")
    except Exception as e:
        print(f"Exception while upserting cards {i+1} to {i+len(records)}: {e}")

print("✅ Card pool sync complete!")
