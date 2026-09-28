-- Facts Brain Phase 3: seed combo_templates for top archetypes (TCG + MASTER_DUEL)

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
    'Snake-Eye',
    'Poplar Line',
    ARRAY['Diabellstar the Black Witch']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Nibiru, the Primal Being','Droll & Lock Bird']::text[],
    $json${
      "endboardSummary": "Diabellstar + Snake-Eye engine presence",
      "nodes": [
        {"id":"h1","label":"Ash / Poplar start","cardNames":["Snake-Eye Ash","Snake-Eye Oak"],"kind":"hand","required":true},
        {"id":"s1","label":"Diabellstar","cardNames":["Diabellstar the Black Witch"],"kind":"step","required":true},
        {"id":"e1","label":"Engine close","cardNames":["Snake-Eye Ash","Diabellstar the Black Witch"],"kind":"endboard","required":false}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"search / climb"},
        {"from":"s1","to":"e1","label":"end"}
      ]
    }$json$
  ),
  (
    'Branded',
    'Branded Fusion Line',
    ARRAY['Mirrorjade the Iceblade Dragon']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Called by the Grave']::text[],
    $json${
      "endboardSummary": "Mirrorjade + Branded gas",
      "nodes": [
        {"id":"h1","label":"Albaz / Opening","cardNames":["Fallen of Albaz","Aluber the Jester of Despia"],"kind":"hand","required":true},
        {"id":"s1","label":"Branded Fusion","cardNames":["Branded Fusion"],"kind":"step","required":true},
        {"id":"e1","label":"Mirrorjade","cardNames":["Mirrorjade the Iceblade Dragon"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"fuse"},
        {"from":"s1","to":"e1","label":"resolve"}
      ]
    }$json$
  ),
  (
    'Tearlaments',
    'Mill Fusion Line',
    ARRAY['Tearlaments Kitkallos']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Droll & Lock Bird','Called by the Grave']::text[],
    $json${
      "endboardSummary": "Kitkallos + Tear names in GY",
      "nodes": [
        {"id":"h1","label":"Reinoheart / names","cardNames":["Tearlaments Reinoheart","Tearlaments Havnis","Tearlaments Scheiren"],"kind":"hand","required":true},
        {"id":"s1","label":"Mill / fuse","cardNames":["Tearlaments Havnis","Tearlaments Scheiren"],"kind":"step","required":false},
        {"id":"e1","label":"Kitkallos","cardNames":["Tearlaments Kitkallos"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"mill"},
        {"from":"s1","to":"e1","label":"fusion"}
      ]
    }$json$
  ),
  (
    'Kashtira',
    'Unicorn Lock Line',
    ARRAY['Kashtira Shangri-Ira']::text[],
    ARRAY['Nibiru, the Primal Being','Infinite Impermanence']::text[],
    $json${
      "endboardSummary": "Unicorn / Fenrir pressure into Shangri-Ira",
      "nodes": [
        {"id":"h1","label":"Unicorn / Fenrir","cardNames":["Kashtira Unicorn","Kashtira Fenrir"],"kind":"hand","required":true},
        {"id":"s1","label":"Extend","cardNames":["Kashtira Unicorn","Kashtira Fenrir","Kashtira Riseheart"],"kind":"step","required":false},
        {"id":"e1","label":"Zone pressure","cardNames":["Kashtira Unicorn","Kashtira Fenrir"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"summon"},
        {"from":"s1","to":"e1","label":"lock"}
      ]
    }$json$
  ),
  (
    'Swordsoul',
    'Mo Ye Synchro Line',
    ARRAY['Swordsoul Grandmaster - Chixiao']::text[],
    ARRAY['Ash Blossom & Joyous Spring','Effect Veiler']::text[],
    $json${
      "endboardSummary": "Chixiao + token follow-ups",
      "nodes": [
        {"id":"h1","label":"Mo Ye","cardNames":["Swordsoul of Mo Ye"],"kind":"hand","required":true},
        {"id":"s1","label":"Token / climb","cardNames":["Swordsoul of Mo Ye","Swordsoul Emergence"],"kind":"step","required":false},
        {"id":"e1","label":"Chixiao","cardNames":["Swordsoul Grandmaster - Chixiao"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"token"},
        {"from":"s1","to":"e1","label":"synchro"}
      ]
    }$json$
  ),
  (
    'Labrynth',
    'Welcome Labrynth Line',
    ARRAY['Lady Labrynth of the Silver Castle']::text[],
    ARRAY['Called by the Grave','Infinite Impermanence']::text[],
    $json${
      "endboardSummary": "Lady Labrynth + furniture traps",
      "nodes": [
        {"id":"h1","label":"Furniture / Welcome","cardNames":["Labrynth Chandraglier","Labrynth Cooclock","Welcome Labrynth"],"kind":"hand","required":true},
        {"id":"s1","label":"Set / search","cardNames":["Welcome Labrynth","Labrynth Chandraglier"],"kind":"step","required":false},
        {"id":"e1","label":"Lady Labrynth","cardNames":["Lady Labrynth of the Silver Castle"],"kind":"endboard","required":true}
      ],
      "edges":[
        {"from":"h1","to":"s1","label":"trap line"},
        {"from":"s1","to":"e1","label":"boss"}
      ]
    }$json$
  )
) AS v(archetype_name, name, bosses, killers, graph)
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format);
