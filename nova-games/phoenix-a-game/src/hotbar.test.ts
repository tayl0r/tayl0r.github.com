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
