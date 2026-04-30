import type { Monster } from "./monsters";

export const SWING_DURATION = 0.3;
export const HITBOX_REACH = 2.5;
export const HITBOX_HALF_WIDTH = 1.8;

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

function inHitboxArea(
	facingX: number,
	facingZ: number,
	playerX: number,
	playerZ: number,
	targetX: number,
	targetZ: number,
): boolean {
	const rx = targetX - playerX;
	const rz = targetZ - playerZ;
	const forward = rx * facingX + rz * facingZ;
	if (forward < 0 || forward > HITBOX_REACH) return false;
	const side = rx * -facingZ + rz * facingX;
	return Math.abs(side) <= HITBOX_HALF_WIDTH;
}

export function checkSwingHit(
	swing: SwingState,
	now: number,
	facingX: number,
	facingZ: number,
	playerX: number,
	playerZ: number,
	targetX: number,
	targetZ: number,
): boolean {
	if (!swing.active) return false;
	const elapsed = now - swing.startedAt;
	if (elapsed < SWING_DURATION * 0.25 || elapsed > SWING_DURATION * 0.75)
		return false;
	return inHitboxArea(facingX, facingZ, playerX, playerZ, targetX, targetZ);
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
		if (!inHitboxArea(facingX, facingZ, playerX, playerZ, m.x, m.z)) continue;
		m.hp -= damage;
		m.flashUntil = now + 0.15;
		swing.hitThisSwing.add(m);
	}
}
