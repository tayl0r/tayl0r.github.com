import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const name = process.argv[2];

if (!name) {
	console.error("Usage: pnpm new-game <name>");
	console.error("Example: pnpm new-game alex");
	process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
	console.error(`\n✗ Invalid name: "${name}"`);
	console.error(
		"  Use lowercase letters, digits, and hyphens. Must start with a letter.",
	);
	console.error("  Examples: alex, space-shooter, ninja-quest\n");
	process.exit(1);
}

const target = resolve(here, name);
if (existsSync(target)) {
	console.error(`\n✗ nova-games/${name} already exists.\n`);
	process.exit(1);
}

const template = resolve(here, "_template");

console.log(`\nCreating nova-games/${name}/...`);

cpSync(template, target, { recursive: true });
console.log("  ✓ copied _template");

const pkgPath = resolve(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = `@nova-games/${name}`;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
console.log(`  ✓ package.json → @nova-games/${name}`);

const htmlPath = resolve(target, "index.html");
const html = readFileSync(htmlPath, "utf8").replace(
	/<title>.*<\/title>/,
	`<title>${name}</title>`,
);
writeFileSync(htmlPath, html);
console.log(`  ✓ index.html title → ${name}`);

console.log("\nInstalling dependencies...");
const result = spawnSync("pnpm", ["install"], {
	cwd: repoRoot,
	stdio: "inherit",
});

if (result.status !== 0) {
	console.error("\n✗ pnpm install failed. Run it manually from the repo root.");
	process.exit(1);
}

console.log(`
✨ Done! Next steps:

  cd nova-games/${name}
  pnpm dev

Then open http://localhost:5173 in your browser.
`);
