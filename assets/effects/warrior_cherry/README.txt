Warrior Cherry – game-ready VFX pack
====================================

Attack
------
The existing 6-frame directional sword-slash attack VFX is included.

Skill: Whirlwind
----------------
New generated high-detail pink/gold ARPG whirlwind effect.

IMPORTANT rendering order:
1. Draw `skill_whirlwind/back`
2. Draw the Cherry character model
3. Draw `skill_whirlwind/front`

This prevents the dense bloom from covering Cherry. The `combined` files are
provided for previews, particles, or engines that cannot use two VFX layers,
but the separate back/front layers are recommended.

Technical data
--------------
- True RGBA PNG
- Transparent background, alpha = 0
- Frame size: 192x192
- Skill frames: 8
- Recommended skill FPS: 16
- Directions: down, up, left, right
- VFX ground anchor: x=96, y=112
- Draw top-left at `(player.x - 96, player.y - 112)`

Folders
-------
- `attack/` – directional sword slash
- `skill_whirlwind/back/` – draw behind Cherry
- `skill_whirlwind/front/` – draw after Cherry
- `skill_whirlwind/combined/` – optional combined version
