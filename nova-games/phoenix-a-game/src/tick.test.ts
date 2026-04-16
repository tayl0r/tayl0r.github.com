import { describe, expect, it } from "vitest";
import { createInitialState } from "./state";
import { tickPlayer } from "./tick";

describe("tickPlayer", () => {
	it("drains half a hunger per 60s of walking", () => {
		const s = createInitialState();
		tickPlayer(s, 60, true, false);
		expect(s.player.hunger).toBeCloseTo(9.5, 5);
	});
	it("drains one hunger per 30s of sprinting", () => {
		const s = createInitialState();
		tickPlayer(s, 30, true, true);
		expect(s.player.hunger).toBeCloseTo(9, 5);
	});
	it("drains stamina while sprinting and regenerates otherwise", () => {
		const s = createInitialState();
		tickPlayer(s, 2, true, true);
		expect(s.player.stamina).toBeLessThan(20);
		tickPlayer(s, 5, false, false);
		expect(s.player.stamina).toBe(20);
	});
	it("ticks health down when hunger reaches 0", () => {
		const s = createInitialState();
		s.player.hunger = 0;
		tickPlayer(s, 10, true, false);
		expect(s.player.health).toBeCloseTo(2, 5);
	});
	it("does not tick the player when phase is not 'playing'", () => {
		const s = createInitialState();
		s.phase = "dead";
		tickPlayer(s, 60, true, true);
		expect(s.player.hunger).toBe(10);
		expect(s.player.stamina).toBe(20);
		expect(s.player.health).toBe(3);
		expect(s.now).toBe(60);
	});
});
