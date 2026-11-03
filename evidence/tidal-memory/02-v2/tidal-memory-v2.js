// Tidal Memory (v2) — an ancient ocean map remembered by a machine.
// Everything is built from short straight line segments: no curves, no
// gradients, no text. Palette: deep navy, pale seafoam, muted gold.
//
// v2 changes: geography is generative (island count, position and size
// vary per seed); currents are long streamlines made of many short
// straight segments instead of a dash grid; the gold cartographic layer
// (rhumb lines, rose circle, shoal ticks) is strengthened; memory gaps
// are larger and some rings are redrawn slightly offset, mis-remembered.

const NAVY = [10, 22, 40];
const SEAFOAM = [178, 216, 205];
const GOLD = [198, 162, 90];

function setup() {
    createCanvas(480, 480);
    background(NAVY);
    noFill();

    const cx = width / 2;
    const cy = height / 2;

    // --- islands: generative geography ---
    const islands = [];
    const nIslands = 2 + floor(random(3)); // 2..4
    for (let ii = 0; ii < nIslands; ii++) {
        const a = (ii / nIslands) * TWO_PI + random(-0.6, 0.6);
        const r = random(30, 130);
        islands.push({
            x: cx + cos(a) * r,
            y: cy + sin(a) * r,
            base: random(12, 30),
            rings: 8 + floor(random(8)),
            seedOff: random(1000),
        });
    }

    // --- forgotten currents: long streamlines of short segments ---
    const nStreams = 90 + floor(random(40));
    for (let s = 0; s < nStreams; s++) {
        let x = cx + (random(2) - 1) * 220;
        let y = cy + (random(2) - 1) * 220;
        if (dist(x, y, cx, cy) > 220) continue;
        const steps = 20 + floor(random(30));
        const stepLen = random(3, 6);
        const shade = random();
        strokeWeight(random() < 0.12 ? 1.4 : 0.8);
        stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], 10 + shade * 34);
        for (let t = 0; t < steps; t++) {
            const a = noise(x * 0.0045, y * 0.0045, 11) * TWO_PI * 2.2;
            const nx = x + cos(a) * stepLen;
            const ny = y + sin(a) * stepLen;
            if (dist(nx, ny, cx, cy) > 228) break;
            // a current forgotten mid-path: some streams stop early
            if (noise(s * 0.7, t * 0.2, 55) < 0.12) break;
            line(x, y, nx, ny);
            x = nx;
            y = ny;
        }
    }

    // --- submerged coastlines: bathymetric contour rings ---
    for (let ii = 0; ii < islands.length; ii++) {
        const isl = islands[ii];
        const misremember = random() < 0.5; // this island has a shifted echo ring
        for (let r = 0; r < isl.rings; r++) {
            const radius = isl.base + r * 9;
            const nearShore = 1 - r / isl.rings;
            const alpha = 34 + nearShore * 120;
            strokeWeight(r === 0 ? 1.6 : 1);
            const steps = 72;
            const echo = misremember && r === floor(isl.rings * 0.45);
            for (let pass = 0; pass < (echo ? 2 : 1); pass++) {
                if (echo && pass === 1) {
                    stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], 60);
                } else {
                    stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], alpha);
                }
                const shift = pass === 1 ? 5 : 0;
                for (let k = 0; k < steps; k++) {
                    const a1 = (k / steps) * TWO_PI;
                    const a2 = ((k + 1) / steps) * TWO_PI;
                    // memory gap: wider dropout where the noise dips
                    if (noise(cos(a1) * 1.2 + isl.seedOff, sin(a1) * 1.2 + isl.seedOff, r * 0.35 + 61) < 0.3) continue;
                    const rr1 = radius + (noise(cos(a1) * 1.6 + isl.seedOff * 2, sin(a1) * 1.6 + isl.seedOff * 2, r * 0.22) - 0.5) * 22;
                    const rr2 = radius + (noise(cos(a2) * 1.6 + isl.seedOff * 2, sin(a2) * 1.6 + isl.seedOff * 2, r * 0.22) - 0.5) * 22;
                    const x1 = isl.x + shift + cos(a1) * rr1;
                    const y1 = isl.y + shift + sin(a1) * rr1;
                    const x2 = isl.x + shift + cos(a2) * rr2;
                    const y2 = isl.y + shift + sin(a2) * rr2;
                    if (dist((x1 + x2) / 2, (y1 + y2) / 2, cx, cy) > 232) continue;
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
        stroke(GOLD[0], GOLD[1], GOLD[2], 85);
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
    stroke(GOLD[0], GOLD[1], GOLD[2], 130);
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
