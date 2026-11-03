// old-habits — a gesture repeated until it changes. Concentric organic
// contours inherit their shape from the ring before them (memory), drift
// slightly each repetition (habit), and slowly transform (time). Rings
// bunch into dark bands and loose gaps; where the accumulated drift
// crosses a threshold, a relapse ring in oxide red is set apart by a scar
// of empty paper. p5.js 2.x: splineVertex (not 1.x curveVertex),
// splineProperty (not 1.x curveTightness).

const SEGMENTS = 72;
const START_RADIUS = 12;
const TARGET_RADIUS = 190;
const MAX_RINGS = 400;

function setup() {
    createCanvas(480, 480);
    background(238, 233, 221);
    noFill();
    splineProperty('tightness', 0.3);

    let cx = width / 2;
    let cy = height / 2;
    let drift = 0;

    let radii = [];
    for (let k = 0; k < SEGMENTS; k++) {
        const a = (k / SEGMENTS) * TWO_PI;
        radii.push(START_RADIUS + noise(cos(a) * 0.8 + 10, sin(a) * 0.8 + 10) * 4);
    }

    let meanRadius = START_RADIUS;
    let i = 0;
    const phase = noise(11, 5) * TWO_PI * 2;
    while (meanRadius < TARGET_RADIUS && i < MAX_RINGS) {
        const freq = 0.22 * (0.7 + 0.6 * noise(i * 0.015, 913));
        const cyc = i * freq + phase + noise(i * 0.02, 555) * 3.0;
        const band = Math.pow(0.5 + 0.5 * sin(cyc), 2.0);
        const grow = lerp(0.5, 1.1, Math.pow(meanRadius / TARGET_RADIUS, 0.7));
        const spacing = (0.28 + 6.2 * band) * grow;

        const next = [];
        let change = 0;
        let sum = 0;
        for (let k = 0; k < SEGMENTS; k++) {
            const a = (k / SEGMENTS) * TWO_PI;
            const w1 = noise(cos(a) * 1.4 + 40, sin(a) * 1.4 + 40, i * 0.05) - 0.5;
            const w2 = noise(cos(a) * 3.0 + 90, sin(a) * 3.0 + 90, i * 0.09) - 0.5;
            const stepScale = lerp(0.8, 1.4, meanRadius / TARGET_RADIUS);
            const step = (w1 * 2.2 + w2 * 0.6) * stepScale;
            const r = radii[k] + spacing + step;
            next.push(r);
            sum += r;
            change += Math.abs(step);
        }
        radii = next;
        meanRadius = sum / SEGMENTS;
        drift += change / SEGMENTS;
        cx += (noise(i * 0.05, 300) - 0.5) * 1.3;
        cy += (noise(i * 0.05, 400) - 0.5) * 1.3;

        if (drift > 10.5 && meanRadius < TARGET_RADIUS * 0.8) {
            drift = 0;
            stroke(164, 60, 40, 135);
            strokeWeight(1.6);
            for (let k = 0; k < SEGMENTS; k++) radii[k] += 6;
        } else {
            const fade = lerp(70, 34, meanRadius / TARGET_RADIUS);
            stroke(44, 40, 36, fade);
            strokeWeight(1.0);
        }

        beginShape();
        for (let k = 0; k < SEGMENTS; k++) {
            const a = (k / SEGMENTS) * TWO_PI;
            splineVertex(cx + cos(a) * radii[k], cy + sin(a) * radii[k]);
        }
        endShape(CLOSE);
        i++;
    }
}
