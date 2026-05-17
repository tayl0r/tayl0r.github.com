import type { Monster } from "./monsters";
import { type GameState, STAMINA_REGEN_DELAY } from "./state";

const STAMINA_REGEN_PER_SEC = 1;

export function tickPlayer(state: GameState, dt: number): void {
	if (state.phase !== "playing") {
		state.now += dt;
		return;
	}
	const p = state.player;
	if (state.now - p.lastAttackAt >= STAMINA_REGEN_DELAY) {
		p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN_PER_SEC * dt);
	}
	state.now += dt;
}

export function applyContactDamage(
	state: GameState,
	monsters: Monster[],
	playerX: number,
	playerZ: number,
	playerRadius: number,
): void {
	if (state.now < state.player.iframesUntil) return;
	for (const m of monsters) {
		if (m.hp <= 0) continue;
		const d = Math.hypot(m.x - playerX, m.z - playerZ);
		if (d < m.contact + playerRadius) {
			const swordBonus = m.weapon.kind === "sword" ? m.weapon.quality : 0;
			state.player.health = Math.max(
				0,
				state.player.health - (m.damage + swordBonus),
			);
			state.player.iframesUntil = state.now + 1;
			state.player.hitFlashUntil = state.now + 0.15;
			break;
		}
	}
}
