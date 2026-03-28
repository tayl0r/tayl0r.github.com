import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	appType: "mpa",
	base: "/",
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				"3d-text-demo": resolve(__dirname, "3d-text-demo/index.html"),
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
			},
		},
	},
});
