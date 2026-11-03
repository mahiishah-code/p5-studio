# untitled — CMPM 118 experiment log

Final artwork: `sketches/untitled.js` (identical to `05-final/untitled-v5-final.js`).

## Concept

Silk threads advected through a noise field wound around an off-center
vortex with a dark pupil. Deep indigo ground, cool threads lit by an
angular hue gradient (seed-rotated), sparse amber accents.

## Phase 1 — Unconstrained creation

`01-baseline/untitled-v1-baseline.js`: 720 continuous tapered threads
following a blended noise/tangent flow field with a calm eye at the
vortex center. No palette, shape, or composition restrictions imposed.

## Phase 2 — Baseline

`01-baseline/contact_sheet.png` + nine seed renders (3, 17, 42, 101,
256, 1009, 2718, 4096, 7919). Zero rendering errors. Consistent spiral
and palette; eye position and flow varied per seed.

## Phase 3 — Strong constraint

> Every visible mark must be a straight line segment at most 24px long.
> Curves are forbidden; roundness must be implied by alignment alone.

Rationale: the baseline's identity was continuous curvature, so banning
curves forces a structural redesign (silk becomes engraving) rather than
a surface tweak. Applied in `03-constraint/untitled-v2-constraint.js`:
threads draw as straight chords of at most ~22px with pen-up gaps.

## Phase 4 — Revisions

1. **`04-revision-1/untitled-v3-revision-1.js`** — Problem: dash gaps
   destroyed the luminous density and the eye's focus. Change: threads
   720→1100, gap 8→5, alpha 26→30, dash length scaled by distance
   (10px at the eye → 22px at the outskirts; all ≤24px). Result:
   density and a tight polygonal eye restored.
2. **`04-revision-2/untitled-v4-revision-2.js`** — Problem: flat
   mid-field, patchy accidental-looking edges, muddy center knot.
   Change: radial luminance model (eye brightness boost, even edge
   vignette, strokes suppressed inside d<14 for a true pupil). Result:
   composed dissolve, clean spiral center; slight bright-annulus
   artifact at the eye remained.
3. **`05-final/untitled-v5-final.js`** — Problem: per-thread random hue
   gave no large-scale light; eye ring too hard. Change: hue derived
   from bearing around the vortex (smooth teal↔indigo gradient,
   seed-randomized phase) plus softer eye falloff. Result: directional
   light, atmospheric depth.

Revision 1 and 2 evidence was re-rendered from exactly reconstructed
sources (recovered from the v2 snapshot plus the logged edits) under the
deterministic harness; the re-renders matched the originally inspected
images.

## Phase 5 — Final verification

`05-final/contact_sheet.png` + nine seed renders: zero rendering errors.
Style consistent (dashed vortex, pupil, directional light, vignette);
variation in eye position, light direction, accent density, flow.
Determinism: seed 42 re-rendered byte-identically, SHA-256
`1d1aae518568d06e789d7bb39f0f59cd724adefccd4bdf5579465513c9fee12b`.
