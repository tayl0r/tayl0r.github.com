# phoenix-a-game: Enemy Tiered Weapons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every monster spawns with a tier-randomized weapon. Sword wielders hit harder; bow wielders kite and shoot arrows. Killed monsters drop their weapon as a pickup-able world drop.

**Architecture:** Add a `weapon: Item` field on `Monster` filled at spawn via a new `rollMonsterWeapon` helper (reuses the existing floor-scaled quality curve, kind split 65/35 sword/bow). Bow AI lives in a new `monster_combat.ts` module; sword bonus is added in `applyContactDamage`. Monster arrows reuse the existing `Arrow` type with a new `source` discriminator and a player-collision branch. Death drops reuse the `WorldDrop` system.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-05-16-phoenix-enemy-weapons-design.md`.

**Work directory:** `nova-games/phoenix-a-game/`. Run `pnpm test` from there for unit tests; run `pnpm run test` from the worktree root for `tsc --noEmit && biome check .`. Both must stay green at every commit.

---

## File map

**New files:**
- `nova-games/phoenix-a-game/src/monster_combat.ts`
- `nova-games/phoenix-a-game/src/monster_combat.test.ts`

**Heavy edits:**
- `nova-games/phoenix-a-game/src/monsters.ts` (add `weapon`/`nextShotAt` fields; createMonster takes weapon; createMonsterModel takes item; weaponAnchor + held-weapon mesh per kind)
- `nova-games/phoenix-a-game/src/loot.ts` (add `rollMonsterWeapon`)
- `nova-games/phoenix-a-game/src/arrows.ts` (add `source: "player" | "monster"` to Arrow + createArrow)
- `nova-games/phoenix-a-game/src/tick.ts` (sword bonus in `applyContactDamage`)
- `nova-games/phoenix-a-game/src/main.ts` (spawn computes weapon; bow dispatch; fireMonsterArrow; death drops; arrow-source branch)

**Light edits:**
- `nova-games/phoenix-a-game/src/monsters.test.ts` (stub weapon arg in createMonster calls)
- `nova-games/phoenix-a-game/src/arrows.test.ts` (pass `"player"` source in existing calls; add monster-arrow case)
- `nova-games/phoenix-a-game/src/loot.test.ts` (rollMonsterWeapon cases)

---

## Task 1: `rollMonsterWeapon` in loot.ts

**Files:**
- Modify: `nova-games/phoenix-a-game/src/loot.ts`
- Test: `nova-games/phoenix-a-game/src/loot.test.ts`

We add `rollMonsterWeapon(rng, floor, boss)` that reuses the existing quality curve but rolls 65% sword / 35% bow (no food).

- [ ] **Step 1: Write the failing tests**

Append to `nova-games/phoenix-a-game/src/loot.test.ts`:

```ts
import { rollMonsterWeapon } from "./loot";

function deterministicRngFor(seed: number): () => number {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) & 0x7fffffff;
		return (x / 0x80000000) % 1;
	};
}

describe("rollMonsterWeapon kind distribution", () => {
	it("never produces food", () => {
		const rng = deterministicRngFor(11);
		for (let i = 0; i < 500; i++) {
			const item = rollMonsterWeapon(rng, 0, false);
			expect(item.kind === "food").toBe(false);
		}
	});
	it("rolls ~65% sword / ~35% bow", () => {
		const rng = deterministicRngFor(12);
		let swords = 0;
		let bows = 0;
		for (let i = 0; i < 5000; i++) {
			const item = rollMonsterWeapon(rng, 2, false);
			if (item.kind === "sword") swords++;
			else if (item.kind === "bow") bows++;
		}
		const swordRatio = swords / (swords + bows);
		expect(swordRatio).toBeGreaterThan(0.55);
		expect(swordRatio).toBeLessThan(0.75);
	});
});

describe("rollMonsterWeapon quality curve", () => {
	it("floor 0 produces mostly common", () => {
		const rng = deterministicRngFor(13);
		let common = 0;
		let total = 0;
		for (let i = 0; i < 2000; i++) {
			const item = rollMonsterWeapon(rng, 0, false);
			total++;
			if (item.quality === 1) common++;
		}
		expect(common / total).toBeGreaterThan(0.4);
	});
	it("floor 4+ produces meaningful rare/epic/legendary", () => {
		const rng = deterministicRngFor(14);
		let highTier = 0;
		let total = 0;
		for (let i = 0; i < 2000; i++) {
			const item = rollMonsterWeapon(rng, 4, false);
			total++;
			if (item.quality >= 3) highTier++;
		}
		expect(highTier / total).toBeGreaterThan(0.5);
	});
	it("boss shift gives floor-0 boss a chance at legendary+", () => {
		const rng = deterministicRngFor(15);
		let legendaryOrAbove = 0;
		for (let i = 0; i < 3000; i++) {
			const item = rollMonsterWeapon(rng, 0, true);
			if (item.quality >= 5) legendaryOrAbove++;
		}
		expect(legendaryOrAbove).toBeGreaterThan(0);
	});
	it("returns valid Item shape", () => {
		const rng = deterministicRngFor(16);
		for (let i = 0; i < 200; i++) {
			const item = rollMonsterWeapon(rng, 2, false);
			expect(["sword", "bow"]).toContain(item.kind);
			expect(item.quality).toBeGreaterThanOrEqual(1);
			expect(item.quality).toBeLessThanOrEqual(6);
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd nova-games/phoenix-a-game && pnpm test -- loot.test
```
Expected: FAIL — "module './loot' has no exported member 'rollMonsterWeapon'".

- [ ] **Step 3: Implement rollMonsterWeapon**

Append to `nova-games/phoenix-a-game/src/loot.ts` (after `rollItemDrop`):

```ts
export function rollMonsterWeapon(
	rng: () => number,
	floor: number,
	boss: boolean,
): Item {
	const kind: ItemKind = rng() < 0.65 ? "sword" : "bow";
	const band = Math.max(0, Math.floor(floor)) + (boss ? 1 : 0);
	const quality = rollQuality(rng, band);
	return { kind, quality };
}
```

Note: `rollQuality` is an existing private function in `loot.ts` (added in the previous feature's Task 3). No new helpers needed.

- [ ] **Step 4: Run tests to verify they pass**

```
cd nova-games/phoenix-a-game && pnpm test -- loot.test
```
Expected: PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS (tsc + biome).

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/loot.ts nova-games/phoenix-a-game/src/loot.test.ts
git commit -m "phoenix-a-game: add rollMonsterWeapon (65/35 sword/bow, no food)"
```

---

## Task 2: `Arrow.source` discriminator

**Files:**
- Modify: `nova-games/phoenix-a-game/src/arrows.ts`
- Test: `nova-games/phoenix-a-game/src/arrows.test.ts`

Add `source: "player" | "monster"` to `Arrow`. Backward-compat: `createArrow`'s `source` parameter defaults to `"player"`.

- [ ] **Step 1: Update existing tests to reference the field**

Existing tests pass arrows without `source`. After implementation they'll pick up the default. Add one new test that exercises the explicit "monster" source.

Append to `nova-games/phoenix-a-game/src/arrows.test.ts`:

```ts
describe("createArrow source", () => {
	it("defaults to 'player'", () => {
		const a = createArrow(0, 1, 0, 0, 0, -1, 1, 0xffffff, 0);
		expect(a.source).toBe("player");
	});
	it("accepts an explicit 'monster' source", () => {
		const a = createArrow(0, 1, 0, 0, 0, -1, 1, 0xffffff, 0, "monster");
		expect(a.source).toBe("monster");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd nova-games/phoenix-a-game && pnpm test -- arrows.test
```
Expected: FAIL — "source does not exist on type Arrow" or similar.

- [ ] **Step 3: Implement the field**

In `nova-games/phoenix-a-game/src/arrows.ts`:

Update the `Arrow` interface to add `source`:

```ts
export interface Arrow {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	damage: number;
	alive: boolean;
	bornAt: number;
	mesh: Mesh;
	source: "player" | "monster";
}
```

Update `createArrow` to accept the new optional parameter and write it through:

```ts
export function createArrow(
	px: number,
	py: number,
	pz: number,
	dx: number,
	dy: number,
	dz: number,
	damage: number,
	color: number,
	now: number,
	source: "player" | "monster" = "player",
): Arrow {
	const len = Math.hypot(dx, dy, dz) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const uz = dz / len;
	const mesh = new Mesh(
		new BoxGeometry(0.05, 0.05, 0.7),
		new MeshStandardMaterial({ color, emissive: 0x222222 }),
	);
	mesh.position.set(px, py, pz);
	mesh.lookAt(px + ux, py + uy, pz + uz);
	return {
		x: px,
		y: py,
		z: pz,
		vx: ux * ARROW_SPEED,
		vy: uy * ARROW_SPEED,
		vz: uz * ARROW_SPEED,
		damage,
		alive: true,
		bornAt: now,
		mesh,
		source,
	};
}
```

- [ ] **Step 4: Run tests**

```
cd nova-games/phoenix-a-game && pnpm test -- arrows.test
```
Expected: all arrow tests PASS (existing tests still pass because the default is "player").

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/arrows.ts nova-games/phoenix-a-game/src/arrows.test.ts
git commit -m "phoenix-a-game: add Arrow.source discriminator for friend-vs-foe shots"
```

---

## Task 3: `Monster.weapon` + `nextShotAt` fields, createMonster signature

**Files:**
- Modify: `nova-games/phoenix-a-game/src/monsters.ts`
- Modify: `nova-games/phoenix-a-game/src/monsters.test.ts`

Adds the `weapon: Item` and optional `nextShotAt: number` to `Monster`. `createMonster` now requires a `weapon` argument. (`createMonsterModel` will gain its own param in Task 4.)

- [ ] **Step 1: Update existing tests for the new signature**

Replace the body of `nova-games/phoenix-a-game/src/monsters.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
	createMonster,
	createMonsterModel,
	isBossKind,
	type MonsterKind,
	moveMonsterTowards,
} from "./monsters";
import type { Item } from "./state";

const STUB_SWORD: Item = { kind: "sword", quality: 1 };
const STUB_BOW: Item = { kind: "bow", quality: 1 };

describe("createMonster", () => {
	it("returns kind-appropriate stats and stores the weapon", () => {
		const sk = createMonster("skeleton", 0, 0, 0, STUB_SWORD);
		expect(sk.kind).toBe("skeleton");
		expect(sk.dormant).toBe(true);
		expect(sk.weapon).toEqual(STUB_SWORD);
		const reaper = createMonster("grimReaper", 0, 0, 0, STUB_SWORD);
		expect(reaper.dormant).toBe(false);
	});
	it("seeds nextShotAt to 0 for bow wielders", () => {
		const archer = createMonster("goblin", 0, 0, 0, STUB_BOW);
		expect(archer.nextShotAt).toBe(0);
	});
	it("does not seed nextShotAt for sword wielders", () => {
		const slasher = createMonster("orc", 0, 0, 0, STUB_SWORD);
		expect(slasher.nextShotAt).toBeUndefined();
	});
	it("identifies boss kinds", () => {
		expect(isBossKind("grimReaper")).toBe(true);
		expect(isBossKind("minotaur")).toBe(true);
		expect(isBossKind("lich")).toBe(true);
		expect(isBossKind("skeleton")).toBe(false);
		expect(isBossKind("slime")).toBe(false);
	});
});

describe("moveMonsterTowards", () => {
	it("walks toward the target at its speed", () => {
		const m = createMonster("goblin", 0, 0, 0, STUB_SWORD);
		m.dormant = false;
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBeCloseTo(m.speed, 5);
	});
	it("does not overshoot the target", () => {
		const m = createMonster("goblin", 0, 0, 0, STUB_SWORD);
		m.dormant = false;
		m.speed = 100;
		moveMonsterTowards(m, 1, 0, 1);
		expect(m.x).toBeLessThanOrEqual(1);
	});
	it("does not move when dormant", () => {
		const m = createMonster("goblin", 0, 0, 0, STUB_SWORD);
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBe(0);
	});
});

describe("createMonsterModel", () => {
	const kinds: MonsterKind[] = [
		"skeleton",
		"zombie",
		"grimReaper",
		"goblin",
		"orc",
		"minotaur",
		"slime",
		"fireElemental",
		"lich",
	];
	for (const kind of kinds) {
		it(`builds a model with at least one mesh for ${kind}`, () => {
			const { group, flashMaterial } = createMonsterModel(kind, STUB_SWORD);
			expect(group.children.length).toBeGreaterThan(0);
			expect(flashMaterial).toBeDefined();
		});
	}
});
```

(Note: `createMonsterModel(kind, STUB_SWORD)` already uses the new signature. We're writing both Task 3 + Task 4 expectations into the same test pass because they ship together — the implementation in Task 4 will satisfy the createMonsterModel assertion.)

- [ ] **Step 2: Run tests to verify they fail**

```
cd nova-games/phoenix-a-game && pnpm test -- monsters.test
```
Expected: FAIL — type errors about `createMonster` missing the 5th arg / `Monster.weapon` not existing.

- [ ] **Step 3: Update Monster interface and createMonster**

In `nova-games/phoenix-a-game/src/monsters.ts`:

Add the import at the top (alongside existing imports):

```ts
import type { Item } from "./state";
```

Update the `Monster` interface:

```ts
export interface Monster {
	kind: MonsterKind;
	roomIndex: number;
	x: number;
	z: number;
	hp: number;
	speed: number;
	radius: number;
	contact: number;
	damage: number;
	dormant: boolean;
	walkPhase: number;
	hitSquashUntil?: number;
	flashUntil?: number;
	mesh?: Group;
	flashMaterial?: MeshStandardMaterial;
	weapon: Item;
	nextShotAt?: number;
}
```

Update `createMonster`:

```ts
export function createMonster(
	kind: MonsterKind,
	x: number,
	z: number,
	roomIndex: number,
	weapon: Item,
): Monster {
	const s = STATS[kind];
	const monster: Monster = {
		kind,
		roomIndex,
		x,
		z,
		hp: s.hp,
		speed: s.speed,
		radius: s.radius,
		contact: s.contact,
		damage: s.damage,
		dormant: !s.isBoss,
		walkPhase: 0,
		weapon,
	};
	if (weapon.kind === "bow") monster.nextShotAt = 0;
	return monster;
}
```

- [ ] **Step 4: Run tests (createMonster assertions only — createMonsterModel still failing)**

```
cd nova-games/phoenix-a-game && pnpm test -- monsters.test
```
Expected: createMonster + moveMonsterTowards + isBossKind tests PASS; createMonsterModel tests FAIL (expected — Task 4 fixes those).

- [ ] **Step 5: Don't commit yet**

We bundle Task 3 and Task 4 into one commit because `monsters.test.ts` already references the new `createMonsterModel(kind, item)` signature. Proceed directly to Task 4.

---

## Task 4: `createMonsterModel` takes item; attach held weapon mesh

**Files:**
- Modify: `nova-games/phoenix-a-game/src/monsters.ts`

Each per-kind `buildXxx()` returns a model with a `weaponAnchor` Group at the chosen offset. `createMonsterModel(kind, item)` then attaches a held weapon mesh to that anchor, tinted by `QUALITY_COLORS`.

- [ ] **Step 1: Add the weaponAnchor field and a held-weapon mesh helper**

In `nova-games/phoenix-a-game/src/monsters.ts`:

Update the imports at the top to include what we need from state and three:

```ts
import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
} from "three";
import { type Item, QUALITY_COLORS } from "./state";
```

Update `MonsterModel`:

```ts
export interface MonsterModel {
	group: Group;
	flashMaterial: MeshStandardMaterial;
	weaponAnchor: Group;
}
```

Add a private helper `buildHeldWeaponMesh(item: Item): Group` near the bottom of the file:

```ts
function buildHeldWeaponMesh(item: Item): Group {
	const group = new Group();
	const tint = QUALITY_COLORS[item.quality - 1];
	if (item.kind === "sword") {
		const blade = new Mesh(
			new BoxGeometry(0.05, 0.4, 0.02),
			new MeshStandardMaterial({ color: tint, emissive: 0x222222 }),
		);
		blade.position.y = 0.2;
		group.add(blade);
		const guard = new Mesh(
			new BoxGeometry(0.16, 0.04, 0.04),
			new MeshStandardMaterial({ color: 0xddaa44 }),
		);
		group.add(guard);
		const grip = new Mesh(
			new CylinderGeometry(0.02, 0.02, 0.12, 6),
			new MeshStandardMaterial({ color: 0x442211 }),
		);
		grip.position.y = -0.08;
		group.add(grip);
		return group;
	}
	// bow
	const limb = new Mesh(
		new TorusGeometry(0.18, 0.02, 6, 12, Math.PI),
		new MeshStandardMaterial({ color: tint, emissive: 0x331a0d }),
	);
	limb.rotation.x = Math.PI / 2;
	group.add(limb);
	const string = new Mesh(
		new CylinderGeometry(0.004, 0.004, 0.36, 4),
		new MeshStandardMaterial({ color: 0xeeeeee }),
	);
	string.rotation.z = Math.PI / 2;
	group.add(string);
	return group;
}
```

- [ ] **Step 2: Add per-kind anchor offsets**

Add a constant near the top of the file (below the `STATS` constant is fine):

```ts
const WEAPON_ANCHOR: Record<MonsterKind, [number, number, number]> = {
	skeleton: [0.35, 1.1, 0.0],
	zombie: [0.4, 1.0, 0.0],
	grimReaper: [0.45, 1.4, 0.0],
	goblin: [0.3, 0.8, 0.0],
	orc: [0.45, 1.1, 0.0],
	minotaur: [0.5, 1.5, 0.0],
	slime: [0.25, 0.5, 0.0],
	fireElemental: [0.35, 0.9, 0.0],
	lich: [0.4, 1.3, 0.0],
};
```

- [ ] **Step 3: Update each `buildXxx()` to expose a weaponAnchor**

Every `buildXxx` function currently returns `{ group, flashMaterial }`. They all need to return `{ group, flashMaterial, weaponAnchor }`, with `weaponAnchor` created via:

```ts
const weaponAnchor = new Group();
group.add(weaponAnchor);
```

…and added to the group before returning. The anchor's position is set inside `createMonsterModel` based on the `WEAPON_ANCHOR` table (Step 4 below) — the builders themselves leave it at origin.

Edit each of `buildSkeleton`, `buildZombie`, `buildGrimReaper`, `buildGoblin`, `buildOrc`, `buildMinotaur`, `buildSlime`, `buildFireElemental`, `buildLich`:

- Add `const weaponAnchor = new Group(); group.add(weaponAnchor);` near the end of the function.
- Change the return to `return { group, flashMaterial, weaponAnchor };`.

If a builder uses helper variables named `weaponAnchor` already, rename in this scope; otherwise keep consistent.

- [ ] **Step 4: Update `createMonsterModel` to take and attach the held weapon**

Replace `createMonsterModel`:

```ts
export function createMonsterModel(kind: MonsterKind, item: Item): MonsterModel {
	const model = (() => {
		switch (kind) {
			case "skeleton": return buildSkeleton();
			case "zombie": return buildZombie();
			case "grimReaper": return buildGrimReaper();
			case "goblin": return buildGoblin();
			case "orc": return buildOrc();
			case "minotaur": return buildMinotaur();
			case "slime": return buildSlime();
			case "fireElemental": return buildFireElemental();
			case "lich": return buildLich();
		}
	})();
	const [ax, ay, az] = WEAPON_ANCHOR[kind];
	model.weaponAnchor.position.set(ax, ay, az);
	const held = buildHeldWeaponMesh(item);
	model.weaponAnchor.add(held);
	return model;
}
```

- [ ] **Step 5: Run tests**

```
cd nova-games/phoenix-a-game && pnpm test -- monsters.test
```
Expected: all monsters tests PASS.

- [ ] **Step 6: Repo-root checks**

```
pnpm run test
```
Expected: PASS (some tsc errors will remain because `main.ts` still calls `createMonster`/`createMonsterModel` without the new args — that's resolved in Task 7. But if tsc fails here, Task 7's changes can't be deferred any further; see Step 7 below).

**Important:** If `pnpm run test` (root) fails because `main.ts` doesn't compile, do NOT commit yet. Skip to Task 7 first, complete its main.ts changes, then come back and run `pnpm run test` again before committing Tasks 3+4+7 together. The test-and-commit step at the end of Task 7 covers both.

- [ ] **Step 7: Hold the commit**

Tasks 3 and 4 together break main.ts compilation. Combine them with Task 7's main.ts spawn-site changes into a single commit. Tasks 5 and 6 (`tick.ts` sword bonus + `monster_combat.ts` module) can land independently before Task 7 because they don't touch the broken seams — do those next.

---

## Task 5: Sword bonus in `applyContactDamage`

**Files:**
- Modify: `nova-games/phoenix-a-game/src/tick.ts`

Tick already has access to the monster. Add the sword bonus to its damage. **No test file** for tick.ts exists touching `applyContactDamage` (it's tested indirectly via state changes); we add one focused test.

- [ ] **Step 1: Write the failing test**

Create or extend `nova-games/phoenix-a-game/src/tick.test.ts`. If it exists, append. If not, create it with:

```ts
import { describe, expect, it } from "vitest";
import { applyContactDamage } from "./tick";
import type { Monster } from "./monsters";
import { createInitialState, type Item } from "./state";

function makeMonster(damage: number, weapon: Item): Monster {
	return {
		kind: "goblin",
		roomIndex: 0,
		x: 0,
		z: 0,
		hp: 2,
		speed: 3,
		radius: 0.4,
		contact: 0.9,
		damage,
		dormant: false,
		walkPhase: 0,
		weapon,
	};
}

describe("applyContactDamage sword bonus", () => {
	it("adds sword quality to monster base damage", () => {
		const s = createInitialState();
		s.player.iframesUntil = -1;
		const m = makeMonster(1, { kind: "sword", quality: 3 });
		applyContactDamage(s, [m], 0, 0, 0.5);
		expect(s.player.health).toBeCloseTo(3 - (1 + 3), 5);
	});
	it("does not add any bonus for a bow wielder", () => {
		const s = createInitialState();
		s.player.iframesUntil = -1;
		const m = makeMonster(1.5, { kind: "bow", quality: 5 });
		applyContactDamage(s, [m], 0, 0, 0.5);
		expect(s.player.health).toBeCloseTo(3 - 1.5, 5);
	});
});
```

Note: there is no existing `tick.test.ts` for `applyContactDamage` — the existing one in this repo tests `tickPlayer` only. Check first:

```
ls nova-games/phoenix-a-game/src/tick.test.ts
```

If it exists, append the two new describes. If not, the file above is the full content.

- [ ] **Step 2: Run tests**

```
cd nova-games/phoenix-a-game && pnpm test -- tick.test
```
Expected: FAIL — the new tests will assert wrong values until the sword bonus is added.

- [ ] **Step 3: Update `applyContactDamage`**

Replace the body of `applyContactDamage` in `nova-games/phoenix-a-game/src/tick.ts`:

```ts
export function applyContactDamage(
	state: GameState,
	monsters: Monster[],
	playerX: number,
	playerZ: number,
	playerRadius: number,
): void {
	if (state.now < state.player.iframesUntil) return;
	for (const m of monsters) {
		if (m.hp <= 0) continue;
		const d = Math.hypot(m.x - playerX, m.z - playerZ);
		if (d < m.contact + playerRadius) {
			const swordBonus = m.weapon.kind === "sword" ? m.weapon.quality : 0;
			state.player.health = Math.max(0, state.player.health - (m.damage + swordBonus));
			state.player.iframesUntil = state.now + 1;
			state.player.hitFlashUntil = state.now + 0.15;
			break;
		}
	}
}
```

- [ ] **Step 4: Run tests**

```
cd nova-games/phoenix-a-game && pnpm test -- tick.test
```
Expected: PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS — tick.ts and its tests compile fine; main.ts will still be broken by Tasks 3/4 changes from earlier. If `pnpm run test` fails on main.ts type errors, that's the expected interim state — defer the root check + commit until Task 7 lands.

- [ ] **Step 6: Hold the commit**

Same reasoning as Task 4: bundle this with Tasks 3/4/7 into a single integration commit, OR commit this independently if Task 5's tests pass standalone (the `m.weapon.kind` read works as long as `Monster.weapon` was defined in Task 3, which it is).

Practical guidance: commit Task 5 now if Tasks 3+4 were already merged. Otherwise hold.

```
git add nova-games/phoenix-a-game/src/tick.ts nova-games/phoenix-a-game/src/tick.test.ts
git commit -m "phoenix-a-game: add sword-quality bonus to monster contact damage"
```

Only run this commit if `pnpm run test` (root) passes. If main.ts is mid-refactor (Tasks 3+4 done, Task 7 not yet), defer to the bundled commit.

---

## Task 6: `monster_combat.ts` module — bow AI

**Files:**
- Create: `nova-games/phoenix-a-game/src/monster_combat.ts`
- Test: `nova-games/phoenix-a-game/src/monster_combat.test.ts`

This module owns the kite + shoot AI. Pure functions; no rendering.

- [ ] **Step 1: Write the failing tests**

Create `nova-games/phoenix-a-game/src/monster_combat.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
	BOW_BACKAWAY_THRESHOLD,
	BOW_FIRE_INTERVAL,
	BOW_MAX_FIRE_RANGE,
	BOW_PREFERRED_RANGE,
	type FireMonsterArrow,
	updateBowMonster,
} from "./monster_combat";
import type { Monster } from "./monsters";
import type { Item } from "./state";

const BOW: Item = { kind: "bow", quality: 2 };

function makeBowMonster(x: number, z: number): Monster {
	return {
		kind: "goblin",
		roomIndex: 0,
		x,
		z,
		hp: 2,
		speed: 3,
		radius: 0.4,
		contact: 0.9,
		damage: 0.5,
		dormant: false,
		walkPhase: 0,
		weapon: BOW,
		nextShotAt: 0,
	};
}

describe("updateBowMonster movement", () => {
	it("walks toward player at half speed when outside preferred range", () => {
		const m = makeBowMonster(0, 0);
		const fire = vi.fn();
		const startX = m.x;
		updateBowMonster(m, BOW_PREFERRED_RANGE + 4, 0, 1, 0, fire);
		expect(m.x).toBeGreaterThan(startX);
		expect(m.x).toBeLessThan(startX + m.speed * 1); // less than full speed
		expect(m.x).toBeCloseTo(m.speed * 0.5 * 1, 5);
	});
	it("stands still in preferred range band", () => {
		const distance = (BOW_PREFERRED_RANGE + BOW_BACKAWAY_THRESHOLD) / 2;
		const m = makeBowMonster(0, 0);
		const fire = vi.fn();
		updateBowMonster(m, distance, 0, 0.5, 0, fire);
		expect(m.x).toBe(0);
	});
	it("backs away at full speed when too close", () => {
		const m = makeBowMonster(0, 0);
		const fire = vi.fn();
		updateBowMonster(m, BOW_BACKAWAY_THRESHOLD - 1, 0, 1, 0, fire);
		expect(m.x).toBeLessThan(0);
		expect(Math.abs(m.x)).toBeCloseTo(m.speed * 1, 5);
	});
	it("does not move or fire when dormant", () => {
		const m = makeBowMonster(0, 0);
		m.dormant = true;
		const fire = vi.fn();
		updateBowMonster(m, 5, 0, 1, 0, fire);
		expect(m.x).toBe(0);
		expect(fire).not.toHaveBeenCalled();
	});
});

describe("updateBowMonster shooting", () => {
	it("fires when in range and cooldown elapsed", () => {
		const m = makeBowMonster(0, 0);
		const fire = vi.fn();
		updateBowMonster(m, BOW_PREFERRED_RANGE, 0, 0, 1, fire);
		expect(fire).toHaveBeenCalledTimes(1);
		expect(m.nextShotAt).toBeCloseTo(1 + BOW_FIRE_INTERVAL, 5);
	});
	it("does not fire when out of max fire range", () => {
		const m = makeBowMonster(0, 0);
		const fire = vi.fn();
		updateBowMonster(m, BOW_MAX_FIRE_RANGE + 1, 0, 0, 1, fire);
		expect(fire).not.toHaveBeenCalled();
	});
	it("does not fire before cooldown elapses", () => {
		const m = makeBowMonster(0, 0);
		m.nextShotAt = 10;
		const fire = vi.fn();
		updateBowMonster(m, BOW_PREFERRED_RANGE, 0, 0, 1, fire);
		expect(fire).not.toHaveBeenCalled();
	});
	it("provides a unit direction vector to fire callback", () => {
		const m = makeBowMonster(0, 0);
		const fire: FireMonsterArrow = vi.fn();
		updateBowMonster(m, 6, 8, 0, 1, fire);
		const callArgs = (fire as ReturnType<typeof vi.fn>).mock.calls[0];
		const [monsterArg, dirX, dirZ] = callArgs;
		expect(monsterArg).toBe(m);
		expect(dirX).toBeCloseTo(0.6, 2); // 6/10
		expect(dirZ).toBeCloseTo(0.8, 2); // 8/10
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd nova-games/phoenix-a-game && pnpm test -- monster_combat.test
```
Expected: FAIL — "Cannot find module './monster_combat'".

- [ ] **Step 3: Implement the module**

Create `nova-games/phoenix-a-game/src/monster_combat.ts`:

```ts
import type { Monster } from "./monsters";

export const BOW_FIRE_INTERVAL = 1.5;
export const BOW_PREFERRED_RANGE = 7;
export const BOW_BACKAWAY_THRESHOLD = 4;
export const BOW_MAX_FIRE_RANGE = 12;

const BOW_CHASE_TAKEOVER_RANGE = BOW_MAX_FIRE_RANGE * 1.5;

export type FireMonsterArrow = (
	m: Monster,
	dirX: number,
	dirZ: number,
) => void;

export function updateBowMonster(
	m: Monster,
	playerX: number,
	playerZ: number,
	dt: number,
	now: number,
	fire: FireMonsterArrow,
): void {
	if (m.dormant) return;
	const dx = playerX - m.x;
	const dz = playerZ - m.z;
	const distance = Math.hypot(dx, dz);
	if (distance < 0.0001) return;

	const ux = dx / distance;
	const uz = dz / distance;

	// Movement bands
	if (distance > BOW_CHASE_TAKEOVER_RANGE) {
		// far away — chase at full speed
		const step = m.speed * dt;
		m.x += ux * step;
		m.z += uz * step;
	} else if (distance > BOW_PREFERRED_RANGE) {
		// approach at half speed
		const step = m.speed * 0.5 * dt;
		m.x += ux * step;
		m.z += uz * step;
	} else if (distance < BOW_BACKAWAY_THRESHOLD) {
		// kite away at full speed
		const step = m.speed * dt;
		m.x -= ux * step;
		m.z -= uz * step;
	}
	// else: in preferred band — hold position

	// Shooting
	if (
		distance <= BOW_MAX_FIRE_RANGE &&
		m.nextShotAt !== undefined &&
		now >= m.nextShotAt
	) {
		fire(m, ux, uz);
		m.nextShotAt = now + BOW_FIRE_INTERVAL;
	}
}
```

- [ ] **Step 4: Run tests**

```
cd nova-games/phoenix-a-game && pnpm test -- monster_combat.test
```
Expected: PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS — `monster_combat.ts` is standalone; main.ts state irrelevant.

- [ ] **Step 6: Commit**

If main.ts compilation is still broken from Tasks 3/4, defer this commit until after Task 7. Otherwise:

```
git add nova-games/phoenix-a-game/src/monster_combat.ts nova-games/phoenix-a-game/src/monster_combat.test.ts
git commit -m "phoenix-a-game: monster_combat module — bow kite AI + fire callback"
```

---

## Task 7: main.ts integration — spawn weapons, dispatch bow AI, fire monster arrows, drop on death

**Files:**
- Modify: `nova-games/phoenix-a-game/src/main.ts`

This is the integration task. It fixes the broken compilation from Tasks 3/4, adds bow dispatch, monster-arrow handling, and death-drops. After this task lands, the feature is fully integrated.

- [ ] **Step 1: Update imports**

In `nova-games/phoenix-a-game/src/main.ts`, ensure these imports exist:

- Add to existing `./monsters` import: nothing new (`createMonster`, `createMonsterModel`, `Monster`, `MonsterKind`, `moveMonsterTowards` already present).
- Add to existing `./loot` import: `rollMonsterWeapon`. The import line becomes:
  ```ts
  import { type Chest, createChest, rollMonsterWeapon } from "./loot";
  ```
- Add a new import for monster_combat:
  ```ts
  import { updateBowMonster, type FireMonsterArrow } from "./monster_combat";
  ```
- The existing `./state` import already includes `Item` and `QUALITY_COLORS`. No change there.

- [ ] **Step 2: Update spawnMonster and spawnBoss**

Replace `spawnMonster`:

```ts
function spawnMonster(roomIndex: number, kind: MonsterKind) {
	const room = grid.rooms[roomIndex];
	const jitterX = (Math.random() - 0.5) * 4;
	const jitterZ = (Math.random() - 0.5) * 4;
	const weapon = rollMonsterWeapon(Math.random, state.floor, false);
	const m = createMonster(
		kind,
		room.centerX + jitterX,
		room.centerZ + jitterZ,
		roomIndex,
		weapon,
	);
	const model = createMonsterModel(kind, weapon);
	m.mesh = model.group;
	m.flashMaterial = model.flashMaterial;
	scene.add(m.mesh);
	monsters.push(m);
}
```

Replace `spawnBoss`:

```ts
function spawnBoss() {
	if (boss) return;
	const weapon = rollMonsterWeapon(Math.random, state.floor, true);
	const m = createMonster(
		level.bossEnemy,
		bossRoom.centerX,
		bossRoom.centerZ,
		level.boss,
		weapon,
	);
	const model = createMonsterModel(level.bossEnemy, weapon);
	m.mesh = model.group;
	m.flashMaterial = model.flashMaterial;
	scene.add(m.mesh);
	boss = m;
	monsters.push(boss);
}
```

- [ ] **Step 3: Add `fireMonsterArrow` helper**

Above `function animate()`, add:

```ts
const fireMonsterArrow: FireMonsterArrow = (m, dirX, dirZ) => {
	const damage = m.weapon.quality;
	const color = 0x661111; // dim red — distinct from player arrows
	const spawnY = 1.0;
	const arrow = createArrow(
		m.x,
		spawnY,
		m.z,
		dirX,
		0,
		dirZ,
		damage,
		color,
		state.now,
		"monster",
	);
	arrows.push(arrow);
	scene.add(arrow.mesh);
};
```

- [ ] **Step 4: Branch the monster move loop on weapon kind**

Inside `animate()`, find the existing monster move loop (the one calling `moveMonsterTowards`). Replace its `moveMonsterTowards` call with a branch:

```ts
for (const m of monsters) {
	if (m.hp <= 0) continue;
	if (m.weapon.kind === "bow") {
		updateBowMonster(
			m,
			player.position.x,
			player.position.z,
			dt,
			state.now,
			fireMonsterArrow,
		);
	} else {
		moveMonsterTowards(m, player.position.x, player.position.z, dt);
	}
	const resolvedM = resolveAll(m.x, m.z, m.radius, walls);
	m.x = resolvedM.x;
	m.z = resolvedM.z;
	// ... rest of the existing mesh-update block stays unchanged ...
}
```

(Keep all the existing mesh-rotation / walk-phase / squash / flash code unchanged below the `resolveAll` call.)

- [ ] **Step 5: Branch `handleArrowHit` on `source`**

Replace `handleArrowHit` with:

```ts
function handleArrowHit(a: Arrow) {
	if (a.source === "player") {
		for (const m of monsters) {
			if (m.hp <= 0) continue;
			if (arrowHitsMonster(a, m)) {
				m.hp -= a.damage;
				m.flashUntil = state.now + 0.15;
				m.hitSquashUntil = state.now + 0.18;
				a.alive = false;
				return;
			}
		}
	} else {
		// monster arrow → hits the player
		if (state.now >= state.player.iframesUntil) {
			if (
				arrowHitsCircleXZ(
					a,
					player.position.x,
					player.position.z,
					PLAYER_RADIUS,
				)
			) {
				state.player.health = Math.max(0, state.player.health - a.damage);
				state.player.iframesUntil = state.now + 1;
				state.player.hitFlashUntil = state.now + 0.15;
				a.alive = false;
				return;
			}
		}
	}
	if (arrowHitsAabb(a, activeWalls())) {
		a.alive = false;
	}
}
```

The `arrowHitsCircleXZ` import is needed at the top of main.ts — add to the existing `./arrows` import:

```ts
import {
	type Arrow,
	arrowExpired,
	arrowHitsAabb,
	arrowHitsCircleXZ,
	arrowHitsMonster,
	createArrow,
	updateArrow,
} from "./arrows";
```

- [ ] **Step 6: Drop weapon at monster death**

Find the existing block that disposes a dead monster's mesh:

```ts
for (const m of monsters) {
	if (m.hp <= 0 && m.mesh) {
		disposeObject(m.mesh);
		m.mesh = undefined;
	}
}
```

Replace it with:

```ts
for (const m of monsters) {
	if (m.hp <= 0 && m.mesh) {
		const drop = createWorldDrop(
			m.weapon,
			m.x,
			0.7,
			m.z,
			0,
			0,
			0,
			state.now,
		);
		drop.settled = true;
		drops.push(drop);
		scene.add(drop.mesh);
		disposeObject(m.mesh);
		m.mesh = undefined;
	}
}
```

- [ ] **Step 7: Run unit tests**

```
cd nova-games/phoenix-a-game && pnpm test
```
Expected: PASS (all tests, including monsters, loot, arrows, tick, monster_combat).

- [ ] **Step 8: Run repo-root checks**

```
pnpm run test
```
Expected: PASS (tsc + biome clean).

- [ ] **Step 9: Smoke test in browser**

```
pnpm dev
```

Verify:
1. Enemies visibly carry weapons (small sword or bow attached to body, tinted by quality).
2. Walking into a sword-wielder hits harder than before (try a goblin with a non-common sword vs the old common-only baseline).
3. Bow-wielders shoot dim-red arrows at you and back away when you close.
4. Killing an enemy spawns a floating weapon at their feet; spacebar picks it up.
5. Full-hotbar pickup throws the displaced item.
6. Dormant enemies (un-awakened rooms) don't fire.
7. Boss carries a weapon too; its damage is higher.

- [ ] **Step 10: Commit**

```
git add nova-games/phoenix-a-game/src/main.ts nova-games/phoenix-a-game/src/monsters.ts nova-games/phoenix-a-game/src/monsters.test.ts nova-games/phoenix-a-game/src/tick.ts nova-games/phoenix-a-game/src/tick.test.ts nova-games/phoenix-a-game/src/monster_combat.ts nova-games/phoenix-a-game/src/monster_combat.test.ts
git commit -m "phoenix-a-game: enemies carry tiered weapons (sword bonus, bow AI, drops)"
```

This commit contains Tasks 3, 4, 5, 6, and 7 if Tasks 5 and 6 weren't already committed independently. Adjust the `git add` list to match what's still uncommitted at this point.

---

## Wrap-up

After Task 7 (or the bundled commit), the feature is complete. Run a final repo-root `pnpm run test` and `pnpm run build` to confirm green. Then proceed to `finishing-a-development-branch`.
