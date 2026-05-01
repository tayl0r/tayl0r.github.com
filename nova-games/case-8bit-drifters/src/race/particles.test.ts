import { expect, test } from "vitest";
import { createParticles } from "./particles";

test("spawn fills pool, update advances age, dead particles invisible", () => {
	const pool = createParticles(8);
	pool.spawn({ x: 0, y: 0, vx: 0, vy: 0, ttl: 1 });
	pool.update(0.5);
	expect(pool.aliveCount()).toBe(1);
	pool.update(0.6); // total 1.1 > ttl
	expect(pool.aliveCount()).toBe(0);
});

test("ring buffer wraps when overspawned", () => {
	const pool = createParticles(4);
	for (let i = 0; i < 10; i++) pool.spawn({ x: i, y: 0, vx: 0, vy: 0, ttl: 5 });
	expect(pool.aliveCount()).toBe(4);
});
