# ReRack — Model Specifications (ATLAS)

> **QUICK REFERENCE**
> - Physical spec sheet + full pose/expression library for the recurring model ATLAS.
> - Pair with `soul-reference.md`. This doc is the operational shot list; soul-reference is the identity bible.
> - Every Uniform/Work generation should pick a numbered pose + expression + environment from these tables.

---

## 1. Physical Spec Sheet

| Attribute | Specification | Lock note |
|---|---|---|
| Age read | 28–32 | Fixed |
| Build | Lean athletic, functional conditioning | Fixed |
| Height | ~6'0" / 183cm | Fixed |
| Skin tone | Warm olive (Mediterranean/mixed) | Lock to reference |
| Hair | Dark, short, textured/structured | Fixed |
| Facial hair | Short stubble-to-beard, groomed | Fixed |
| Eyes | Dark, direct | Fixed |
| Hands | Calloused, chalked in Work shots | Detail |

## 2. Pose Library (signature angles)

| # | Pose | Pillar fit | Framing | Notes |
|---|---|---|---|---|
| P1 | Standing frontal, arms at sides | Uniform | Full / half body | Authority. Dead-center. |
| P2 | 3/4 turn, lean on structure | Uniform | Half / 3/4 | Gaze off-camera, shoulder to wall/rack. |
| P3 | Arms crossed, centered | Uniform / Standard | Chest-up | Contemplative, slight down eye-line. |
| P4 | Mid-motion (lift / walk-out / chalk) | Work | 3/4 / wide | Composed action, not blur. |
| P5 | Seated side, forearms on knees | Work | Medium | Recovery between sets, breath. |
| P6 | Back to camera, shoulders/garment drape | Uniform / Object | Half body | Showcases drop-shoulder silhouette + back label. |
| P7 | Low hero, looking off | Drop | Full | Reserved tension for launch frames only. |
| P8 | Hands detail (chalk, wraps, bar) | Work / Object | Macro | Crops out face; texture + craft. |

## 3. Expression Library

| # | Expression | When | Forbidden adjacent |
|---|---|---|---|
| E1 | Composed neutral | Default, Uniform | No smile |
| E2 | Focused intent (pre-lift) | Work | No grimace-for-camera |
| E3 | Calm exhaustion (post-set) | Work | No suffering theater |
| E4 | Direct unbothered gaze | Uniform / Drop | No flirtation |
| E5 | Eyes-down stillness | Standard / contemplative | No sadness |

> **Hard rule:** No wide smiles, no laughter, no surprised/playful faces. A faint earned half-expression is the maximum warmth.

## 4. Environment Library

| # | Environment | Pillar fit | Light |
|---|---|---|---|
| ENV1 | Industrial gym — steel racks, rubber floor | Uniform / Work | Single overhead fixture / window shaft |
| ENV2 | Concrete corridor / stairwell | Standard / Uniform | Hard directional, deep shadow |
| ENV3 | Black/charcoal seamless void | Uniform / Object | Single hard key, rim |
| ENV4 | Bone/cream warm field | Uniform / Object | Soft-hard window light |
| ENV5 | Exterior brutalist / loading dock | Standard / Drop | Blue or golden hour |

## 5. Shot-Build Formula

For any ATLAS generation, assemble:

```
soul_id: ATLAS_RR_001
+ Pose (P#)
+ Expression (E#)
+ Environment (ENV#)
+ Colorway (black default)
+ Lighting + grade (see visual-guidelines.md)
+ Aspect ratio (4:5 feed / 9:16 reel)
```

**Example:**
> `ATLAS_RR_001`, P2 three-quarter lean against steel rack upright (ENV1), E4 direct unbothered gaze, black ReRack oversized tee, single hard overhead gym fixture, deep shadow, matte filmic grade, fine grain, 4:5.

## 6. Continuity Tracking

Log every ATLAS generation in `6-Asset-Tracker/generated-assets.md` with its pose/expression/environment codes so the feed never repeats the same combination two posts in a row, and so retrains can target gaps in the library.
