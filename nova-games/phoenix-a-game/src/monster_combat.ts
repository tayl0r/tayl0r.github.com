import type { Monster } from "./monsters";

export const BOW_FIRE_INTERVAL = 1.5;
export const BOW_PREFERRED_RANGE = 7;
export const BOW_BACKAWAY_THRESHOLD = 4;
export const BOW_MAX_FIRE_RANGE = 12;

const BOW_CHASE_TAKEOVER_RANGE = BOW_MAX_FIRE_RANGE * 1.5;

export type FireMonsterArrow = (m: Monster, dirX: number, dirZ: number) => void;

export function updateBowMonster(
	m: Monster,
	playerX: number,
	playerZ: number,
	dt: number,
	now: number,
	fire: FireMonsterArrow,
): void {
	if (m.dormant) return;
	const dx = playerX - m.x;
	const dz = playerZ - m.z;
	const distance = Math.hypot(dx, dz);
	if (distance < 0.0001) return;

	const ux = dx / distance;
	const uz = dz / distance;

	// Movement bands
	if (distance > BOW_CHASE_TAKEOVER_RANGE) {
		// far away — chase at full speed
		const step = m.speed * dt;
		m.x += ux * step;
		m.z += uz * step;
	} else if (distance > BOW_PREFERRED_RANGE) {
		// approach at half speed
		const step = m.speed * 0.5 * dt;
		m.x += ux * step;
		m.z += uz * step;
	} else if (distance < BOW_BACKAWAY_THRESHOLD) {
		// kite away at full speed
		const step = m.speed * dt;
		m.x -= ux * step;
		m.z -= uz * step;
	}
	// else: in preferred band — hold position

	// Shooting
	if (
		distance <= BOW_MAX_FIRE_RANGE &&
		m.nextShotAt !== undefined &&
		now >= m.nextShotAt
	) {
		fire(m, ux, uz);
		m.nextShotAt = now + BOW_FIRE_INTERVAL;
	}
}
