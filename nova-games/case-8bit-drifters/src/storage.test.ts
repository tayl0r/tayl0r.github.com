import { afterEach, beforeEach, expect, test } from "vitest";
import { loadState, type StoredState, saveState } from "./storage";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("loadState returns defaults when nothing stored", () => {
	const s = loadState();
	expect(s.profile).toBeNull();
	expect(s.bests).toEqual({});
});

test("saveState then loadState round-trips", () => {
	const s: StoredState = { profile: { name: "case" }, bests: { tokyo: 61234 } };
	saveState(s);
	expect(loadState()).toEqual(s);
});

test("loadState returns defaults when JSON is corrupt", () => {
	localStorage.setItem("case-8bit-drifters", "{not json");
	const s = loadState();
	expect(s.profile).toBeNull();
	expect(s.bests).toEqual({});
});
