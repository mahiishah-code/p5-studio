# Tidal Memory — revision log

Ancient ocean map remembered by a machine. Short straight line segments
only (no curves, gradients, text). Palette: deep navy, pale seafoam,
muted gold. All contact sheets use the same 9 seeds.

## Round 1 — v1 (`01-v1/`)

- **Consistent:** three island groups fixed in the same diagonal in all
  seeds; restrained navy/seafoam tone (on-brief); but the layout is too
  rigid — every seed is the same map.
- **Varies:** only trivial details (island wobble, a few gold flecks).
  Dash-grid currents produce a mechanical moiré, gold rhumb lines are
  invisible (alpha too low), outer disc is empty everywhere.
- **Change intended for v2:** generative geography (island count,
  position, size vary per seed); replace dash grid with long streamlines
  of short segments; strengthen the gold cartographic layer; larger
  memory gaps plus offset "mis-remembered" rings.

## Round 2 — v2 (`02-v2/`)

- **Consistent:** gold rhumb structure now reads as a chart in every
  seed (good); but two large center-clumped islands dominate, and the
  streamlines consistently read as long bright wandering hairs — too
  loud for "contemplative, precise."
- **Varies:** island count and rose position vary (alive, good); best
  seeds have 3-4 island clusters. Contour rings are uniformly machined
  and rings from neighboring islands interfere where they overlap.
- **Change intended for v3:** tame currents into coherent gyres (many
  short faint streams, rotational bias around disc center); place
  islands with minimum separation and one primary landmass; organic
  ring spacing; cull contours crossing another island's waters; gold
  echo ring for the machine's mis-memory.

## Round 3 — v3 (`03-v3/`)

- **Consistent:** mood lands in every seed — quiet gyres, visible gold
  rose, contemplative tone. But the culling logic (`shoreRadius` with
  fixed 9px spacing plus margin) hollows islands out: several seeds
  show arcs around empty centers, two seeds lose their coastlines.
- **Varies:** geography, rose position, gyre direction all vary well;
  nothing breaks, but hollowed seeds are dull.
- **Change intended for final:** precompute true ring radii; separate
  islands proportional to actual outer radii; trim exactly at the
  other's outermost contour instead of hollowing; raise echo-ring gold
  alpha; slightly brighten shorelines.

## Final — `sketches/tidal-memory.js` (`04-final/`)

Full bathymetric coastlines return in all 9 seeds; geography varies
(1-3 island groups, varying sizes/positions) while the chart-like
structure (rose, rhumb lines, shoal ticks, gyres, memory gaps) stays
consistent. Contemplative, mysterious, precise. Detail render: seed 42.
