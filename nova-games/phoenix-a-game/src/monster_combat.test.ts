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
