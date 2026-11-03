// Tidal Memory (v1) — an ancient ocean map remembered by a machine.
// Everything is built from short straight line segments: no curves, no
// gradients, no text. Palette: deep navy, pale seafoam, muted gold.
//
// - Submerged coastlines: concentric bathymetric contours around a few
//   island centers, each ring a polyline of short segments displaced by
//   noise. Where the noise dips, segments drop out: memory gaps.
// - Forgotten currents: a field of short dashes steered by a noise flow.
// - Gold: rhumb lines radiating from a compass point, and small cross
//   ticks marking shoals, like a cartographer's notation.

const NAVY = [10, 22, 40];
const SEAFOAM = [178, 216, 205];
const GOLD = [198, 162, 90];

function setup() {
    createCanvas(480, 480);
    background(NAVY);
    noFill();

    const cx = width / 2;
    const cy = height / 2;

    // --- forgotten currents: short dashes along a noise flow field ---
    strokeWeight(1);
    const cols = 34;
    const rows = 34;
    for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
            const x = (gx + 0.5) * (width / cols) + (noise(gx * 0.7, gy * 0.7, 3) - 0.5) * 8;
            const y = (gy + 0.5) * (height / rows) + (noise(gx * 0.7, gy * 0.7, 7) - 0.5) * 8;
            if (dist(x, y, cx, cy) > 225) continue;
            const a = noise(x * 0.006, y * 0.006, 11) * TWO_PI * 2;
            const len = 4 + noise(x * 0.01, y * 0.01, 17) * 8;
            const fade = noise(x * 0.004, y * 0.004, 23);
            stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], 14 + fade * 40);
            line(x - cos(a) * len, y - sin(a) * len, x + cos(a) * len, y + sin(a) * len);
        }
    }

    // --- submerged coastlines: bathymetric contour rings ---
    const islands = [
        { x: cx - 70 + (noise(31) - 0.5) * 40, y: cy - 55 + (noise(37) - 0.5) * 40, base: 26, rings: 14 },
        { x: cx + 85 + (noise(41) - 0.5) * 40, y: cy + 60 + (noise(43) - 0.5) * 40, base: 20, rings: 11 },
        { x: cx + 30 + (noise(47) - 0.5) * 60, y: cy - 95 + (noise(53) - 0.5) * 40, base: 12, rings: 8 },
    ];

    for (let ii = 0; ii < islands.length; ii++) {
        const isl = islands[ii];
        for (let r = 0; r < isl.rings; r++) {
            const radius = isl.base + r * 9;
            const nearShore = 1 - r / isl.rings;
            const alpha = 30 + nearShore * 110;
            stroke(SEAFOAM[0], SEAFOAM[1], SEAFOAM[2], alpha);
            strokeWeight(r === 0 ? 1.6 : 1);
            const steps = 64;
            for (let k = 0; k < steps; k++) {
                const a1 = (k / steps) * TWO_PI;
                const a2 = ((k + 1) / steps) * TWO_PI;
                // memory gap: where this noise dips, the segment is forgotten
                if (noise(cos(a1) * 1.2 + ii * 9, sin(a1) * 1.2 + ii * 9, r * 0.35 + 61) < 0.24) continue;
                const rr1 = radius + (noise(cos(a1) * 1.6 + ii * 20, sin(a1) * 1.6 + ii * 20, r * 0.22) - 0.5) * 22;
                const rr2 = radius + (noise(cos(a2) * 1.6 + ii * 20, sin(a2) * 1.6 + ii * 20, r * 0.22) - 0.5) * 22;
                const x1 = isl.x + cos(a1) * rr1;
                const y1 = isl.y + sin(a1) * rr1;
                const x2 = isl.x + cos(a2) * rr2;
                const y2 = isl.y + sin(a2) * rr2;
                if (dist((x1 + x2) / 2, (y1 + y2) / 2, cx, cy) > 232) continue;
                line(x1, y1, x2, y2);
            }
        }
    }

    // --- gold rhumb lines from a compass point, drawn as dashed segments ---
    const rose = { x: cx + (noise(71) - 0.5) * 160, y: cy + (noise(73) - 0.5) * 160 };
    stroke(GOLD[0], GOLD[1], GOLD[2], 55);
    strokeWeight(1);
    for (let d = 0; d < 16; d++) {
        const a = (d / 16) * TWO_PI + noise(79) * 0.3;
        for (let r = 26; r < 215; r += 12) {
            const x1 = rose.x + cos(a) * r;
            const y1 = rose.y + sin(a) * r;
            const x2 = rose.x + cos(a) * (r + 6);
            const y2 = rose.y + sin(a) * (r + 6);
            if (dist((x1 + x2) / 2, (y1 + y2) / 2, cx, cy) > 230) continue;
            line(x1, y1, x2, y2);
        }
    }

    // --- gold shoal ticks: small crosses where the sea is shallow ---
    stroke(GOLD[0], GOLD[1], GOLD[2], 150);
    strokeWeight(1.2);
    for (let t = 0; t < 26; t++) {
        const a = noise(t * 3.3, 83) * TWO_PI;
        const r = 30 + noise(t * 3.3, 89) * 190;
        const x = cx + cos(a) * r;
        const y = cy + sin(a) * r;
        if (noise(x * 0.008, y * 0.008, 97) < 0.55) continue;
        line(x - 3.5, y, x + 3.5, y);
        line(x, y - 3.5, x, y + 3.5);
    }
}
