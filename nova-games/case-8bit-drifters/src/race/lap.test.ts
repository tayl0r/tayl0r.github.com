import { expect, test } from "vitest";
import { LapTracker } from "./lap";

test("requires halfway flag before counting a lap", () => {
	const lt = new LapTracker({ ax: 0, ay: 0, tx: 1, ty: 0 });
	let crossed = false;
	for (let i = 0; i < 10; i++) {
		const r1 = lt.update({ x: -1 + i * 0.2, y: 0 }, 5);
		if (r1) crossed = true;
	}
	expect(crossed).toBe(false);
});

test("counts a lap after halfway then forward crossing", () => {
	const lt = new LapTracker({ ax: 0, ay: 0, tx: 1, ty: 0 });
	lt.update({ x: -2, y: 0 }, 0);
	lt.update({ x: -1, y: 0 }, 100); // halfway reached
	const r = lt.update({ x: 1, y: 0 }, 0); // crossed forward
	expect(r).toBe(true);
});

test("does not count reverse crossing", () => {
	const lt = new LapTracker({ ax: 0, ay: 0, tx: 1, ty: 0 });
	lt.update({ x: 2, y: 0 }, 0);
	lt.update({ x: 1, y: 0 }, 100);
	const r = lt.update({ x: -1, y: 0 }, 100);
	expect(r).toBe(false);
});
