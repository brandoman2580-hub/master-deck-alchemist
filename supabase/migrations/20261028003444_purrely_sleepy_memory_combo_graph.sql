-- Rewrite the Purrely Sleepy Memory line into one card per node.
-- Other combo_templates rows stay on the short hand/step/endboard shape.
-- The board reads lanes (hand, play, interrupt, boss, material, spell, gy)
-- and edge relations (play, interrupts, material).

update combo_templates
set
  bosses = array['Expurrely Noir']::text[],
  killers = array['Ash Blossom & Joyous Spring', 'Infinite Impermanence']::text[],
  graph = $json${
    "endboardSummary": "Expurrely Noir after Purrelyeap!? resolves, with Sleepy and Pretty memories attached and Stray Purrely Street still live",
    "nodes": [
      {"id":"h-purrelyly","label":"Purrelyly","cardNames":["Purrelyly"],"kind":"hand","lane":"hand","order":0,"required":true},
      {"id":"h-friend","label":"My Friend Purrely","cardNames":["My Friend Purrely"],"kind":"hand","lane":"hand","order":1,"required":true},
      {"id":"h-street","label":"Stray Purrely Street","cardNames":["Stray Purrely Street"],"kind":"hand","lane":"hand","order":2,"required":true},
      {"id":"h-sleepy","label":"Purrely Sleepy Memory","cardNames":["Purrely Sleepy Memory"],"kind":"hand","lane":"hand","order":3,"required":true},
      {"id":"h-pretty","label":"Purrely Pretty Memory","cardNames":["Purrely Pretty Memory"],"kind":"hand","lane":"hand","order":4,"required":true},
      {"id":"p-street","label":"Stray Purrely Street","cardNames":["Stray Purrely Street"],"kind":"step","lane":"play","order":0,"required":true},
      {"id":"p-purrelyly","label":"Purrelyly","cardNames":["Purrelyly"],"kind":"step","lane":"play","order":1,"required":true},
      {"id":"p-friend","label":"My Friend Purrely","cardNames":["My Friend Purrely"],"kind":"step","lane":"play","order":2,"required":true},
      {"id":"p-sleepy","label":"Purrely Sleepy Memory","cardNames":["Purrely Sleepy Memory"],"kind":"step","lane":"play","order":3,"required":true},
      {"id":"p-epurrely","label":"Epurrely Noir","cardNames":["Epurrely Noir"],"kind":"step","lane":"play","order":4,"required":true},
      {"id":"p-leap","label":"Purrelyeap!?","cardNames":["Purrelyeap!?"],"kind":"step","lane":"play","order":5,"required":true},
      {"id":"p-expurrely","label":"Expurrely Noir","cardNames":["Expurrely Noir"],"kind":"step","lane":"play","order":6,"required":true},
      {"id":"i-ash","label":"Ash Blossom & Joyous Spring","cardNames":["Ash Blossom & Joyous Spring"],"kind":"interruption","lane":"interrupt","order":0,"required":false},
      {"id":"i-imperm","label":"Infinite Impermanence","cardNames":["Infinite Impermanence"],"kind":"interruption","lane":"interrupt","order":1,"required":false},
      {"id":"b-noir","label":"Expurrely Noir","cardNames":["Expurrely Noir"],"kind":"endboard","lane":"boss","order":0,"required":true},
      {"id":"m-epurrely","label":"Epurrely Noir","cardNames":["Epurrely Noir"],"kind":"endboard","lane":"material","order":0,"required":false},
      {"id":"m-sleepy","label":"Purrely Sleepy Memory","cardNames":["Purrely Sleepy Memory"],"kind":"endboard","lane":"material","order":1,"required":false},
      {"id":"m-pretty","label":"Purrely Pretty Memory","cardNames":["Purrely Pretty Memory"],"kind":"endboard","lane":"material","order":2,"required":false},
      {"id":"s-street","label":"Stray Purrely Street","cardNames":["Stray Purrely Street"],"kind":"endboard","lane":"spell","order":0,"required":false},
      {"id":"g-friend","label":"My Friend Purrely","cardNames":["My Friend Purrely"],"kind":"endboard","lane":"gy","order":0,"required":false},
      {"id":"g-leap","label":"Purrelyeap!?","cardNames":["Purrelyeap!?"],"kind":"endboard","lane":"gy","order":1,"required":false}
    ],
    "edges": [
      {"from":"h-street","to":"p-street","relation":"play"},
      {"from":"h-purrelyly","to":"p-purrelyly","relation":"play"},
      {"from":"h-friend","to":"p-friend","relation":"play"},
      {"from":"h-sleepy","to":"p-sleepy","relation":"play"},
      {"from":"h-pretty","to":"m-pretty","relation":"play"},
      {"from":"p-street","to":"p-purrelyly","relation":"play"},
      {"from":"p-purrelyly","to":"p-friend","relation":"play"},
      {"from":"p-friend","to":"p-sleepy","relation":"play"},
      {"from":"p-sleepy","to":"p-epurrely","relation":"play"},
      {"from":"p-epurrely","to":"p-leap","relation":"play"},
      {"from":"p-leap","to":"p-expurrely","relation":"play"},
      {"from":"i-ash","to":"p-friend","relation":"interrupts"},
      {"from":"i-imperm","to":"p-epurrely","relation":"interrupts"},
      {"from":"m-epurrely","to":"b-noir","relation":"material"},
      {"from":"m-sleepy","to":"b-noir","relation":"material"},
      {"from":"m-pretty","to":"b-noir","relation":"material"}
    ]
  }$json$::jsonb,
  updated_at = now()
where
  archetype_name = 'Purrely'
  and name = 'Purrely Sleepy Memory Line';
