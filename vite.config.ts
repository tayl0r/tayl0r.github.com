import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	appType: "mpa",
	base: "/",
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),

				// Flyers
				flyers: resolve(__dirname, "flyers/index.html"),
				"flyers-minimal": resolve(__dirname, "flyers/minimal/index.html"),
				"flyers-oktoberfest": resolve(
					__dirname,
					"flyers/oktoberfest-sep-2026/index.html",
				),
				"flyers-oktoberfest-bavarian": resolve(
					__dirname,
					"flyers/oktoberfest-sep-2026/bavarian/index.html",
				),

				// Nova Games — kid-built games live in nova-games/<kid>/
				// and are built by `pnpm run build:games`. Only the landing
				// page is a root vite entry.
				"nova-games": resolve(__dirname, "nova-games/index.html"),
			},
		},
	},
});
