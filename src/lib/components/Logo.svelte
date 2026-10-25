<!-- Wappen mit Schriftzug „Freiwillige Feuerwehr Leopoldsdorf“ in Textfarbe (hell und dunkel) -->
<div class="flex items-center gap-3">
	<img src="/bilder/wappen.webp" alt="" width="189" height="224" class="h-16 w-auto" />
	<span class="schriftzug" role="img" aria-label="Freiwillige Feuerwehr Leopoldsdorf"></span>
</div>

<style>
	/* Der Schriftzug ist weiß auf transparent: als Maske eingefärbt passt er zu beiden Farbschemata */
	.schriftzug {
		display: block;
		width: 15rem;
		aspect-ratio: 640 / 122;
		background-color: var(--color-ink);
		mask: url('/bilder/logo-schriftzug.webp') center / contain no-repeat;
	}
</style>
