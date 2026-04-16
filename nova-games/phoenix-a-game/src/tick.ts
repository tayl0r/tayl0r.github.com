import type { Monster } from "./monsters";
import type { GameState } from "./state";

const HUNGER_PER_SEC_WALKING = 0.5 / 60;
const HUNGER_PER_SEC_SPRINTING = 1 / 30;
const STAMINA_DRAIN_PER_SEC = 3;
const STAMINA_REGEN_PER_SEC = 5;
const STARVE_DAMAGE_PER_SEC = 0.1;

export function tickPlayer(
	state: GameState,
	dt: number,
	moving: boolean,
	sprinting: boolean,
): void {
	if (state.phase !== "playing") {
		state.now += dt;
		return;
	}
	const p = state.player;
	if (moving) {
		const drain = sprinting ? HUNGER_PER_SEC_SPRINTING : HUNGER_PER_SEC_WALKING;
		p.hunger = Math.max(0, p.hunger - drain * dt);
	}
	if (sprinting && p.stamina > 0) {
		p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN_PER_SEC * dt);
	} else if (!sprinting) {
		p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN_PER_SEC * dt);
	}
	if (p.hunger === 0) {
		p.health = Math.max(0, p.health - STARVE_DAMAGE_PER_SEC * dt);
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
			state.player.health = Math.max(0, state.player.health - m.damage);
			state.player.iframesUntil = state.now + 1;
			state.player.hitFlashUntil = state.now + 0.15;
			break;
		}
	}
}
