# Learned Spine Generation Guide

## Corpus Summary
- analyzed project count: 821
- failed project count: 0
- common Spine versions: 3.5.51 (472), 3.6.52 (209), 3.6.51 (140)
- average bones: 28.492
- average slots: 15.292
- average animations: 3.9

## Naming Rules
- recommended bone names: root, scale, jifei, bone, tou, bone2, head, shenti, bone3, bone4, IK1, IK2, body, bone5, bone6, body2, tui2, body1, tui1, bone7
- recommended slot names: tou, body, shenti, head, tui2, tui1, armL, armR, atkbox, wuqi, bi1, bi2, legL, legR, shou1, jiao1, xiaba, jiao2, yan, shou2
- left/right naming conventions: left/right
- attachment path recommendations: Use short semantic attachment names without .png extension. Use image paths matching attachment names without file extensions.

## Common Animation Presets

### idle
- recommended duration: 1.2s
- common affected bones: body, head, root
- common transform ranges: body translate Y 4.2, head translate Y 6

### breathing
- recommended duration: 1.6s
- scale range: 1 to 1.03

### blink
- recommended interval: 2s
- closed duration: 0.12s
- preferred implementation: slot attachment switch. Slot visibility/color is acceptable when attachment switching is unavailable.

### tail_wag
- recommended rotation range: -12 to 12 degrees
- recommended duration: 1s

### head_bob
- recommended y translation: 6
- recommended duration: 1.2s

### float
- recommended y translation: 6
- recommended duration: 2s

### logo_bounce
- recommended scale/translate pattern: translate Y 18, scale 0.95 to 1.05
- recommended duration: 1.2s

## Parameter Generation Rules
- If the user requests a small cat idle loading animation, prefer idle + breathing + blink + tail_wag.
- If the source assets contain only one image, prefer logo_bounce + float.
- If no tail asset is available, do not generate tail_wag; return a warning instead.
- If no eye asset is available, do not generate blink; return a warning instead.
- Prefer the most common human-readable names from the corpus for bones, slots, and attachments.
- Keep animation amplitude restrained. Avoid exaggerated transforms unless the user explicitly requests them.
- Use corpus recommended duration ranges before falling back to defaults.

## Limitations
- basic generator only supports region attachments
- no mesh
- no IK
- no weights
- no complex constraints
