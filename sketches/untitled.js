// untitled — silk threads advected through a noise field wound around a
// slow vortex. Constraint: every mark is a straight segment of at most
// 24px; curves are forbidden, roundness is implied by alignment alone.

const THREADS = 1100;
const MAX_STEPS = 90;
const STEP = 2.2;
const GAP = 5;

function setup() {
    createCanvas(480, 480);
    colorMode(HSB, 360, 100, 100, 100);
    background(228, 42, 10);

    const vx = 240 + random(-30, 30);
    const vy = 240 + random(-30, 30);
    const huePhase = random(TWO_PI);

    for (let t = 0; t < THREADS; t++) {
        let x = random(width);
        let y = random(height);
        const accent = random() < 0.07;
        const bearing = atan2(y - vy, x - vx);
        const hue = accent ? random(28, 44) : 205 + 38 * sin(bearing + huePhase) + random(-8, 8);
        const sat = accent ? 85 : random(35, 65);
        const bri = accent ? 95 : random(55, 85);
        const steps = floor(random(MAX_STEPS * 0.45, MAX_STEPS));

        let chordX = x;
        let chordY = y;
        let travel = 0;
        let penUp = 0;
        let seg = 22;

        for (let s = 0; s < steps; s++) {
            const d = dist(x, y, vx, vy);
            seg = lerp(10, 22, constrain(d / 220, 0, 1));
            const swirl = (90 / (40 + d)) * constrain(d / 50, 0, 1);
            const w = min(swirl, 0.85);
            const tangent = atan2(y - vy, x - vx) + HALF_PI;
            const na = noise(x * 0.0035, y * 0.0035) * TWO_PI * 2;
            const inward = 0.12 * w;
            const nx = cos(na) * (1 - w) + cos(tangent) * w - ((x - vx) / max(d, 1)) * inward;
            const ny = sin(na) * (1 - w) + sin(tangent) * w - ((y - vy) / max(d, 1)) * inward;

            x += nx * STEP;
            y += ny * STEP;

            if (penUp > 0) {
                penUp -= STEP;
                chordX = x;
                chordY = y;
                travel = 0;
            } else {
                travel += STEP;
                if (travel >= seg) {
                    if (d > 14) {
                        const fade = min(1, s / 10) * min(1, (steps - s) / 16);
                        const eyeBoost = 1 + 0.45 * Math.exp(-d / 80);
                        const dc = dist(x, y, 240, 240);
                        const vig = 1 - 0.75 * constrain((dc - 150) / 110, 0, 1);
                        stroke(hue, sat, bri, min(60, 30 * fade * eyeBoost * vig));
                        strokeWeight(1.2);
                        line(chordX, chordY, x, y);
                    }
                    penUp = GAP;
                }
            }

            if (x < -20 || x > width + 20 || y < -20 || y > height + 20) break;
        }

        if (penUp <= 0 && travel > 6) {
            stroke(hue, sat, bri, 14);
            strokeWeight(1.2);
            line(chordX, chordY, x, y);
        }
    }
}
