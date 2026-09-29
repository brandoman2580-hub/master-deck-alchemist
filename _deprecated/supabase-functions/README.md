# Deprecated Supabase edge functions

## Architecture

Phase 1a parking lot for **NOT_LIVE** / retired edge functions. They are **not** deployed from this path by the app.

| Folder | Why |
|--------|-----|
| `recommendation-agent` | Legacy Strategist predecessor — approved undeploy |
| `deck-assistant` | Twin of live `strategist/` |
| `deck-builder-agent` | Client hook never wired |
| `deck-analysis` | Tests-only client; builder used local utils |
| `ai-synergy` | Zero client importers |
| `recommendation-feedback` | Zero client importers |
| `create-deck` | `raw_deck_inputs` batch path no longer used |
| `strategist-not-live/` | Legacy prompts + response-generator from live strategist |

**Phase 5:** confirm zero traffic in Supabase dashboards, then undeploy the remote function names matching these folders.
