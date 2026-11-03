// Tidal Memory — an ancient ocean map remembered by a machine.
// Everything is built from short straight line segments: no curves, no
// gradients, no text. Palette: deep navy, pale seafoam, muted gold.
//
// - Submerged coastlines: concentric bathymetric contours around a few
//   generatively placed islands, each ring a polyline of short segments
//   displaced by noise. Where the noise dips, segments drop out:
//   memory gaps. Some islands carry a faint gold echo ring, shifted a
//   few pixels: the machine mis-remembering a shore it once knew.
// - Forgotten currents: many short faint stream segments steered by a
//   noise flow with a slow gyre around the disc; some stop mid-path.
// - Gold: dashed rhumb lines from a compass rose and small cross ticks
//   marking shoals, the cartographer's notation on the remembered sea.

const NAVY = [10, 22, 40];
const SEAFOAM = [178, 216, 205];
const GOLD = [198, 162, 90];

function setup() {
    createCanvas(480, 480);
    background(NAVY);
    noFill();

    const cx = width / 2;
    const cy = height / 2;

    // --- islands: generative geography with separation ---
    const islands = [];
    const nIslands = 2 + floor(random(3)); // 2..4
    for (let ii = 0; ii < nIslands; ii++) {
        let placed = false;
        for (let attempt = 0; attempt < 60 && !placed; attempt++) {
            const a = random(TWO_PI);
            const r = random(25, 120);
            const x = cx + cos(a) * r;
            const y = cy + sin(a) * r;
            const base = ii === 0 ? random(26, 36) : random(10, 22);
            const rings = 8 + floor(random(8));
            const seedOff = random(1000);
            // precompute the true ring radii for this island
            const radii = [];
            let radius = base;
            for (let rr = 0; rr < rings; rr++) {
                radius += 5 + noise(seedOff, rr * 0.5, 19) * 6.5;
                radii.push(radius);
            }
            const outer = radii[radii.length - 1];
            let clear = true;
            for (const other of islands) {
                // allow slight nesting of contours, never hollowing
                if (dist(x, y, other.x, other.y) < (outer + other.outer) * 0.55 + 20) clear = false;
            }
            if (clear) {
                islands.push({ x, y, base, rings, radii, outer, seedOff, echo: random() < 0.55 });
                placed = true;
            }
        }
    }

    // --- forgotten currents: short faint streams bent into gyres ---
    const nStreams = 210 + floor(random(60));
    const gyreDir = random() < 0.5 ? 1 : -1;
    for (let s = 0; s < nStreams; s++) {
        let x = cx + (random(2) - 1) * 215;
        let y = cy + (random(2) - 1) * 215;
        if (dist(x, y, cx, cy) > 215) continue;
        const steps = 9 + floor(random(14));
        const stepLen = random(3, 5.5);
        strokeWeight(0.8);
        stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], 8 + random(22));
        for (let t = 0; t < steps; t++) {
            // local noise flow plus a slow gyre around the disc center
            const flow = noise(x * 0.004, y * 0.004, 11) * TWO_PI * 1.3;
            const swirl = atan2(y - cy, x - cx) + HALF_PI * gyreDir;
            const a = lerpAngle(flow, swirl, 0.35);
            const nx = x + cos(a) * stepLen;
            const ny = y + sin(a) * stepLen;
            if (dist(nx, ny, cx, cy) > 228) break;
            // a current forgotten mid-path: some streams stop early
            if (noise(s * 0.7, t * 0.2, 55) < 0.1) break;
            line(x, y, nx, ny);
            x = nx;
            y = ny;
        }
    }

    // --- submerged coastlines: bathymetric contour rings ---
    for (let ii = 0; ii < islands.length; ii++) {
        const isl = islands[ii];
        for (let r = 0; r < isl.rings; r++) {
            const radius = isl.radii[r];
            const nearShore = 1 - r / isl.rings;
            const alpha = 40 + nearShore * 130;
            strokeWeight(r === 0 ? 1.6 : 1);
            const steps = 72;
            const echoRing = isl.echo && r === floor(isl.rings * 0.45);
            for (let pass = 0; pass < (echoRing ? 2 : 1); pass++) {
                if (echoRing && pass === 1) {
                    stroke(GOLD[0], GOLD[1], GOLD[2], 62); // mis-remembered ring
                } else {
                    stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], alpha);
                }
                const shift = pass === 1 ? 8 : 0;
                for (let k = 0; k < steps; k++) {
                    const a1 = (k / steps) * TWO_PI;
                    const a2 = ((k + 1) / steps) * TWO_PI;
                    // memory gap: wider dropout where the noise dips
                    if (noise(cos(a1) * 1.2 + isl.seedOff, sin(a1) * 1.2 + isl.seedOff, r * 0.35 + 61) < 0.3) continue;
                    const rr1 = radius + (noise(cos(a1) * 1.6 + isl.seedOff * 2, sin(a1) * 1.6 + isl.seedOff * 2, r * 0.22) - 0.5) * 20;
                    const rr2 = radius + (noise(cos(a2) * 1.6 + isl.seedOff * 2, sin(a2) * 1.6 + isl.seedOff * 2, r * 0.22) - 0.5) * 20;
                    const x1 = isl.x + shift + cos(a1) * rr1;
                    const y1 = isl.y + shift + sin(a1) * rr1;
                    const x2 = isl.x + shift + cos(a2) * rr2;
                    const y2 = isl.y + shift + sin(a2) * rr2;
                    const mx = (x1 + x2) / 2;
                    const my = (y1 + y2) / 2;
                    if (dist(mx, my, cx, cy) > 232) continue;
                    // precision: trim exactly at another island's outermost
                    // contour instead of crossing into its waters
                    if (pass === 0) {
                        let insideOther = false;
                        for (const other of islands) {
                            if (other !== isl && dist(mx, my, other.x, other.y) < other.outer - 3) insideOther = true;
                        }
                        if (insideOther) continue;
                    }
                    line(x1, y1, x2, y2);
                }
            }
        }
    }

    // --- gold rhumb lines from a compass point, drawn as dashed segments ---
    const rose = { x: cx + random(-110, 110), y: cy + random(-110, 110) };
    strokeWeight(1);
    for (let d = 0; d < 16; d++) {
        const a = (d / 16) * TWO_PI + random(0.35);
        stroke(GOLD[0], GOLD[1], GOLD[2], 65);
        for (let r = 24; r < 220; r += 11) {
            const x1 = rose.x + cos(a) * r;
            const y1 = rose.y + sin(a) * r;
            const x2 = rose.x + cos(a) * (r + 5.5);
            const y2 = rose.y + sin(a) * (r + 5.5);
            if (dist((x1 + x2) / 2, (y1 + y2) / 2, cx, cy) > 230) continue;
            line(x1, y1, x2, y2);
        }
    }
    // segmented rose circle around the compass point
    stroke(GOLD[0], GOLD[1], GOLD[2], 165);
    for (let k = 0; k < 40; k++) {
        const a1 = (k / 40) * TWO_PI;
        const a2 = ((k + 0.55) / 40) * TWO_PI;
        const rr = 20;
        line(rose.x + cos(a1) * rr, rose.y + sin(a1) * rr,
             rose.x + cos(a2) * rr, rose.y + sin(a2) * rr);
    }

    // --- gold shoal ticks: small crosses where the sea is shallow ---
    stroke(GOLD[0], GOLD[1], GOLD[2], 160);
    strokeWeight(1.2);
    for (let t = 0; t < 40; t++) {
        const a = random(TWO_PI);
        const r = 30 + random(185);
        const x = cx + cos(a) * r;
        const y = cy + sin(a) * r;
        if (noise(x * 0.008, y * 0.008, 97) < 0.56) continue;
        line(x - 3.5, y, x + 3.5, y);
        line(x, y - 3.5, x, y + 3.5);
    }
}

function lerpAngle(a, b, t) {
    let d = (b - a) % TWO_PI;
    if (d > PI) d -= TWO_PI;
    if (d < -PI) d += TWO_PI;
    return a + d * t;
}
