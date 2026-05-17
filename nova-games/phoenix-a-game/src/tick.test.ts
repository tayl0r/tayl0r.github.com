import { describe, expect, it } from "vitest";
import type { Monster } from "./monsters";
import { consumeAttackStamina, createInitialState, type Item } from "./state";
import { applyContactDamage, tickPlayer } from "./tick";

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

describe("tickPlayer", () => {
	it("regenerates stamina at 1 per second when not attacking", () => {
		const s = createInitialState();
		s.player.stamina = 50;
		tickPlayer(s, 5);
		expect(s.player.stamina).toBeCloseTo(55, 5);
	});
	it("clamps stamina at maxStamina", () => {
		const s = createInitialState();
		s.player.stamina = 99;
		tickPlayer(s, 10);
		expect(s.player.stamina).toBe(100);
	});
	it("pauses regen for 1 second after an attack", () => {
		const s = createInitialState();
		s.player.stamina = 50;
		consumeAttackStamina(s);
		tickPlayer(s, 0.5);
		expect(s.player.stamina).toBe(49);
	});
	it("resumes regen after the 1-second pause has elapsed", () => {
		const s = createInitialState();
		s.player.stamina = 50;
		s.now = 0;
		consumeAttackStamina(s);
		s.now = 1.5;
		tickPlayer(s, 1);
		expect(s.player.stamina).toBeCloseTo(50, 5);
	});
	it("does not tick the player when phase is not 'playing'", () => {
		const s = createInitialState();
		s.player.stamina = 50;
		s.phase = "dead";
		tickPlayer(s, 60);
		expect(s.player.stamina).toBe(50);
		expect(s.player.health).toBe(3);
		expect(s.now).toBe(60);
	});
});

describe("applyContactDamage sword bonus", () => {
	it("adds sword quality to monster base damage", () => {
		const s = createInitialState();
		s.player.iframesUntil = -1;
		s.player.health = 10;
		const m = makeMonster(1, { kind: "sword", quality: 3 });
		applyContactDamage(s, [m], 0, 0, 0.5);
		expect(s.player.health).toBeCloseTo(10 - (1 + 3), 5);
	});
	it("does not add any bonus for a bow wielder", () => {
		const s = createInitialState();
		s.player.iframesUntil = -1;
		const m = makeMonster(1.5, { kind: "bow", quality: 5 });
		applyContactDamage(s, [m], 0, 0, 0.5);
		expect(s.player.health).toBeCloseTo(3 - 1.5, 5);
	});
});
