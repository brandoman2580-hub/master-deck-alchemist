-- Master Rank Coach: Resonator + Lair hybrid combo templates (TCG + MASTER_DUEL)

INSERT INTO combo_templates (archetype_name, format, name, bosses, killers, graph)
SELECT
  v.archetype_name,
  f.format,
  v.name,
  v.bosses,
  v.killers,
  v.graph::jsonb
FROM (
  VALUES
  (
    'Resonator',
    'RDA Soul Resonator Line',
    ARRAY['Hot Red Dragon Archfiend Abyss','Red Rising Dragon']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Infinite Impermanence','Nibiru, the Primal Being']::text[],
    $json${
      "endboardSummary": "Red Rising / Abyss pressure with Resonator extenders",
      "fallbackSummary": "If Ash hits Soul Resonator or Crimson Resonator, pivot to a smaller Rising / Vision extend or pass with hand traps.",
      "nodes": [
        {"id":"h1","label":"Soul / Crimson opener","cardNames":["Soul Resonator","Crimson Resonator","Bone Archfiend"],"kind":"hand","required":true},
        {"id":"s1","label":"Resonator Call / Gaia","cardNames":["Resonator Call","Crimson Gaia"],"kind":"step","required":false},
        {"id":"e1","label":"RDA endboard","cardNames":["Hot Red Dragon Archfiend Abyss","Red Rising Dragon","Scarred Dragon Archfiend"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"search / climb"},
        {"from":"s1","to":"e1","label":"synchro"},
        {"from":"h1","to":"e1","label":"direct climb"}
      ]
    }$json$
  ),
  (
    'Lair of Darkness',
    'Lair Tribute Control Line',
    ARRAY['Ahrima, the Wicked Warden']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Called by the Grave','Infinite Impermanence']::text[],
    $json${
      "endboardSummary": "Lair up with tribute removal / DARK flood presence",
      "fallbackSummary": "If they interrupt Ahrima or Lair activation, play through with set traps / hand traps and re-establish Lair next turn.",
      "nodes": [
        {"id":"h1","label":"Lair / Ahrima","cardNames":["Lair of Darkness","Ahrima, the Wicked Warden"],"kind":"hand","required":true},
        {"id":"s1","label":"DARK tribute extend","cardNames":["Lilith, Lady of Lament","Duke Shade, the Sinister Shadow Lord"],"kind":"step","required":false},
        {"id":"e1","label":"Field control","cardNames":["Lair of Darkness","Ahrima, the Wicked Warden"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"tribute / search"},
        {"from":"s1","to":"e1","label":"lock field"}
      ]
    }$json$
  ),
  (
    'Resonator',
    'Hybrid Resonator under Lair',
    ARRAY['Hot Red Dragon Archfiend Abyss']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Nibiru, the Primal Being']::text[],
    $json${
      "endboardSummary": "Resonator climb while Lair taxes tribute lines — watch ED locks",
      "fallbackSummary": "If Crimson Resonator lock is live, do not force non-DARK Dragon Synchro lines; fall back to Lair tribute removal.",
      "nodes": [
        {"id":"h1","label":"Resonator + Lair pieces","cardNames":["Soul Resonator","Lair of Darkness","Crimson Resonator"],"kind":"hand","required":true},
        {"id":"s1","label":"Climb or tribute","cardNames":["Bone Archfiend","Ahrima, the Wicked Warden"],"kind":"step","required":false},
        {"id":"e1","label":"Hybrid close","cardNames":["Hot Red Dragon Archfiend Abyss","Lair of Darkness"],"kind":"endboard","required":false}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"develop"},
        {"from":"s1","to":"e1","label":"close"}
      ]
    }$json$
  )
) AS v(archetype_name, name, bosses, killers, graph)
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format);
