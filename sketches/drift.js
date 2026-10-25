// drift — an example sketch. Particles wander through a noise field,
// leaving faint trails. Each seed gives a different composition.
// It builds up over time: render it with frames around 150.

const PARTICLES = 400;
let particles = [];

function setup() {
    createCanvas(480, 480);
    background(18, 20, 28);
    for (let i = 0; i < PARTICLES; i++) {
        particles.push({ x: random(width), y: random(height), hue: random(180, 260) });
    }
    colorMode(HSB, 360, 100, 100, 100);
    noStroke();
}

function draw() {
    for (const p of particles) {
        const angle = noise(p.x * 0.004, p.y * 0.004) * TWO_PI * 2;
        p.x += cos(angle) * 1.2;
        p.y += sin(angle) * 1.2;
        fill(p.hue, 60, 90, 6);
        circle(p.x, p.y, 2.2);
    }
}
