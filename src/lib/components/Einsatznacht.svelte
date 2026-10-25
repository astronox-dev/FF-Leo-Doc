<script lang="ts">
	import { onMount } from 'svelte';

	/*
	 * Einsatz bei Nacht: Glut am unteren Rand, aufsteigende Funken und das Wechsellicht
	 * eines Blaulichts. Rein dekorativ; bei „Bewegung reduzieren“ steht das Bild still.
	 */

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		let breite = 0, hoehe = 0, dpr = 1;
		const funken: { x: number; y: number; vx: number; vy: number; r: number; leben: number; max: number; farbe: number }[] = [];

		function groesse() {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			breite = canvas.clientWidth;
			hoehe = canvas.clientHeight;
			canvas.width = breite * dpr;
			canvas.height = hoehe * dpr;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		function neuerFunke(start = false) {
			const max = 3 + Math.random() * 5;
			funken.push({
				x: Math.random() * breite,
				y: start ? hoehe * (0.35 + Math.random() * 0.65) : hoehe + 10,
				vx: (Math.random() - 0.5) * 18,
				vy: -(28 + Math.random() * 70),
				r: 0.8 + Math.random() * 2.2,
				leben: start ? Math.random() * max : 0,
				max,
				farbe: Math.random()
			});
		}

		groesse();
		for (let i = 0; i < 90; i++) neuerFunke(true);

		let zuletzt = performance.now();
		let raf = 0;
		function frame(jetzt: number) {
			const dt = Math.min(0.05, (jetzt - zuletzt) / 1000);
			zuletzt = jetzt;
			ctx!.clearRect(0, 0, breite, hoehe);
			ctx!.globalCompositeOperation = 'lighter';
			for (let i = funken.length - 1; i >= 0; i--) {
				const f = funken[i];
				f.leben += dt;
				// Thermik: Funken steigen, schlingern seitlich und werden langsamer
				f.vx += Math.sin(jetzt / 700 + f.y / 60) * 6 * dt;
				f.x += f.vx * dt;
				f.y += f.vy * dt;
				f.vy *= 1 - 0.08 * dt;
				const rest = 1 - f.leben / f.max;
				if (rest <= 0 || f.y < -20) {
					funken.splice(i, 1);
					continue;
				}
				const hell = f.farbe > 0.75 ? '255,214,140' : f.farbe > 0.35 ? '255,150,60' : '240,90,40';
				const g = ctx!.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4);
				g.addColorStop(0, `rgba(${hell},${0.95 * rest})`);
				g.addColorStop(1, `rgba(${hell},0)`);
				ctx!.fillStyle = g;
				ctx!.beginPath();
				ctx!.arc(f.x, f.y, f.r * 4, 0, Math.PI * 2);
				ctx!.fill();
			}
			while (funken.length < 90) neuerFunke();
			// Bei „Bewegung reduzieren“ bleibt es beim ersten Bild
			if (!ruhig) raf = requestAnimationFrame(frame);
		}

		raf = requestAnimationFrame(frame);

		const beobachter = new ResizeObserver(groesse);
		beobachter.observe(canvas);
		return () => {
			cancelAnimationFrame(raf);
			beobachter.disconnect();
		};
	});
</script>

<div class="nacht" aria-hidden="true">
	<div class="blau links"></div>
	<div class="blau rechts"></div>
	<div class="glut"></div>
	<div class="glut zwei"></div>
	<canvas bind:this={canvas}></canvas>
	<div class="dunst"></div>
</div>

<style>
	.nacht {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background:
			radial-gradient(120% 70% at 50% 110%, #3a0d07 0%, transparent 60%),
			linear-gradient(180deg, #060606 0%, #0c0c0c 55%, #1a0b08 100%);
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	/* Glut am Boden: zwei Schichten, die gegeneinander flackern */
	.glut {
		position: absolute;
		inset: auto -10% -18% -10%;
		height: 55%;
		background:
			radial-gradient(40% 60% at 30% 100%, rgb(255 120 40 / 0.55), transparent 70%),
			radial-gradient(35% 55% at 70% 100%, rgb(255 80 30 / 0.5), transparent 70%),
			radial-gradient(60% 50% at 50% 100%, rgb(175 43 30 / 0.7), transparent 75%);
		filter: blur(8px);
		animation: flackern 2.6s ease-in-out infinite alternate;
	}
	.glut.zwei {
		height: 42%;
		opacity: 0.7;
		background:
			radial-gradient(30% 60% at 55% 100%, rgb(255 190 90 / 0.45), transparent 70%),
			radial-gradient(25% 50% at 18% 100%, rgb(255 110 50 / 0.4), transparent 70%);
		animation-duration: 1.7s;
		animation-delay: -0.8s;
	}
	@keyframes flackern {
		0% { transform: scaleY(1) translateX(0); opacity: 0.85; }
		35% { transform: scaleY(1.08) translateX(-1.5%); opacity: 1; }
		60% { transform: scaleY(0.95) translateX(1%); opacity: 0.8; }
		100% { transform: scaleY(1.05) translateX(0.5%); opacity: 0.95; }
	}

	/* Blaulicht: zwei Lichtkegel, Doppelblitz wie bei den Einsatzfahrzeugen */
	.blau {
		position: absolute;
		top: -30%;
		width: 90%;
		height: 120%;
		background: radial-gradient(50% 50% at 50% 50%, rgb(60 120 255 / 0.55), rgb(40 90 255 / 0.12) 45%, transparent 70%);
		mix-blend-mode: screen;
		opacity: 0;
		animation: blitz 1.6s infinite;
	}
	.blau.links {
		left: -45%;
	}
	.blau.rechts {
		right: -45%;
		animation-delay: 0.8s;
	}
	@keyframes blitz {
		0%, 4% { opacity: 0.9; }
		7%, 11% { opacity: 0.05; }
		13%, 17% { opacity: 0.8; }
		22%, 100% { opacity: 0; }
	}

	/* Rauch, der über der Glut liegt */
	.dunst {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(60% 30% at 40% 70%, rgb(120 110 110 / 0.08), transparent 70%),
			radial-gradient(50% 25% at 70% 55%, rgb(120 110 110 / 0.06), transparent 70%);
		animation: ziehen 14s ease-in-out infinite alternate;
	}
	@keyframes ziehen {
		from { transform: translateX(-3%) translateY(0); }
		to { transform: translateX(4%) translateY(-3%); }
	}

	@media (prefers-reduced-motion: reduce) {
		.blau {
			animation: none;
			opacity: 0.25;
		}
	}
</style>
