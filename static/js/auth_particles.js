/**
 * Dynamic Badminton Shuttlecock & Neon Trajectory Canvas Animation
 */

class ShuttlecockAnimation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.shuttlecocks = [];
        this.mouse = { x: null, y: null };
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        // Spawn drifting shuttlecock particles
        const count = Math.min(18, Math.floor(window.innerWidth / 80));
        for (let i = 0; i < count; i++) {
            this.shuttlecocks.push(this.createShuttlecock());
        }

        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createShuttlecock() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 8 + 10,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.02,
            alpha: Math.random() * 0.45 + 0.25,
            color: Math.random() > 0.4 ? '#FF5A1F' : '#FF3B00'
        };
    }

    drawShuttlecock(p) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;

        // Draw glowing cork base
        ctx.beginPath();
        ctx.arc(0, p.size * 0.4, p.size * 0.3, 0, Math.PI);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();

        // Draw feathered cone
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.3, p.size * 0.4);
        ctx.lineTo(-p.size * 0.6, -p.size * 0.6);
        ctx.lineTo(p.size * 0.6, -p.size * 0.6);
        ctx.lineTo(p.size * 0.3, p.size * 0.4);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Inner skirt ribs
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.1, p.size * 0.4);
        ctx.lineTo(-p.size * 0.2, -p.size * 0.6);
        ctx.moveTo(p.size * 0.1, p.size * 0.4);
        ctx.lineTo(p.size * 0.2, -p.size * 0.6);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();

        ctx.restore();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.shuttlecocks.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.vRot;

            // Screen wrap
            if (p.x < -30) p.x = this.canvas.width + 30;
            if (p.x > this.canvas.width + 30) p.x = -30;
            if (p.y < -30) p.y = this.canvas.height + 30;
            if (p.y > this.canvas.height + 30) p.y = -30;

            this.drawShuttlecock(p);
        });

        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ShuttlecockAnimation('particles-canvas');
});
