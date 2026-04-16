import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gamesDir = resolve(repoRoot, "nova-games");
const outDir = resolve(repoRoot, "dist", "nova-games");

mkdirSync(outDir, { recursive: true });

const kids = readdirSync(gamesDir, { withFileTypes: true })
	.filter(
		(e) =>
			e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."),
	)
	.map((e) => e.name);

if (kids.length === 0) {
	console.log("No kid games to build.");
	process.exit(0);
}

const succeeded = [];
const failed = [];

for (const kid of kids) {
	const kidDir = resolve(gamesDir, kid);
	console.log(`\n▸ Building ${kid}...`);

	const result = spawnSync("pnpm", ["run", "build"], {
		cwd: kidDir,
		stdio: "inherit",
		shell: false,
	});

	if (result.status !== 0) {
		console.error(`✗ ${kid}: build failed (exit ${result.status})`);
		failed.push(kid);
		continue;
	}

	const srcDist = resolve(kidDir, "dist");
	if (!existsSync(srcDist)) {
		console.error(`✗ ${kid}: build succeeded but no dist/ produced`);
		failed.push(kid);
		continue;
	}

	const target = resolve(outDir, kid);
	rmSync(target, { recursive: true, force: true });
	cpSync(srcDist, target, { recursive: true });
	succeeded.push(kid);
	console.log(`✓ ${kid} → dist/nova-games/${kid}/`);
}

console.log("\n─────────────");
console.log(
	`Succeeded: ${succeeded.length}${succeeded.length ? ` (${succeeded.join(", ")})` : ""}`,
);
if (failed.length) {
	console.log(`Failed:    ${failed.length} (${failed.join(", ")})`);
	console.log("\nMain site and working games will still deploy.");
}

process.exit(0);
