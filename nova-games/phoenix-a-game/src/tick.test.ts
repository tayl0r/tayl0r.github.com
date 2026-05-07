import { describe, expect, it } from "vitest";
import { consumeAttackStamina, createInitialState } from "./state";
import { tickPlayer } from "./tick";

describe("tickPlayer", () => {
	it("regenerates stamina at 2 per second when not attacking", () => {
		const s = createInitialState();
		s.player.stamina = 50;
		tickPlayer(s, 5);
		expect(s.player.stamina).toBeCloseTo(60, 5);
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
		expect(s.player.stamina).toBeCloseTo(51, 5);
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
