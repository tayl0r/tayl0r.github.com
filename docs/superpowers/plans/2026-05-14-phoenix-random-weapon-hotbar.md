# phoenix-a-game: Random Weapon Tiers + Hotbar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `swordDamage`/`bowDamage`/`weapon` damage-bump pickups with a 10-slot
Minecraft-style hotbar where chests drop randomly-tiered weapons, Q/E cycle slots,
right-click throws the selected item forward, and spacebar is a proximity interact verb
for doors / switches / chests / pickups.

**Architecture:** Phase 1 adds new modules (`hotbar.ts`, `world_drops.ts`,
`interact.ts`) and additive state/input/HUD changes — every commit stays green
alongside the legacy system. Phase 2 swaps `main.ts` over to the new wiring in four
focused commits, then deletes the legacy fields, types, and code paths.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-05-14-phoenix-random-weapon-hotbar-design.md`.

**Work directory:** `nova-games/phoenix-a-game/`. Run `pnpm test` from there for unit
tests (vitest); run `pnpm run test` from the repo root for `tsc --noEmit && biome
check .`. Both must stay green at every commit.

---

## File map

**New files:**
- `nova-games/phoenix-a-game/src/hotbar.ts`
- `nova-games/phoenix-a-game/src/hotbar.test.ts`
- `nova-games/phoenix-a-game/src/world_drops.ts`
- `nova-games/phoenix-a-game/src/world_drops.test.ts`
- `nova-games/phoenix-a-game/src/interact.ts`
- `nova-games/phoenix-a-game/src/interact.test.ts`

**Heavy edits:**
- `nova-games/phoenix-a-game/src/state.ts`
- `nova-games/phoenix-a-game/src/loot.ts`
- `nova-games/phoenix-a-game/src/input.ts`
- `nova-games/phoenix-a-game/src/hud.ts`
- `nova-games/phoenix-a-game/src/main.ts`
- `nova-games/phoenix-a-game/index.html`

**Light edits:**
- `nova-games/phoenix-a-game/src/player.ts` (delete `WEAPON_COLORS` + `weaponColorFor`)
- `nova-games/phoenix-a-game/src/state.test.ts`
- `nova-games/phoenix-a-game/src/loot.test.ts`

---

## Task 1: State foundations — Item, Quality, hotbar fields (additive)

**Files:**
- Modify: `nova-games/phoenix-a-game/src/state.ts`
- Test: `nova-games/phoenix-a-game/src/state.test.ts`

We add the new types and player fields **alongside** the legacy `swordDamage` /
`bowDamage` / `weapon` so the existing `main.ts` keeps compiling. The legacy fields
are deleted in Task 14.

- [ ] **Step 1: Write the failing tests**

Append to `nova-games/phoenix-a-game/src/state.test.ts`:

```ts
import {
	canAttack,
	consumeAttackStamina,
	createInitialState,
	damageOf,
	equippedItem,
	HOTBAR_SIZE,
	QUALITY_COLORS,
	QUALITY_NAMES,
} from "./state";

describe("Item / Quality constants", () => {
	it("exposes 6 quality names in ascending order", () => {
		expect(QUALITY_NAMES).toEqual([
			"common",
			"uncommon",
			"rare",
			"epic",
			"legendary",
			"godly",
		]);
	});
	it("has a color per quality tier", () => {
		expect(QUALITY_COLORS).toHaveLength(6);
		for (const c of QUALITY_COLORS) {
			expect(typeof c).toBe("number");
		}
	});
	it("damageOf returns the quality number", () => {
		expect(damageOf(1)).toBe(1);
		expect(damageOf(6)).toBe(6);
	});
	it("HOTBAR_SIZE is 10", () => {
		expect(HOTBAR_SIZE).toBe(10);
	});
});

describe("initial hotbar", () => {
	it("starts with a common sword in slot 0 and nine empty slots", () => {
		const s = createInitialState();
		expect(s.player.hotbar).toHaveLength(10);
		expect(s.player.hotbar[0]).toEqual({ kind: "sword", quality: 1 });
		for (let i = 1; i < 10; i++) {
			expect(s.player.hotbar[i]).toBeNull();
		}
		expect(s.player.selectedSlot).toBe(0);
	});
	it("equippedItem returns the contents of the selected slot", () => {
		const s = createInitialState();
		expect(equippedItem(s)).toEqual({ kind: "sword", quality: 1 });
		s.player.hotbar[0] = null;
		expect(equippedItem(s)).toBeNull();
		s.player.hotbar[3] = { kind: "bow", quality: 4 };
		s.player.selectedSlot = 3;
		expect(equippedItem(s)).toEqual({ kind: "bow", quality: 4 });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `nova-games/phoenix-a-game/`:
```
pnpm test -- state.test
```
Expected: FAIL with "module has no exported member 'Item'" / "damageOf is not a function".

- [ ] **Step 3: Implement state.ts additions**

Replace `nova-games/phoenix-a-game/src/state.ts` entirely with:

```ts
export type Weapon = "sword" | "bow";

export type ItemKind = "sword" | "bow" | "food";
export type Quality = 1 | 2 | 3 | 4 | 5 | 6;

export interface Item {
	kind: ItemKind;
	quality: Quality;
}

export const HOTBAR_SIZE = 10;

export const QUALITY_NAMES = [
	"common",
	"uncommon",
	"rare",
	"epic",
	"legendary",
	"godly",
] as const;

export const QUALITY_COLORS: readonly number[] = [
	0xcccccc, // common
	0x44dd44, // uncommon
	0x4488ff, // rare
	0xcc44ff, // epic
	0xffaa22, // legendary
	0xff3333, // godly
];

export function damageOf(quality: Quality): number {
	return quality;
}

export const STAMINA_PER_ATTACK = 1;
export const STAMINA_REGEN_DELAY = 1;

export interface PlayerState {
	health: number;
	maxHealth: number;
	stamina: number;
	maxStamina: number;
	// Legacy — removed in Task 14
	swordDamage: number;
	bowDamage: number;
	weapon: Weapon;
	// New
	hotbar: (Item | null)[];
	selectedSlot: number;
	iframesUntil: number;
	hitFlashUntil: number;
	lastAttackAt: number;
}

export interface GameState {
	player: PlayerState;
	now: number;
	phase: "playing" | "dead" | "won";
	floor: number;
}

export function createInitialState(): GameState {
	const hotbar: (Item | null)[] = new Array(HOTBAR_SIZE).fill(null);
	hotbar[0] = { kind: "sword", quality: 1 };
	return {
		player: {
			health: 3,
			maxHealth: 3,
			stamina: 100,
			maxStamina: 100,
			swordDamage: 1,
			bowDamage: 1,
			weapon: "sword",
			hotbar,
			selectedSlot: 0,
			iframesUntil: 0,
			hitFlashUntil: 0,
			lastAttackAt: -Infinity,
		},
		now: 0,
		phase: "playing",
		floor: 0,
	};
}

export function equippedItem(state: GameState): Item | null {
	return state.player.hotbar[state.player.selectedSlot] ?? null;
}

export function canAttack(state: GameState): boolean {
	return state.player.stamina >= STAMINA_PER_ATTACK;
}

export function consumeAttackStamina(state: GameState): void {
	state.player.stamina = Math.max(0, state.player.stamina - STAMINA_PER_ATTACK);
	state.player.lastAttackAt = state.now;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test -- state.test
```
Expected: all tests in state.test.ts PASS, no other tests broken.

- [ ] **Step 5: Run repo-root checks**

From repo root:
```
pnpm run test
```
Expected: PASS (tsc + biome).

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/state.ts nova-games/phoenix-a-game/src/state.test.ts
git commit -m "phoenix-a-game: add Item/Quality types and hotbar fields to state"
```

---

## Task 2: Hotbar module

**Files:**
- Create: `nova-games/phoenix-a-game/src/hotbar.ts`
- Test: `nova-games/phoenix-a-game/src/hotbar.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `nova-games/phoenix-a-game/src/hotbar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	addItem,
	cycle,
	firstEmptySlot,
	removeSlot,
	selectSlot,
} from "./hotbar";
import { createInitialState, type Item } from "./state";

const SWORD: Item = { kind: "sword", quality: 1 };
const BOW: Item = { kind: "bow", quality: 3 };
const FOOD: Item = { kind: "food", quality: 1 };

describe("cycle", () => {
	it("steps forward and wraps", () => {
		const s = createInitialState();
		s.player.selectedSlot = 0;
		cycle(s, 1);
		expect(s.player.selectedSlot).toBe(1);
		s.player.selectedSlot = 9;
		cycle(s, 1);
		expect(s.player.selectedSlot).toBe(0);
	});
	it("steps backward and wraps", () => {
		const s = createInitialState();
		s.player.selectedSlot = 0;
		cycle(s, -1);
		expect(s.player.selectedSlot).toBe(9);
	});
});

describe("selectSlot", () => {
	it("clamps to 0..9", () => {
		const s = createInitialState();
		selectSlot(s, 5);
		expect(s.player.selectedSlot).toBe(5);
		selectSlot(s, -3);
		expect(s.player.selectedSlot).toBe(0);
		selectSlot(s, 99);
		expect(s.player.selectedSlot).toBe(9);
	});
});

describe("firstEmptySlot", () => {
	it("returns the lowest empty slot index", () => {
		const s = createInitialState();
		expect(firstEmptySlot(s)).toBe(1);
		s.player.hotbar[1] = BOW;
		expect(firstEmptySlot(s)).toBe(2);
	});
	it("returns -1 when full", () => {
		const s = createInitialState();
		for (let i = 0; i < 10; i++) s.player.hotbar[i] = SWORD;
		expect(firstEmptySlot(s)).toBe(-1);
	});
});

describe("addItem", () => {
	it("fills the first empty slot when one exists", () => {
		const s = createInitialState();
		const result = addItem(s, BOW);
		expect(result.slotted).toBe(1);
		expect(result.displaced).toBeNull();
		expect(s.player.hotbar[1]).toBe(BOW);
	});
	it("replaces the selected slot when hotbar is full", () => {
		const s = createInitialState();
		for (let i = 0; i < 10; i++) s.player.hotbar[i] = SWORD;
		s.player.selectedSlot = 4;
		const result = addItem(s, BOW);
		expect(result.slotted).toBe(4);
		expect(result.displaced).toEqual(SWORD);
		expect(s.player.hotbar[4]).toBe(BOW);
	});
});

describe("removeSlot", () => {
	it("clears and returns the slot contents", () => {
		const s = createInitialState();
		s.player.hotbar[3] = FOOD;
		expect(removeSlot(s, 3)).toBe(FOOD);
		expect(s.player.hotbar[3]).toBeNull();
	});
	it("returns null for an empty slot", () => {
		const s = createInitialState();
		expect(removeSlot(s, 5)).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- hotbar.test
```
Expected: FAIL — "Cannot find module './hotbar'".

- [ ] **Step 3: Implement hotbar.ts**

Create `nova-games/phoenix-a-game/src/hotbar.ts`:

```ts
import { HOTBAR_SIZE, type Item, type GameState } from "./state";

export function cycle(state: GameState, dir: -1 | 1): void {
	const next = (state.player.selectedSlot + dir + HOTBAR_SIZE) % HOTBAR_SIZE;
	state.player.selectedSlot = next;
}

export function selectSlot(state: GameState, slot: number): void {
	const clamped = Math.max(0, Math.min(HOTBAR_SIZE - 1, Math.floor(slot)));
	state.player.selectedSlot = clamped;
}

export function firstEmptySlot(state: GameState): number {
	for (let i = 0; i < HOTBAR_SIZE; i++) {
		if (state.player.hotbar[i] === null) return i;
	}
	return -1;
}

export interface AddResult {
	slotted: number;
	displaced: Item | null;
}

export function addItem(state: GameState, item: Item): AddResult {
	const empty = firstEmptySlot(state);
	if (empty !== -1) {
		state.player.hotbar[empty] = item;
		return { slotted: empty, displaced: null };
	}
	const slot = state.player.selectedSlot;
	const displaced = state.player.hotbar[slot] ?? null;
	state.player.hotbar[slot] = item;
	return { slotted: slot, displaced };
}

export function removeSlot(state: GameState, slot: number): Item | null {
	const prev = state.player.hotbar[slot] ?? null;
	state.player.hotbar[slot] = null;
	return prev;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test -- hotbar.test
```
Expected: all hotbar.test.ts cases PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/hotbar.ts nova-games/phoenix-a-game/src/hotbar.test.ts
git commit -m "phoenix-a-game: add hotbar module (cycle/select/add/remove)"
```

---

## Task 3: Quality-tier drop rolls in loot.ts (additive)

**Files:**
- Modify: `nova-games/phoenix-a-game/src/loot.ts`
- Test: `nova-games/phoenix-a-game/src/loot.test.ts`

We add `rollItemDrop` next to the existing `rollDrop`/`pickupDrop`. Legacy code paths
keep working until Task 14 deletes them.

- [ ] **Step 1: Write the failing tests**

Append to `nova-games/phoenix-a-game/src/loot.test.ts`:

```ts
import { rollItemDrop } from "./loot";
import type { Quality } from "./state";

function deterministicRng(seed = 0): () => number {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) & 0x7fffffff;
		return (x / 0x80000000) % 1;
	};
}

describe("rollItemDrop kind distribution (normal chest)", () => {
	it("produces only sword/bow/food", () => {
		const rng = deterministicRng(1);
		for (let i = 0; i < 200; i++) {
			const item = rollItemDrop(rng, 0, false);
			expect(["sword", "bow", "food"]).toContain(item.kind);
		}
	});
	it("never returns food for a boss chest", () => {
		const rng = deterministicRng(2);
		for (let i = 0; i < 200; i++) {
			const item = rollItemDrop(rng, 0, true);
			expect(item.kind === "food").toBe(false);
		}
	});
});

describe("rollItemDrop quality curve", () => {
	it("floor 0 produces mostly common", () => {
		const rng = deterministicRng(3);
		let common = 0;
		let total = 0;
		for (let i = 0; i < 2000; i++) {
			const item = rollItemDrop(rng, 0, false);
			if (item.kind === "food") continue;
			total++;
			if (item.quality === 1) common++;
		}
		expect(common / total).toBeGreaterThan(0.4);
	});
	it("floor 4+ produces meaningful rare/epic/legendary", () => {
		const rng = deterministicRng(4);
		let highTier = 0;
		let total = 0;
		for (let i = 0; i < 2000; i++) {
			const item = rollItemDrop(rng, 4, false);
			if (item.kind === "food") continue;
			total++;
			if (item.quality >= 3) highTier++;
		}
		expect(highTier / total).toBeGreaterThan(0.5);
	});
	it("never produces godly on floor 0", () => {
		const rng = deterministicRng(5);
		for (let i = 0; i < 500; i++) {
			const item = rollItemDrop(rng, 0, false);
			if (item.kind !== "food") {
				expect(item.quality).toBeLessThan(6);
			}
		}
	});
	it("clamps to last band past floor 4", () => {
		const rng1 = deterministicRng(6);
		const rng2 = deterministicRng(6);
		const a = rollItemDrop(rng1, 4, false);
		const b = rollItemDrop(rng2, 99, false);
		expect(a).toEqual(b);
	});
	it("returns a valid Quality between 1 and 6", () => {
		const rng = deterministicRng(7);
		for (let i = 0; i < 200; i++) {
			const item = rollItemDrop(rng, 2, false);
			if (item.kind === "food") {
				expect(item.quality).toBe(1);
			} else {
				expect(item.quality).toBeGreaterThanOrEqual(1);
				expect(item.quality).toBeLessThanOrEqual(6);
			}
		}
	});
	it("boss chest on floor N rolls quality like floor N+1", () => {
		// Boss at floor 0 should sometimes roll legendary; floor 0 non-boss never does
		const rng = deterministicRng(8);
		let legendaryOrAbove = 0;
		for (let i = 0; i < 3000; i++) {
			const item = rollItemDrop(rng, 0, true);
			if (item.quality >= 5) legendaryOrAbove++;
		}
		expect(legendaryOrAbove).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- loot.test
```
Expected: FAIL — "module './loot' has no exported member 'rollItemDrop'".

- [ ] **Step 3: Implement rollItemDrop**

Append to `nova-games/phoenix-a-game/src/loot.ts` (do NOT touch the existing
`rollDrop`/`pickupDrop`/`openChest`):

```ts
import type { Item, ItemKind, Quality } from "./state";

const QUALITY_WEIGHTS: readonly (readonly number[])[] = [
	[55, 30, 12, 3, 0, 0], // floor 0
	[35, 35, 20, 8, 2, 0], // floor 1
	[20, 30, 28, 15, 6, 1], // floor 2
	[10, 22, 28, 22, 13, 5], // floor 3
	[5, 15, 25, 25, 20, 10], // floor 4+
];

function rollQuality(rng: () => number, band: number): Quality {
	const weights = QUALITY_WEIGHTS[Math.min(band, QUALITY_WEIGHTS.length - 1)];
	const total = weights.reduce((a, b) => a + b, 0);
	let r = rng() * total;
	for (let i = 0; i < weights.length; i++) {
		r -= weights[i];
		if (r < 0) return (i + 1) as Quality;
	}
	return weights.length as Quality;
}

function rollKind(rng: () => number, boss: boolean): ItemKind {
	if (boss) {
		return rng() < 0.5 ? "sword" : "bow";
	}
	const r = rng();
	if (r < 0.35) return "food";
	if (r < 0.7) return "sword";
	return "bow";
}

export function rollItemDrop(
	rng: () => number,
	floor: number,
	boss: boolean,
): Item {
	const kind = rollKind(rng, boss);
	if (kind === "food") return { kind, quality: 1 };
	const band = Math.max(0, Math.floor(floor)) + (boss ? 1 : 0);
	const quality = rollQuality(rng, band);
	return { kind, quality };
}
```

- [ ] **Step 4: Run tests**

```
pnpm test -- loot.test
```
Expected: all loot.test.ts cases (legacy + new) PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/loot.ts nova-games/phoenix-a-game/src/loot.test.ts
git commit -m "phoenix-a-game: add tier-based rollItemDrop with floor-scaled curve"
```

---

## Task 4: World-drop module — types, mesh factory, create

**Files:**
- Create: `nova-games/phoenix-a-game/src/world_drops.ts`
- Test: `nova-games/phoenix-a-game/src/world_drops.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `nova-games/phoenix-a-game/src/world_drops.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	createDropMesh,
	createWorldDrop,
	markPickedUp,
	updateWorldDrop,
} from "./world_drops";
import { QUALITY_COLORS, type Item } from "./state";

const SWORD_EPIC: Item = { kind: "sword", quality: 4 };
const BOW_GODLY: Item = { kind: "bow", quality: 6 };
const FOOD: Item = { kind: "food", quality: 1 };

describe("createDropMesh", () => {
	it("returns a Group for each kind", () => {
		expect(createDropMesh(SWORD_EPIC).type).toBe("Group");
		expect(createDropMesh(BOW_GODLY).type).toBe("Group");
		expect(createDropMesh(FOOD).type).toBe("Group");
	});
});

describe("createWorldDrop", () => {
	it("captures position, velocity, and item", () => {
		const d = createWorldDrop(SWORD_EPIC, 1, 2, 3, 4, 5, 6, 100);
		expect(d.item).toBe(SWORD_EPIC);
		expect(d.x).toBe(1);
		expect(d.y).toBe(2);
		expect(d.z).toBe(3);
		expect(d.vx).toBe(4);
		expect(d.vy).toBe(5);
		expect(d.vz).toBe(6);
		expect(d.spawnedAt).toBe(100);
		expect(d.settled).toBe(false);
		expect(d.pickedUpAt).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- world_drops.test
```
Expected: FAIL — "Cannot find module './world_drops'".

- [ ] **Step 3: Implement createDropMesh + createWorldDrop**

Create `nova-games/phoenix-a-game/src/world_drops.ts`:

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

export const DROP_FADE_DURATION = 0.6;
export const DROP_FLOOR_Y = 0.3;
const GRAVITY = 9.8;

export function createDropMesh(item: Item): Group {
	const group = new Group();
	if (item.kind === "food") {
		const apple = new Mesh(
			new SphereGeometry(0.18, 14, 10),
			new MeshStandardMaterial({
				color: 0xcc2222,
				emissive: 0x441111,
				transparent: true,
			}),
		);
		group.add(apple);
		const stem = new Mesh(
			new CylinderGeometry(0.015, 0.015, 0.08, 4),
			new MeshStandardMaterial({ color: 0x553311, transparent: true }),
		);
		stem.position.y = 0.2;
		group.add(stem);
		const leaf = new Mesh(
			new ConeGeometry(0.05, 0.08, 4),
			new MeshStandardMaterial({ color: 0x44aa44, transparent: true }),
		);
		leaf.position.set(0.06, 0.22, 0);
		leaf.rotation.z = Math.PI / 4;
		group.add(leaf);
		return group;
	}
	const tint = QUALITY_COLORS[item.quality - 1];
	if (item.kind === "bow") {
		const limb = new Mesh(
			new TorusGeometry(0.22, 0.025, 6, 12, Math.PI),
			new MeshStandardMaterial({
				color: tint,
				emissive: 0x331a0d,
				transparent: true,
			}),
		);
		limb.rotation.x = Math.PI / 2;
		group.add(limb);
		const string = new Mesh(
			new CylinderGeometry(0.005, 0.005, 0.44, 4),
			new MeshStandardMaterial({ color: 0xeeeeee, transparent: true }),
		);
		string.position.x = 0.22;
		string.rotation.z = Math.PI / 2;
		group.add(string);
		return group;
	}
	// sword
	const blade = new Mesh(
		new BoxGeometry(0.06, 0.55, 0.025),
		new MeshStandardMaterial({
			color: tint,
			emissive: 0x333333,
			transparent: true,
		}),
	);
	blade.position.y = 0.05;
	group.add(blade);
	const guard = new Mesh(
		new BoxGeometry(0.22, 0.05, 0.05),
		new MeshStandardMaterial({
			color: 0xddaa44,
			emissive: 0x442200,
			transparent: true,
		}),
	);
	guard.position.y = -0.22;
	group.add(guard);
	const grip = new Mesh(
		new CylinderGeometry(0.025, 0.025, 0.16, 6),
		new MeshStandardMaterial({ color: 0x442211, transparent: true }),
	);
	grip.position.y = -0.32;
	group.add(grip);
	const pommel = new Mesh(
		new SphereGeometry(0.04, 8, 6),
		new MeshStandardMaterial({
			color: 0xddaa44,
			emissive: 0x442200,
			transparent: true,
		}),
	);
	pommel.position.y = -0.42;
	group.add(pommel);
	return group;
}

export interface WorldDrop {
	item: Item;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	mesh: Group;
	spawnedAt: number;
	settled: boolean;
	pickedUpAt?: number;
}

export function createWorldDrop(
	item: Item,
	x: number,
	y: number,
	z: number,
	vx: number,
	vy: number,
	vz: number,
	now: number,
): WorldDrop {
	const mesh = createDropMesh(item);
	mesh.position.set(x, y, z);
	return {
		item,
		x,
		y,
		z,
		vx,
		vy,
		vz,
		mesh,
		spawnedAt: now,
		settled: false,
	};
}

export function markPickedUp(drop: WorldDrop, now: number): void {
	if (drop.pickedUpAt !== undefined) return;
	drop.pickedUpAt = now;
}

export function updateWorldDrop(
	drop: WorldDrop,
	dt: number,
	now: number,
): boolean {
	// Stub until Task 5
	if (drop.pickedUpAt !== undefined && now - drop.pickedUpAt >= DROP_FADE_DURATION) {
		return true;
	}
	return false;
}
```

- [ ] **Step 4: Run tests**

```
pnpm test -- world_drops.test
```
Expected: PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/world_drops.ts nova-games/phoenix-a-game/src/world_drops.test.ts
git commit -m "phoenix-a-game: world_drops module — types, mesh factory, create"
```

---

## Task 5: World-drop physics + fade

**Files:**
- Modify: `nova-games/phoenix-a-game/src/world_drops.ts`
- Test: `nova-games/phoenix-a-game/src/world_drops.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `nova-games/phoenix-a-game/src/world_drops.test.ts`:

```ts
const ITEM: Item = { kind: "sword", quality: 1 };

describe("updateWorldDrop physics", () => {
	it("a stationary drop stays put and does not settle off of zero velocity", () => {
		const d = createWorldDrop(ITEM, 5, 0.7, 5, 0, 0, 0, 0);
		d.settled = true;
		const done = updateWorldDrop(d, 1 / 60, 0);
		expect(done).toBe(false);
		expect(d.x).toBe(5);
		expect(d.z).toBe(5);
	});
	it("an arced drop lands on the floor and settles", () => {
		const d = createWorldDrop(ITEM, 0, 1.2, 0, 6, 2, 0, 0);
		let t = 0;
		for (let i = 0; i < 600; i++) {
			updateWorldDrop(d, 1 / 60, t);
			t += 1 / 60;
			if (d.settled) break;
		}
		expect(d.settled).toBe(true);
		expect(d.y).toBeCloseTo(0.3, 1);
		expect(d.x).toBeGreaterThan(1); // moved forward
	});
	it("syncs mesh position to drop position each tick", () => {
		const d = createWorldDrop(ITEM, 0, 1.2, 0, 0, 5, 0, 0);
		updateWorldDrop(d, 0.1, 0);
		expect(d.mesh.position.y).toBeCloseTo(d.y, 5);
	});
});

describe("updateWorldDrop fade", () => {
	it("returns true only after fade completes", () => {
		const d = createWorldDrop(ITEM, 0, 0.7, 0, 0, 0, 0, 0);
		d.settled = true;
		markPickedUp(d, 10);
		expect(updateWorldDrop(d, 1 / 60, 10.1)).toBe(false);
		expect(updateWorldDrop(d, 1 / 60, 10.7)).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- world_drops.test
```
Expected: FAIL — physics tests don't pass yet (stub returns false but doesn't integrate motion).

- [ ] **Step 3: Implement physics + fade**

Replace the `updateWorldDrop` stub in `nova-games/phoenix-a-game/src/world_drops.ts`
with:

```ts
import { MeshStandardMaterial } from "three";

// ... (keep existing imports / constants / createDropMesh / createWorldDrop / markPickedUp)

export function updateWorldDrop(
	drop: WorldDrop,
	dt: number,
	now: number,
): boolean {
	if (!drop.settled) {
		drop.vy -= 9.8 * dt;
		drop.x += drop.vx * dt;
		drop.y += drop.vy * dt;
		drop.z += drop.vz * dt;
		if (drop.y <= DROP_FLOOR_Y) {
			drop.y = DROP_FLOOR_Y;
			drop.vx = 0;
			drop.vy = 0;
			drop.vz = 0;
			drop.settled = true;
		}
	} else {
		const hoverT = now - drop.spawnedAt;
		drop.y = DROP_FLOOR_Y + Math.sin(hoverT * 2) * 0.05;
		drop.mesh.rotation.y = hoverT * 1.5;
	}
	drop.mesh.position.set(drop.x, drop.y, drop.z);

	if (drop.pickedUpAt !== undefined) {
		const fadeT = now - drop.pickedUpAt;
		const opacity = Math.max(0, 1 - fadeT / DROP_FADE_DURATION);
		drop.mesh.traverse((child) => {
			const m = (child as { material?: unknown }).material;
			if (m instanceof MeshStandardMaterial && m.transparent) {
				m.opacity = opacity;
			}
		});
		drop.mesh.position.y += fadeT * 0.6;
		if (fadeT >= DROP_FADE_DURATION) return true;
	}
	return false;
}
```

Note: the `MeshStandardMaterial` import joins the existing import block at the top of
the file (don't duplicate the import statement — edit the existing one to include it).

- [ ] **Step 4: Run tests**

```
pnpm test -- world_drops.test
```
Expected: all PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/world_drops.ts nova-games/phoenix-a-game/src/world_drops.test.ts
git commit -m "phoenix-a-game: world_drops physics arc, hover, and fade"
```

---

## Task 6: Interact module — findNearestInteractable

**Files:**
- Create: `nova-games/phoenix-a-game/src/interact.ts`
- Test: `nova-games/phoenix-a-game/src/interact.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `nova-games/phoenix-a-game/src/interact.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	findNearestInteractable,
	INTERACT_RANGE,
	type InteractCtx,
} from "./interact";
import type { Door } from "./doors";
import type { RoomSwitch, WinSwitch } from "./switches";
import type { Chest } from "./loot";
import type { WorldDrop } from "./world_drops";
import { createInitialState, type Item } from "./state";
import { Group } from "three";

function makeDoor(x: number, z: number, open = false): Door {
	return {
		roomIndices: [0, 1],
		open,
		aabb: { minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 },
		centerX: x,
		centerZ: z,
		// biome-ignore lint/suspicious/noExplicitAny: stub mesh
		mesh: {} as any,
	};
}

function makeSwitch(x: number, z: number, activated = false): RoomSwitch {
	return {
		roomIndex: 0,
		activated,
		x,
		z,
		// biome-ignore lint/suspicious/noExplicitAny: stub mesh
		mesh: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub material
		buttonMaterial: {} as any,
	};
}

function makeChest(x: number, z: number, opened = false): Chest {
	return {
		x,
		z,
		opened,
		boss: false,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		mesh: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		bodyMaterial: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		lid: {} as any,
	};
}

function makeWinSwitch(
	x: number,
	z: number,
	unlocked = true,
	activated = false,
): WinSwitch {
	return {
		activated,
		unlocked,
		x,
		z,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		mesh: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		plateMaterial: {} as any,
	};
}

const ITEM: Item = { kind: "sword", quality: 1 };

function makeDrop(x: number, z: number, settled = true, pickedUp = false): WorldDrop {
	return {
		item: ITEM,
		x,
		y: 0.3,
		z,
		vx: 0,
		vy: 0,
		vz: 0,
		mesh: new Group(),
		spawnedAt: 0,
		settled,
		pickedUpAt: pickedUp ? 0 : undefined,
	};
}

function makeCtx(overrides: Partial<InteractCtx> = {}): InteractCtx {
	return {
		state: createInitialState(),
		doors: [],
		roomSwitches: [],
		chests: [],
		winSwitch: makeWinSwitch(1000, 1000, false),
		drops: [],
		rng: () => 0,
		// biome-ignore lint/suspicious/noExplicitAny: stub scene
		scene: { add: () => {}, remove: () => {} } as any,
		wakeRooms: () => {},
		descendFloor: () => {},
		throwForward: () => {},
		...overrides,
	};
}

describe("findNearestInteractable", () => {
	it("returns null when nothing is in range", () => {
		const ctx = makeCtx({ doors: [makeDoor(100, 100)] });
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("returns the nearest in-range target across kinds", () => {
		const near = makeDoor(0, 1.5);
		const far = makeChest(0, 2.4);
		const ctx = makeCtx({ doors: [near], chests: [far] });
		const t = findNearestInteractable(0, 0, ctx);
		expect(t?.kind).toBe("door");
	});
	it("excludes opened chests / activated switches / locked winSwitch", () => {
		const ctx = makeCtx({
			chests: [makeChest(0, 1, true)],
			roomSwitches: [makeSwitch(0, 1.2, true)],
			winSwitch: makeWinSwitch(0, 1.4, false), // locked
		});
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("excludes opened doors", () => {
		const ctx = makeCtx({ doors: [makeDoor(0, 1, true)] });
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("excludes unsettled or already-picked drops", () => {
		const ctx = makeCtx({
			drops: [
				makeDrop(0, 1, false, false), // not settled
				makeDrop(0, 1.5, true, true), // already picked
			],
		});
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("includes a settled drop in range", () => {
		const ctx = makeCtx({ drops: [makeDrop(0, 1, true, false)] });
		const t = findNearestInteractable(0, 0, ctx);
		expect(t?.kind).toBe("pickup");
	});
	it(`enforces INTERACT_RANGE (${INTERACT_RANGE})`, () => {
		const ctx = makeCtx({ doors: [makeDoor(0, INTERACT_RANGE + 0.1)] });
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- interact.test
```
Expected: FAIL — "Cannot find module './interact'".

- [ ] **Step 3: Implement findNearestInteractable**

Create `nova-games/phoenix-a-game/src/interact.ts`:

```ts
import type { Scene } from "three";
import type { Door } from "./doors";
import type { Chest } from "./loot";
import type { GameState, Item } from "./state";
import type { RoomSwitch, WinSwitch } from "./switches";
import type { WorldDrop } from "./world_drops";

export const INTERACT_RANGE = 2.5;

export type Interactable =
	| { kind: "door"; door: Door }
	| { kind: "switch"; sw: RoomSwitch }
	| { kind: "chest"; chest: Chest }
	| { kind: "winSwitch"; ws: WinSwitch }
	| { kind: "pickup"; drop: WorldDrop };

export interface InteractCtx {
	state: GameState;
	doors: Door[];
	roomSwitches: RoomSwitch[];
	chests: Chest[];
	winSwitch: WinSwitch;
	drops: WorldDrop[];
	rng: () => number;
	scene: Scene;
	wakeRooms: (roomIndices: readonly number[]) => void;
	descendFloor: () => void;
	throwForward: (item: Item) => void;
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
	const dx = ax - bx;
	const dz = az - bz;
	return dx * dx + dz * dz;
}

export function findNearestInteractable(
	px: number,
	pz: number,
	ctx: InteractCtx,
): Interactable | null {
	const r2 = INTERACT_RANGE * INTERACT_RANGE;
	let best: Interactable | null = null;
	let bestD2 = r2;

	const consider = (d2: number, candidate: Interactable) => {
		if (d2 <= bestD2) {
			best = candidate;
			bestD2 = d2;
		}
	};

	for (const door of ctx.doors) {
		if (door.open) continue;
		consider(dist2(px, pz, door.centerX, door.centerZ), { kind: "door", door });
	}
	for (const sw of ctx.roomSwitches) {
		if (sw.activated) continue;
		consider(dist2(px, pz, sw.x, sw.z), { kind: "switch", sw });
	}
	for (const chest of ctx.chests) {
		if (chest.opened) continue;
		consider(dist2(px, pz, chest.x, chest.z), { kind: "chest", chest });
	}
	if (ctx.winSwitch.unlocked && !ctx.winSwitch.activated) {
		consider(dist2(px, pz, ctx.winSwitch.x, ctx.winSwitch.z), {
			kind: "winSwitch",
			ws: ctx.winSwitch,
		});
	}
	for (const drop of ctx.drops) {
		if (drop.pickedUpAt !== undefined || !drop.settled) continue;
		consider(dist2(px, pz, drop.x, drop.z), { kind: "pickup", drop });
	}
	return best;
}
```

- [ ] **Step 4: Run tests**

```
pnpm test -- interact.test
```
Expected: PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/interact.ts nova-games/phoenix-a-game/src/interact.test.ts
git commit -m "phoenix-a-game: interact.ts — findNearestInteractable"
```

---

## Task 7: Interact module — performInteract + describeInteractable

**Files:**
- Modify: `nova-games/phoenix-a-game/src/interact.ts`
- Test: `nova-games/phoenix-a-game/src/interact.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `nova-games/phoenix-a-game/src/interact.test.ts`:

```ts
import { describeInteractable, performInteract } from "./interact";
import { createWorldDrop, type WorldDrop } from "./world_drops";

describe("performInteract", () => {
	it("opens a door and wakes its rooms", () => {
		const door = makeDoor(0, 1);
		const woke: number[][] = [];
		const ctx = makeCtx({
			doors: [door],
			wakeRooms: (rs) => woke.push([...rs]),
		});
		performInteract({ kind: "door", door }, ctx, 0);
		expect(door.open).toBe(true);
		expect(woke).toEqual([[0, 1]]);
	});
	it("activates a switch", () => {
		const sw = makeSwitch(0, 1);
		// patch material so activateSwitch doesn't crash on setHex
		(sw.buttonMaterial as any) = {
			color: { setHex: () => {} },
			emissive: { setHex: () => {} },
		};
		const ctx = makeCtx({ roomSwitches: [sw] });
		performInteract({ kind: "switch", sw }, ctx, 0);
		expect(sw.activated).toBe(true);
	});
	it("opens a chest, rolls an item, pushes a settled drop", () => {
		const chest = makeChest(5, 5);
		// patch chest mesh/material so the body color shift doesn't crash
		(chest.bodyMaterial as any) = { color: { setHex: () => {} } };
		(chest.lid as any) = {
			rotation: { x: 0 },
			position: { set: () => {} },
		};
		const ctx = makeCtx({
			chests: [chest],
			rng: () => 0.5,
		});
		performInteract({ kind: "chest", chest }, ctx, 0);
		expect(chest.opened).toBe(true);
		expect(ctx.drops).toHaveLength(1);
		expect(ctx.drops[0].settled).toBe(true);
		expect(ctx.drops[0].x).toBe(5);
	});
	it("picks up a drop into the hotbar", () => {
		const drop = makeDrop(0, 1);
		const ctx = makeCtx({ drops: [drop] });
		ctx.state.player.hotbar[0] = { kind: "sword", quality: 1 };
		performInteract({ kind: "pickup", drop }, ctx, 0);
		expect(drop.pickedUpAt).toBe(0);
		expect(ctx.state.player.hotbar[1]).toEqual(drop.item);
	});
	it("on full hotbar, pickup throws the displaced item", () => {
		const drop = makeDrop(0, 1);
		const thrown: Item[] = [];
		const ctx = makeCtx({
			drops: [drop],
			throwForward: (i) => thrown.push(i),
		});
		for (let i = 0; i < 10; i++) {
			ctx.state.player.hotbar[i] = { kind: "sword", quality: 1 };
		}
		ctx.state.player.selectedSlot = 3;
		performInteract({ kind: "pickup", drop }, ctx, 0);
		expect(thrown).toHaveLength(1);
		expect(thrown[0]).toEqual({ kind: "sword", quality: 1 });
		expect(ctx.state.player.hotbar[3]).toEqual(drop.item);
	});
	it("triggers descendFloor on winSwitch", () => {
		const ws = makeWinSwitch(0, 1, true, false);
		(ws.plateMaterial as any) = {
			color: { setHex: () => {} },
			emissive: { setHex: () => {} },
		};
		let descended = false;
		const ctx = makeCtx({
			winSwitch: ws,
			descendFloor: () => {
				descended = true;
			},
		});
		performInteract({ kind: "winSwitch", ws }, ctx, 0);
		expect(ws.activated).toBe(true);
		expect(descended).toBe(true);
	});
});

describe("describeInteractable", () => {
	it("returns descriptive strings", () => {
		expect(describeInteractable({ kind: "door", door: makeDoor(0, 0) })).toMatch(/door/i);
		expect(
			describeInteractable({
				kind: "pickup",
				drop: {
					item: { kind: "sword", quality: 4 },
					x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
					mesh: new Group(),
					spawnedAt: 0, settled: true,
				},
			}),
		).toMatch(/epic.*sword/i);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test -- interact.test
```
Expected: FAIL — "module './interact' has no exported member 'performInteract'".

- [ ] **Step 3: Implement performInteract + describeInteractable**

Add these imports at the **top** of `nova-games/phoenix-a-game/src/interact.ts` (merge
with existing imports — do NOT duplicate the `./state` import line):

```ts
import { addItem } from "./hotbar";
import { openDoor } from "./doors";
import { rollItemDrop } from "./loot";
import { QUALITY_NAMES } from "./state";
import { activateSwitch, activateWinSwitch } from "./switches";
import { createWorldDrop, markPickedUp } from "./world_drops";
```

Then append at the bottom of the file:

```ts
export function performInteract(
	target: Interactable,
	ctx: InteractCtx,
	now: number,
): void {
	switch (target.kind) {
		case "door": {
			openDoor(target.door);
			ctx.wakeRooms(target.door.roomIndices);
			return;
		}
		case "switch": {
			activateSwitch(target.sw);
			return;
		}
		case "chest": {
			const chest = target.chest;
			chest.opened = true;
			chest.bodyMaterial.color.setHex(chest.boss ? 0x665500 : 0x3a2a1a);
			chest.lid.rotation.x = -1.0;
			chest.lid.position.set(0, 0.5, -0.25);
			const item = rollItemDrop(ctx.rng, ctx.state.floor, chest.boss);
			const drop = createWorldDrop(item, chest.x, 0.7, chest.z, 0, 0, 0, now);
			drop.settled = true;
			ctx.drops.push(drop);
			ctx.scene.add(drop.mesh);
			return;
		}
		case "winSwitch": {
			activateWinSwitch(target.ws);
			ctx.descendFloor();
			return;
		}
		case "pickup": {
			const { displaced } = addItem(ctx.state, target.drop.item);
			markPickedUp(target.drop, now);
			if (displaced) ctx.throwForward(displaced);
			return;
		}
	}
}

export function describeInteractable(target: Interactable): string {
	switch (target.kind) {
		case "door":
			return "Open door";
		case "switch":
			return "Activate switch";
		case "chest":
			return target.chest.boss ? "Open boss chest" : "Open chest";
		case "winSwitch":
			return "Descend";
		case "pickup": {
			const item = target.drop.item;
			if (item.kind === "food") return "Pick up food";
			const tier = QUALITY_NAMES[item.quality - 1];
			const kind = item.kind === "sword" ? "Sword" : "Bow";
			return `Pick up ${tier.charAt(0).toUpperCase() + tier.slice(1)} ${kind}`;
		}
	}
}
```

- [ ] **Step 4: Run tests**

```
pnpm test -- interact.test
```
Expected: all interact.test.ts cases PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add nova-games/phoenix-a-game/src/interact.ts nova-games/phoenix-a-game/src/interact.test.ts
git commit -m "phoenix-a-game: interact.ts — performInteract + describeInteractable"
```

---

## Task 8: Input — edge-triggered flags (additive)

**Files:**
- Modify: `nova-games/phoenix-a-game/src/input.ts`

We add `interact`, `cycleLeft`, `cycleRight`, `dropSelected`, `slotDigit` alongside the
existing `weapon` field. `Digit1`/`Digit2` continue to set `weapon` (deleted in Task 14).

- [ ] **Step 1: Replace input.ts**

Replace `nova-games/phoenix-a-game/src/input.ts` entirely:

```ts
import type { Weapon } from "./state";

export interface InputState {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
	shift: boolean;
	click: boolean;
	weapon: Weapon; // legacy — removed in Task 14
	interact: boolean;
	cycleLeft: boolean;
	cycleRight: boolean;
	dropSelected: boolean;
	slotDigit: number | null;
	mouseDX: number;
	mouseDY: number;
}

export function createInput(): InputState {
	return {
		w: false,
		a: false,
		s: false,
		d: false,
		shift: false,
		click: false,
		weapon: "sword",
		interact: false,
		cycleLeft: false,
		cycleRight: false,
		dropSelected: false,
		slotDigit: null,
		mouseDX: 0,
		mouseDY: 0,
	};
}

export function wireInput(input: InputState): void {
	const setKey = (e: KeyboardEvent, down: boolean) => {
		switch (e.code) {
			case "KeyW":
				input.w = down;
				break;
			case "KeyA":
				input.a = down;
				break;
			case "KeyS":
				input.s = down;
				break;
			case "KeyD":
				input.d = down;
				break;
			case "ShiftLeft":
			case "ShiftRight":
				input.shift = down;
				break;
			case "KeyQ":
				if (down) input.cycleLeft = true;
				break;
			case "KeyE":
				if (down) input.cycleRight = true;
				break;
			case "Space":
				if (down) input.interact = true;
				break;
			case "Digit1":
				if (down) {
					input.weapon = "sword";
					input.slotDigit = 0;
				}
				break;
			case "Digit2":
				if (down) {
					input.weapon = "bow";
					input.slotDigit = 1;
				}
				break;
			case "Digit3":
				if (down) input.slotDigit = 2;
				break;
			case "Digit4":
				if (down) input.slotDigit = 3;
				break;
			case "Digit5":
				if (down) input.slotDigit = 4;
				break;
			case "Digit6":
				if (down) input.slotDigit = 5;
				break;
			case "Digit7":
				if (down) input.slotDigit = 6;
				break;
			case "Digit8":
				if (down) input.slotDigit = 7;
				break;
			case "Digit9":
				if (down) input.slotDigit = 8;
				break;
			case "Digit0":
				if (down) input.slotDigit = 9;
				break;
		}
	};
	window.addEventListener("keydown", (e) => setKey(e, true));
	window.addEventListener("keyup", (e) => setKey(e, false));
	window.addEventListener("mousedown", (e) => {
		if (e.button === 0) input.click = true;
		if (e.button === 2) input.dropSelected = true;
	});
	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) input.click = false;
	});
	window.addEventListener("contextmenu", (e) => e.preventDefault());
	window.addEventListener("mousemove", (e) => {
		if (document.pointerLockElement) {
			input.mouseDX += e.movementX;
			input.mouseDY += e.movementY;
		}
	});
}
```

- [ ] **Step 2: Run tests**

```
pnpm test
```
Expected: PASS (no input tests exist; tsc + bind ensures it still compiles).

- [ ] **Step 3: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add nova-games/phoenix-a-game/src/input.ts
git commit -m "phoenix-a-game: add edge-triggered input flags (Q/E/Space/Digits/right-click)"
```

---

## Task 9: HUD containers in index.html

**Files:**
- Modify: `nova-games/phoenix-a-game/index.html`

- [ ] **Step 1: Add hotbar + interact prompt containers**

In `nova-games/phoenix-a-game/index.html`, inside the existing `#hud` div (just before
the closing `</div>` of `#hud-banner`), add:

```html
<div id="hud-hotbar" style="
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 4px; padding: 4px;
    background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.4);
    border-radius: 4px;
"></div>
<div id="hud-interact" style="
    position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
    color: #fff; font-family: sans-serif; font-size: 18px;
    background: rgba(0,0,0,0.55); padding: 4px 10px; border-radius: 4px;
    display: none;
"></div>
```

- [ ] **Step 2: Run tests**

```
pnpm test
```
Expected: PASS (html change, no JS impact yet).

- [ ] **Step 3: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add nova-games/phoenix-a-game/index.html
git commit -m "phoenix-a-game: add hotbar and interact-prompt HUD containers"
```

---

## Task 10: HUD rendering — hotbar + interact prompt

**Files:**
- Modify: `nova-games/phoenix-a-game/src/hud.ts`

`renderHud` gains an optional second arg (the interact prompt string). When the prompt
container exists, it's toggled and updated. The hotbar DOM is built once on first call.

- [ ] **Step 1: Replace hud.ts**

Replace `nova-games/phoenix-a-game/src/hud.ts` with:

```ts
import { LEVELS } from "./levels";
import { type Item, QUALITY_COLORS, QUALITY_NAMES, type GameState } from "./state";

function setHearts(el: HTMLElement, filled: number, empty: number): void {
	while (el.firstChild) el.removeChild(el.firstChild);
	const full = document.createElement("span");
	full.style.color = "#ff3344";
	full.textContent = "♥".repeat(filled);
	const hollow = document.createElement("span");
	hollow.style.color = "#ffffff";
	hollow.textContent = "♡".repeat(empty);
	el.appendChild(full);
	el.appendChild(hollow);
}

const slotElems: HTMLElement[] = [];

function ensureHotbarSlots(container: HTMLElement): void {
	if (slotElems.length) return;
	for (let i = 0; i < 10; i++) {
		const slot = document.createElement("div");
		slot.style.cssText = [
			"width: 40px",
			"height: 40px",
			"background: rgba(20,20,28,0.7)",
			"border: 2px solid rgba(255,255,255,0.2)",
			"border-radius: 3px",
			"position: relative",
			"font-family: sans-serif",
			"color: #fff",
		].join(";");
		const keyHint = document.createElement("span");
		keyHint.style.cssText =
			"position: absolute; top: 1px; left: 3px; font-size: 10px; opacity: 0.8;";
		keyHint.textContent = i === 9 ? "0" : String(i + 1);
		slot.appendChild(keyHint);
		const icon = document.createElement("span");
		icon.style.cssText =
			"position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 22px;";
		slot.appendChild(icon);
		const tier = document.createElement("span");
		tier.style.cssText =
			"position: absolute; bottom: 1px; right: 3px; font-size: 10px; opacity: 0.8;";
		slot.appendChild(tier);
		container.appendChild(slot);
		slotElems.push(slot);
	}
}

function iconFor(item: Item | null): string {
	if (!item) return "";
	if (item.kind === "sword") return "⚔";
	if (item.kind === "bow") return "🏹";
	return "🍎";
}

function tierLetter(item: Item | null): string {
	if (!item || item.kind === "food") return "";
	return QUALITY_NAMES[item.quality - 1].charAt(0).toUpperCase();
}

function colorHex(n: number): string {
	return `#${n.toString(16).padStart(6, "0")}`;
}

function renderHotbar(state: GameState): void {
	const container = document.getElementById("hud-hotbar");
	if (!container) return;
	ensureHotbarSlots(container);
	for (let i = 0; i < 10; i++) {
		const slot = slotElems[i];
		const item = state.player.hotbar[i];
		const selected = i === state.player.selectedSlot;
		const borderColor = item
			? colorHex(QUALITY_COLORS[item.quality - 1])
			: "rgba(255,255,255,0.2)";
		slot.style.borderColor = selected ? "#ffffff" : borderColor;
		slot.style.background = selected
			? "rgba(60,60,80,0.85)"
			: "rgba(20,20,28,0.7)";
		const [, iconEl, tierEl] = slot.childNodes as unknown as HTMLElement[];
		iconEl.textContent = iconFor(item);
		tierEl.textContent = tierLetter(item);
	}
}

function renderPrompt(prompt: string | null): void {
	const el = document.getElementById("hud-interact");
	if (!el) return;
	if (prompt) {
		el.style.display = "block";
		el.textContent = `[Space] ${prompt}`;
	} else {
		el.style.display = "none";
	}
}

export function renderHud(state: GameState, prompt: string | null = null): void {
	const p = state.player;
	const filled = Math.max(0, Math.min(p.maxHealth, Math.ceil(p.health)));
	const empty = p.maxHealth - filled;
	const healthEl = document.getElementById("hud-health");
	if (healthEl) setHearts(healthEl, filled, empty);
	const floorEl = document.getElementById("hud-floor");
	if (floorEl) {
		const floorIdx = Math.min(state.floor, LEVELS.length - 1);
		const level = LEVELS[floorIdx];
		floorEl.textContent = `Floor ${state.floor + 1} / ${LEVELS.length} — ${level.name}`;
	}
	const stamFillEl = document.getElementById("hud-stamina-fill");
	if (stamFillEl) {
		const pct = Math.max(0, Math.min(1, p.stamina / p.maxStamina)) * 100;
		stamFillEl.style.width = `${pct}%`;
	}
	const hud = document.getElementById("hud");
	if (hud) {
		const flashing = state.now < p.hitFlashUntil;
		hud.classList.toggle("hud-flash", flashing);
	}
	const banner = document.getElementById("hud-banner");
	if (banner) {
		if (state.phase === "dead") {
			banner.style.display = "flex";
			banner.textContent = "You Died — click to respawn";
		} else if (state.phase === "won") {
			banner.style.display = "flex";
			banner.textContent = "You Win! — click to restart";
		} else {
			banner.style.display = "none";
		}
	}
	renderHotbar(state);
	renderPrompt(prompt);
}
```

- [ ] **Step 2: Run tests**

```
pnpm test
```
Expected: PASS (no hud test file; tsc enforces type safety).

- [ ] **Step 3: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add nova-games/phoenix-a-game/src/hud.ts
git commit -m "phoenix-a-game: render hotbar slots + spacebar interact prompt"
```

---

## Task 11: main.ts — equip weapon from hotbar slot

**Files:**
- Modify: `nova-games/phoenix-a-game/src/main.ts`

Switch `sword.visible` / `bow.visible` / mesh tint / damage to come from
`equippedItem(state)`. Keep `state.player.weapon` / `swordDamage` / `bowDamage` writes
in place for compatibility (deleted in Task 14).

- [ ] **Step 1: Update imports**

In `nova-games/phoenix-a-game/src/main.ts`, **add** to the existing
`./state` import:
```ts
import {
	canAttack,
	consumeAttackStamina,
	createInitialState,
	equippedItem,
	QUALITY_COLORS,
} from "./state";
```

Keep the existing imports for `weaponColorFor`, etc. — Task 14 removes them.

- [ ] **Step 2: Replace the in-loop weapon visibility / tint block**

In `animate()` in `main.ts`, find the lines:

```ts
state.player.weapon = input.weapon;
const swordVisible = state.player.weapon === "sword";
sword.visible = swordVisible;
bow.visible = !swordVisible;
playerMesh.swordBladeMaterial.color.setHex(
	weaponColorFor(state.player.swordDamage),
);
playerMesh.bowAccentMaterial.color.setHex(
	weaponColorFor(state.player.bowDamage),
);
```

Replace with:

```ts
const equipped = equippedItem(state);
const showSword = equipped?.kind === "sword";
const showBow = equipped?.kind === "bow";
sword.visible = showSword;
bow.visible = showBow;
if (showSword && equipped) {
	const tint = QUALITY_COLORS[equipped.quality - 1];
	playerMesh.swordBladeMaterial.color.setHex(tint);
	state.player.swordDamage = equipped.quality;
}
if (showBow && equipped) {
	const tint = QUALITY_COLORS[equipped.quality - 1];
	playerMesh.bowAccentMaterial.color.setHex(tint);
	state.player.bowDamage = equipped.quality;
}
// Keep legacy weapon field in sync — removed in cleanup task
state.player.weapon = showBow ? "bow" : "sword";
```

- [ ] **Step 3: Gate left-click attack on equipped weapon**

Find the block that starts `if (input.click && !prevClick) {`. Replace its inner
`if (state.phase === "playing")` block with:

```ts
if (state.phase === "playing") {
	if (canAttack(state) && equipped) {
		if (equipped.kind === "sword") {
			startSwing(swing, state.now);
			consumeAttackStamina(state);
		} else if (equipped.kind === "bow") {
			fireArrow();
			consumeAttackStamina(state);
		}
		// food handled in Task 13
	}
} else if (state.phase === "dead") {
	respawnPlayer();
} else if (state.phase === "won") {
	window.location.reload();
}
```

(The outer click-edge / pointer-lock-restart logic stays the same.)

- [ ] **Step 4: Run tests**

```
pnpm test
```
Expected: PASS.

- [ ] **Step 5: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 6: Smoke test in browser**

```
pnpm dev
```
Open `http://localhost:4100` (or whatever port Vite reports), click to start.

Verify: you spawn with a common-gray sword, you can swing it, you can pick up swords/
bows by swinging at chest drops (legacy path) and they upgrade your damage AND the
equipped slot's quality (because `state.player.swordDamage` is being overwritten by
`equipped.quality` each frame — this is an interim state, fixed in Task 12).

Don't worry that the legacy pickup behavior is still weird here — Task 12 replaces it.

- [ ] **Step 7: Commit**

```
git add nova-games/phoenix-a-game/src/main.ts
git commit -m "phoenix-a-game: equip from hotbar slot — visibility, tint, damage"
```

---

## Task 12: main.ts — spacebar interact + drops list (replaces sword/arrow object handling)

**Files:**
- Modify: `nova-games/phoenix-a-game/src/main.ts`

This is the substantive flip. After this task:
- `handleSwingTargets` is gone — swords only damage monsters.
- `handleArrowHit` retains the monster + wall branches; door / switch / chest / win /
  pickup branches gone.
- Spacebar opens doors / switches / chests / win-switch and picks up world drops.
- A `drops: WorldDrop[]` list replaces the per-chest `dropMesh` tracking. Chests
  still have legacy `drop`/`dropMesh` fields on the type (those are removed in
  Task 14 via `loot.ts` cleanup), but nothing reads them anymore.

- [ ] **Step 1: Update imports**

In `nova-games/phoenix-a-game/src/main.ts`, replace these blocks:

```ts
import {
	type Chest,
	createChest,
	openChest,
	pickupDrop,
	updateChestDrop,
} from "./loot";
```

with:

```ts
import { type Chest, createChest } from "./loot";
```

Add:

```ts
import {
	describeInteractable,
	findNearestInteractable,
	type InteractCtx,
	type Interactable,
	performInteract,
} from "./interact";
import {
	createWorldDrop,
	updateWorldDrop,
	type WorldDrop,
} from "./world_drops";
```

- [ ] **Step 2: Add drops state**

Below the existing `let chests: Chest[] = [];` declaration, add:

```ts
let drops: WorldDrop[] = [];
```

In `teardownDungeon`, after `for (const a of arrows) disposeObject(a.mesh);`, add:

```ts
for (const d of drops) disposeObject(d.mesh);
```

And in the reset block, add:

```ts
drops = [];
```

- [ ] **Step 3: Add throwForward helper + InteractCtx builder**

Above `function animate()` add:

```ts
function throwForward(item: Item): void {
	const facingX = -Math.sin(follow.yaw);
	const facingZ = -Math.cos(follow.yaw);
	const drop = createWorldDrop(
		item,
		player.position.x + facingX * 0.6,
		1.2,
		player.position.z + facingZ * 0.6,
		facingX * 6,
		2,
		facingZ * 6,
		state.now,
	);
	drops.push(drop);
	scene.add(drop.mesh);
}

function buildInteractCtx(): InteractCtx {
	return {
		state,
		doors,
		roomSwitches,
		chests,
		winSwitch,
		drops,
		rng: Math.random,
		scene,
		wakeRooms,
		descendFloor,
		throwForward,
	};
}
```

Also add `Item` to the `./state` import:

```ts
import {
	canAttack,
	consumeAttackStamina,
	createInitialState,
	equippedItem,
	type Item,
	QUALITY_COLORS,
} from "./state";
```

- [ ] **Step 4: Delete handleSwingTargets**

Delete the entire `handleSwingTargets` function definition (it's the block that
iterates over doors / roomSwitches / chests / chests-with-drops / winSwitch).

- [ ] **Step 5: Trim handleArrowHit to monsters + walls only**

Replace the body of `handleArrowHit` with:

```ts
function handleArrowHit(a: Arrow) {
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
	if (arrowHitsAabb(a, activeWalls())) {
		a.alive = false;
	}
}
```

- [ ] **Step 6: Replace the per-chest drop update with a generic drop list update**

In `animate()`, find:

```ts
for (const chest of chests) {
	const done = updateChestDrop(chest, state.now);
	if (done && chest.dropMesh) {
		disposeObject(chest.dropMesh);
		chest.dropMesh = undefined;
	}
}
```

Replace with:

```ts
const survivors: WorldDrop[] = [];
for (const d of drops) {
	const done = updateWorldDrop(d, dt, state.now);
	if (done) {
		disposeObject(d.mesh);
	} else {
		survivors.push(d);
	}
}
drops = survivors;
```

- [ ] **Step 7: Replace the swing-targets call with spacebar interact**

In `animate()`, find the block:

```ts
if (state.player.weapon === "sword") {
	handleSwingTargets(
		facingX,
		facingZ,
		player.position.x,
		player.position.z,
	);
}
```

Replace with:

```ts
const ctx = buildInteractCtx();
const nearest = findNearestInteractable(
	player.position.x,
	player.position.z,
	ctx,
);
if (input.interact && nearest) {
	performInteract(nearest, ctx, state.now);
}
```

Hoist `nearest` so the HUD prompt can read it:

- Declare `let nearest: Interactable | null = null;` at the **top of `animate()`**
  (function-scoped, not inside any `state.phase` guard).
- Inside the **second** `if (state.phase === "playing")` block (the one that handles
  the swing-targets call today), assign and use it:

```ts
const ctx = buildInteractCtx();
nearest = findNearestInteractable(player.position.x, player.position.z, ctx);
if (input.interact && nearest) {
	performInteract(nearest, ctx, state.now);
}
input.interact = false;
```

- Then change the `renderHud(state)` call at the very end of `animate()` to:

```ts
renderHud(state, nearest ? describeInteractable(nearest) : null);
```

When `state.phase !== "playing"`, `nearest` stays `null` (default) so the prompt
stays hidden.

- [ ] **Step 8: Reset edge flags each frame**

Remove the `input.interact = false;` line from inside the `state.phase === "playing"`
block (Step 7) — we'll clear all edge flags in one place at the bottom of `animate()`.

At the end of `animate()`, after `renderer.render(scene, camera);`, add:

```ts
input.interact = false;
input.cycleLeft = false;
input.cycleRight = false;
input.dropSelected = false;
input.slotDigit = null;
```

- [ ] **Step 9: Run tests**

```
pnpm test
```
Expected: PASS.

- [ ] **Step 10: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 11: Smoke test in browser**

```
pnpm dev
```
Verify:
- Spacebar near a door opens it; near a switch activates it; near a chest opens it
  (drop appears floating); near a floating drop picks it up (added to hotbar slot 1).
- Sword swings no longer pop doors / chests / switches.
- Arrows no longer pop doors / chests / switches (they still kill monsters).
- After all switches are activated and the boss dies, walking near the win-switch +
  spacebar descends the floor.

- [ ] **Step 12: Commit**

```
git add nova-games/phoenix-a-game/src/main.ts
git commit -m "phoenix-a-game: spacebar interact replaces sword/arrow object handling"
```

---

## Task 13: main.ts — Q/E cycle, digit select, right-click throw, food eat

**Files:**
- Modify: `nova-games/phoenix-a-game/src/main.ts`

- [ ] **Step 1: Add imports**

In `nova-games/phoenix-a-game/src/main.ts`, add:

```ts
import { cycle, removeSlot, selectSlot } from "./hotbar";
```

- [ ] **Step 2: Handle Q/E and digit slot selection**

In `animate()`, inside the `state.phase === "playing"` branch (a clean place is right
after `tickPlayer(state, dt);`), add:

```ts
if (input.cycleLeft) cycle(state, -1);
if (input.cycleRight) cycle(state, 1);
if (input.slotDigit !== null) selectSlot(state, input.slotDigit);
```

- [ ] **Step 3: Handle right-click throw-forward**

Right after the cycle/select block, add:

```ts
if (input.dropSelected) {
	const item = removeSlot(state, state.player.selectedSlot);
	if (item) throwForward(item);
}
```

- [ ] **Step 4: Handle food-eat on left-click**

In the left-click handler block from Task 11 (the inner `if (canAttack(state) &&
equipped)` branch), add a food case:

```ts
if (canAttack(state) && equipped) {
	if (equipped.kind === "sword") {
		startSwing(swing, state.now);
		consumeAttackStamina(state);
	} else if (equipped.kind === "bow") {
		fireArrow();
		consumeAttackStamina(state);
	} else if (equipped.kind === "food") {
		state.player.health = Math.min(
			state.player.maxHealth,
			state.player.health + 1,
		);
		removeSlot(state, state.player.selectedSlot);
	}
}
```

(Food does NOT consume stamina; that's intentional.)

- [ ] **Step 5: Run tests**

```
pnpm test
```
Expected: PASS.

- [ ] **Step 6: Repo-root checks**

```
pnpm run test
```
Expected: PASS.

- [ ] **Step 7: Smoke test**

```
pnpm dev
```
Verify:
- Q / E cycle the highlighted slot left/right with wrap.
- Number keys 1-9 jump directly to slots 1-9; 0 jumps to slot 10.
- Right-click on the selected slot throws the item forward; arcs and lands; spacebar
  near it picks it back up.
- Picking up food (kind = "food") then left-clicking with food selected heals 1 and
  empties the slot.
- Full hotbar: pick up new item → selected slot's old item is thrown forward (handled
  by `interact.performInteract`'s `throwForward` callback).

- [ ] **Step 8: Commit**

```
git add nova-games/phoenix-a-game/src/main.ts
git commit -m "phoenix-a-game: Q/E cycle, digit select, right-click throw, food eat"
```

---

## Task 14: Cleanup — delete legacy fields, types, and code paths

**Files:**
- Modify: `nova-games/phoenix-a-game/src/state.ts`
- Modify: `nova-games/phoenix-a-game/src/input.ts`
- Modify: `nova-games/phoenix-a-game/src/loot.ts`
- Modify: `nova-games/phoenix-a-game/src/loot.test.ts`
- Modify: `nova-games/phoenix-a-game/src/player.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`
- Modify: `nova-games/phoenix-a-game/src/state.test.ts`

- [ ] **Step 1: Remove legacy `state.ts` fields and `Weapon` type**

In `nova-games/phoenix-a-game/src/state.ts`:

- Delete `export type Weapon = "sword" | "bow";`
- Remove `swordDamage: number;`, `bowDamage: number;`, and `weapon: Weapon;` from
  `PlayerState`.
- Remove their initializations from `createInitialState` (the lines `swordDamage: 1`,
  `bowDamage: 1`, `weapon: "sword"`).

- [ ] **Step 2: Update `state.test.ts`**

In `nova-games/phoenix-a-game/src/state.test.ts`, remove any assertion that touches
`swordDamage` / `bowDamage` / `weapon`. (If there are none — fine.) Add:

```ts
it("does not expose legacy damage fields", () => {
	const s = createInitialState();
	expect("swordDamage" in s.player).toBe(false);
	expect("bowDamage" in s.player).toBe(false);
	expect("weapon" in s.player).toBe(false);
});
```

- [ ] **Step 3: Clean `input.ts`**

In `nova-games/phoenix-a-game/src/input.ts`:

- Delete the `import type { Weapon } from "./state";` line.
- Remove the `weapon: Weapon;` field from `InputState`.
- Remove `weapon: "sword"` from `createInput()`.
- In the `Digit1` and `Digit2` cases, remove the `input.weapon = "sword"` /
  `input.weapon = "bow"` lines (keep just `input.slotDigit = 0` / `input.slotDigit = 1`).

- [ ] **Step 4: Clean `loot.ts`**

In `nova-games/phoenix-a-game/src/loot.ts`:

- Delete `export type DropKind = ...;`.
- Delete the original `rollDrop` function.
- Delete `createDropMesh` (it's now in `world_drops.ts`).
- Delete `openChest`.
- Delete `pickupDrop`.
- Delete `updateChestDrop`.
- Remove the legacy fields from `Chest`: `drop?: DropKind;`, `dropMesh?: Group;`,
  `openedAt?: number;`, `dropPickedUp: boolean;`, `pickedUpAt?: number;`. The retained
  fields: `x`, `z`, `opened`, `boss`, `mesh`, `bodyMaterial`, `lid`.
- Update `createChest` to return only the retained fields (`dropPickedUp: false` line is
  removed). The chest still needs its lid Group reference (read by
  `performInteract`).
- Remove the now-unused imports (`ConeGeometry`, `SphereGeometry`, `TorusGeometry`,
  `CylinderGeometry` if no longer used; verify with tsc). The file should end up
  importing only what `createChest` actually uses.
- Keep `rollItemDrop` from Task 3.

- [ ] **Step 5: Clean `loot.test.ts`**

In `nova-games/phoenix-a-game/src/loot.test.ts`:

- Delete the three `describe("rollDrop", ...)` blocks (the legacy 40/30/30 cases).
- Remove `rollDrop` from the imports (keep `rollItemDrop`).
- Keep the `rollItemDrop` describes added in Task 3.

- [ ] **Step 6: Clean `player.ts`**

In `nova-games/phoenix-a-game/src/player.ts`:

- Delete the `WEAPON_COLORS` constant.
- Delete the `weaponColorFor` function.

- [ ] **Step 7: Clean `main.ts`**

In `nova-games/phoenix-a-game/src/main.ts`:

- Remove `weaponColorFor` from the `./player` import.
- Remove the lines that wrote to `state.player.swordDamage`, `state.player.bowDamage`,
  and `state.player.weapon` (the "Keep legacy weapon field in sync" comment + assignment
  added in Task 11). The mesh tint must now read directly from
  `QUALITY_COLORS[equipped.quality - 1]` (it already does).
- Replace the swing-damage call:
  ```ts
  updateSwing(
  	swing,
  	state.now,
  	state.player.swordDamage,
  	facingX,
  	facingZ,
  	...
  );
  ```
  with:
  ```ts
  const swingDamage = equipped?.kind === "sword" ? equipped.quality : 1;
  updateSwing(
  	swing,
  	state.now,
  	swingDamage,
  	facingX,
  	facingZ,
  	...
  );
  ```
- Replace the `fireArrow` body's `state.player.bowDamage` reference (and its
  `weaponColorFor(state.player.bowDamage)` color call):
  ```ts
  const arrow = createArrow(
  	..., dir.z,
  	state.player.bowDamage,
  	weaponColorFor(state.player.bowDamage),
  	state.now,
  );
  ```
  with:
  ```ts
  const equippedNow = equippedItem(state);
  const dmg = equippedNow?.kind === "bow" ? equippedNow.quality : 1;
  const color = QUALITY_COLORS[(equippedNow?.quality ?? 1) - 1];
  const arrow = createArrow(
  	..., dir.z,
  	dmg,
  	color,
  	state.now,
  );
  ```
- In `resetPlayerStats()` remove:
  ```ts
  state.player.swordDamage = 1;
  state.player.bowDamage = 1;
  state.player.weapon = "sword";
  input.weapon = "sword";
  ```
  Replace with:
  ```ts
  for (let i = 0; i < state.player.hotbar.length; i++) {
  	state.player.hotbar[i] = null;
  }
  state.player.hotbar[0] = { kind: "sword", quality: 1 };
  state.player.selectedSlot = 0;
  ```
- In the boss-dead block (`if (boss && !bossDead && boss.hp <= 0) {`), the
  `createChest(boss.x, boss.z, true)` call still works (signature unchanged). Verify no
  other reference to deleted chest fields remains.

- [ ] **Step 8: Run tests**

```
pnpm test
```
Expected: PASS (some old tests removed; new ones intact).

- [ ] **Step 9: Repo-root checks**

```
pnpm run test
```
Expected: PASS. tsc will catch any straggler reference to the deleted symbols — fix
inline before commit.

- [ ] **Step 10: Smoke test — full feature checklist**

```
pnpm dev
```

Run through every step explicitly:

1. Fresh game → hotbar has one common-gray sword in slot 1; all others empty.
2. Q / E cycle slots with wrap; selected slot has a white border.
3. Number keys 1–9 select slots 1–9 directly; 0 selects slot 10.
4. Right-click throws the selected slot forward; item arcs, lands, and sits hovering.
5. Walk close to the dropped item → HUD shows `[Space] Pick up <tier> <kind>` →
   spacebar adds it back to the hotbar.
6. Walk close to a door → `[Space] Open door` → spacebar opens it and wakes the rooms.
7. Walk close to a switch → `[Space] Activate switch` → spacebar activates it.
8. Walk close to a chest → `[Space] Open chest` → spacebar opens it; a tier-colored
   weapon floats above; walk into it and spacebar picks it up.
9. Sword swings damage monsters but no longer open doors, chests, switches, or pick up
   drops.
10. Arrows damage monsters and stick into walls but no longer open doors, chests,
    switches, or pick up drops.
11. Fill the hotbar with 10 items; open another chest; pick up the new drop → selected
    slot's old item is thrown forward, new item takes its place.
12. With food in the selected slot at full health, left-click does nothing harmful;
    drop to 2 hearts → left-click eats the food, heals to 3, slot empties.
13. Beat the boss → boss chest spawns → open it with spacebar → drop is tier-shifted
    upward (more likely to be rare+).
14. Walk close to the unlocked win-switch → `[Space] Descend` → next floor loads.
15. Take damage to 0 → "You Died" → click to respawn at floor 1 with a common sword.

- [ ] **Step 11: Commit**

```
git add nova-games/phoenix-a-game/src/state.ts nova-games/phoenix-a-game/src/state.test.ts nova-games/phoenix-a-game/src/input.ts nova-games/phoenix-a-game/src/loot.ts nova-games/phoenix-a-game/src/loot.test.ts nova-games/phoenix-a-game/src/player.ts nova-games/phoenix-a-game/src/main.ts
git commit -m "phoenix-a-game: remove legacy swordDamage/bowDamage/weapon path"
```

---

## Wrap-up

After Task 14, the feature is complete. Open a PR with:

- Title: `phoenix-a-game: random weapon tiers + hotbar`
- Body: link to the design doc, list the 14 commits, paste the smoke-test checklist
  from Task 14 Step 10.
