-- Facts Brain Phase 4: expand combo_templates coverage (TCG + MASTER_DUEL)

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
    'Spright',
    'Spright Elf Line',
    ARRAY['Gigantic Spright']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Nibiru, the Primal Being']::text[],
    $json${
      "endboardSummary": "Spright Elf / Gigantic pressure",
      "nodes": [
        {"id":"h1","label":"Blue / Jet","cardNames":["Spright Blue","Spright Jet"],"kind":"hand","required":true},
        {"id":"s1","label":"Link climb","cardNames":["Spright Elf","Spright Blue"],"kind":"step","required":false},
        {"id":"e1","label":"Gigantic","cardNames":["Gigantic Spright"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"summon"},
        {"from":"s1","to":"e1","label":"xyz"}
      ]
    }$json$
  ),
  (
    'Purrely',
    'Purrely Sleepy Memory Line',
    ARRAY['Expurrely Noir']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Infinite Impermanence']::text[],
    $json${
      "endboardSummary": "Expurrely Noir + memory gas",
      "nodes": [
        {"id":"h1","label":"Purrely / Pretty","cardNames":["Purrely","Purrely Pretty Memory"],"kind":"hand","required":true},
        {"id":"s1","label":"Rank climb","cardNames":["Epurrely Happiness","Epurrely Beauty"],"kind":"step","required":false},
        {"id":"e1","label":"Noir","cardNames":["Expurrely Noir"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"xyz"},
        {"from":"s1","to":"e1","label":"rank-up"}
      ]
    }$json$
  ),
  (
    'Mathmech',
    'Circular Synchro Line',
    ARRAY['Primathmech Alembertian']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Effect Veiler']::text[],
    $json${
      "endboardSummary": "Alembertian / Circular engine close",
      "nodes": [
        {"id":"h1","label":"Circular","cardNames":["Mathmech Circular"],"kind":"hand","required":true},
        {"id":"s1","label":"Extend","cardNames":["Mathmech Diameter","Mathmech Sigma"],"kind":"step","required":false},
        {"id":"e1","label":"Alembertian","cardNames":["Primathmech Alembertian"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"search"},
        {"from":"s1","to":"e1","label":"synchro/xyz"}
      ]
    }$json$
  ),
  (
    'Sky Striker',
    'Engage Control Line',
    ARRAY['Sky Striker Ace - Raye']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Called by the Grave']::text[],
    $json${
      "endboardSummary": "Raye + Engage follow-ups",
      "nodes": [
        {"id":"h1","label":"Engage / Raye","cardNames":["Sky Striker Mobilize - Engage!","Sky Striker Ace - Raye"],"kind":"hand","required":true},
        {"id":"s1","label":"Link","cardNames":["Sky Striker Ace - Kagari","Sky Striker Ace - Hayate"],"kind":"step","required":false},
        {"id":"e1","label":"Control board","cardNames":["Sky Striker Ace - Raye","Sky Striker Ace - Kagari"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"search/link"},
        {"from":"s1","to":"e1","label":"recycle"}
      ]
    }$json$
  ),
  (
    'Dragon Link',
    'Rokket Guardragon Line',
    ARRAY['Borreload Savage Dragon']::text[],
    ARRAY['Nibiru, the Primal Being','Ash Blossom & Joyous Spring']::text[],
    $json${
      "endboardSummary": "Savage + Guardragon climb",
      "nodes": [
        {"id":"h1","label":"Rokket / Striker","cardNames":["Rokket Tracer","Absorouter Dragon"],"kind":"hand","required":true},
        {"id":"s1","label":"Link climb","cardNames":["Striker Dragon","Guardragon Pisty"],"kind":"step","required":false},
        {"id":"e1","label":"Savage","cardNames":["Borreload Savage Dragon"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"extend"},
        {"from":"s1","to":"e1","label":"synchro"}
      ]
    }$json$
  ),
  (
    'Tri-Brigade',
    'Kerass Link Line',
    ARRAY['Tri-Brigade Shuraig the Ominous Omen']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Nibiru, the Primal Being']::text[],
    $json${
      "endboardSummary": "Shuraig + Brigade link board",
      "nodes": [
        {"id":"h1","label":"Kerass / Fraktall","cardNames":["Tri-Brigade Kerass","Tri-Brigade Fraktall"],"kind":"hand","required":true},
        {"id":"s1","label":"Banish link","cardNames":["Tri-Brigade Nervall","Tri-Brigade Kitt"],"kind":"step","required":false},
        {"id":"e1","label":"Shuraig","cardNames":["Tri-Brigade Shuraig the Ominous Omen"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"banish"},
        {"from":"s1","to":"e1","label":"link"}
      ]
    }$json$
  ),
  (
    'Prank-Kids',
    'Prank-Kids Battle Butler Line',
    ARRAY['Prank-Kids Battle Butler']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Nibiru, the Primal Being']::text[],
    $json${
      "endboardSummary": "Battle Butler + Prank recursion",
      "nodes": [
        {"id":"h1","label":"Fansies / Dropsies","cardNames":["Prank-Kids Fansies","Prank-Kids Dropsies"],"kind":"hand","required":true},
        {"id":"s1","label":"Link / fuse","cardNames":["Prank-Kids Bow-Wow-Bark","Prank-Kids Place"],"kind":"step","required":false},
        {"id":"e1","label":"Butler","cardNames":["Prank-Kids Battle Butler"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"climb"},
        {"from":"s1","to":"e1","label":"fusion"}
      ]
    }$json$
  ),
  (
    'Floowandereeze',
    'Floowandereeze Empen Line',
    ARRAY['Floowandereeze & Empen']::text[],
    ARRAY['Dimension Shifter','Ash Blossom & Joyous Spring']::text[],
    $json${
      "endboardSummary": "Empen + continuous tribute lock",
      "nodes": [
        {"id":"h1","label":"Robina / Eglen","cardNames":["Floowandereeze & Robina","Floowandereeze & Eglen"],"kind":"hand","required":true},
        {"id":"s1","label":"Tribute climb","cardNames":["Floowandereeze & Robina","Floowandereeze & Eglen"],"kind":"step","required":false},
        {"id":"e1","label":"Empen","cardNames":["Floowandereeze & Empen"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"normal"},
        {"from":"s1","to":"e1","label":"tribute"}
      ]
    }$json$
  )
) AS v(archetype_name, name, bosses, killers, graph)
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format);
