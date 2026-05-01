import { expect, test } from "vitest";
import { advanceLights, type LightsState } from "./lights";

test("starts at COUNTDOWN_3", () => {
	const s: LightsState = { phase: "COUNTDOWN_3", t: 0 };
	expect(s.phase).toBe("COUNTDOWN_3");
});

test("advances through 3 → 2 → 1 → GO at 1s each", () => {
	let s: LightsState = { phase: "COUNTDOWN_3", t: 0 };
	s = advanceLights(s, 1.01);
	expect(s.phase).toBe("COUNTDOWN_2");
	s = advanceLights(s, 1.01);
	expect(s.phase).toBe("COUNTDOWN_1");
	s = advanceLights(s, 1.01);
	expect(s.phase).toBe("GO");
});

test("GO → HIDDEN after 1.5s", () => {
	let s: LightsState = { phase: "GO", t: 0 };
	s = advanceLights(s, 1.51);
	expect(s.phase).toBe("HIDDEN");
});

test("HIDDEN stays HIDDEN", () => {
	const s = advanceLights({ phase: "HIDDEN", t: 0 }, 5);
	expect(s.phase).toBe("HIDDEN");
});
