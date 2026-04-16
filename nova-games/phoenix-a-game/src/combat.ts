import type { Monster } from "./monsters";

export const SWING_DURATION = 0.3;
const HITBOX_REACH = 1.5;
const HITBOX_HALF_WIDTH = 1.0;

export interface SwingState {
	active: boolean;
	startedAt: number;
	hitThisSwing: Set<Monster>;
}

export function createSwing(): SwingState {
	return { active: false, startedAt: 0, hitThisSwing: new Set() };
}

export function startSwing(swing: SwingState, now: number): void {
	if (swing.active) return;
	swing.active = true;
	swing.startedAt = now;
	swing.hitThisSwing.clear();
}

export function updateSwing(
	swing: SwingState,
	now: number,
	damage: number,
	facingX: number,
	facingZ: number,
	playerX: number,
	playerZ: number,
	monsters: Monster[],
): void {
	if (!swing.active) return;
	const elapsed = now - swing.startedAt;
	if (elapsed >= SWING_DURATION) {
		swing.active = false;
		return;
	}
	if (elapsed < SWING_DURATION * 0.25 || elapsed > SWING_DURATION * 0.75)
		return;
	for (const m of monsters) {
		if (m.hp <= 0 || swing.hitThisSwing.has(m)) continue;
		const rx = m.x - playerX;
		const rz = m.z - playerZ;
		const forward = rx * facingX + rz * facingZ;
		if (forward < 0 || forward > HITBOX_REACH) continue;
		const side = rx * -facingZ + rz * facingX;
		if (Math.abs(side) > HITBOX_HALF_WIDTH) continue;
		m.hp -= damage;
		m.flashUntil = now + 0.15;
		swing.hitThisSwing.add(m);
	}
}
