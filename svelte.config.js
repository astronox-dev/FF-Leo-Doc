import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: 'build', precompress: true }),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte-Übergänge, Leaflet und die Skizze setzen Inline-Styles
				'style-src': ['self', 'unsafe-inline'],
				// Kartenkacheln von basemap.at (Österreich) und OpenStreetMap
				'img-src': ['self', 'data:', 'blob:', 'https://mapsneu.wien.gv.at', 'https://*.tile.openstreetmap.org'],
				'font-src': ['self'],
				// Adresssuche (Nominatim) und Gebäude/Straßen für die Skizze (Overpass)
				'connect-src': ['self', 'https://nominatim.openstreetmap.org', 'https://overpass-api.de', 'https://overpass.kumi.systems'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
