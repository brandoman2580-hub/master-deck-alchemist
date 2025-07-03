import { getCardData } from "./lib/api";
import * as fs from 'fs';

// @TODO: Remove this function after downloads are successful
async function exportCardIds() {
  // Fetch all cards (empty params gets all cards)
  const cards = await getCardData({});
  // Extract IDs (adjust property if needed)
  const ids = cards.map(card => card.id);
  // Write to JSON file
  fs.writeFileSync('card_ids.json', JSON.stringify(ids, null, 2));
  console.log(`Exported ${ids.length} card IDs to card_ids.json`);
}

exportCardIds();
