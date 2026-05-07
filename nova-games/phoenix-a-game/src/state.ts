export type Weapon = "sword" | "bow";

export const STAMINA_PER_ATTACK = 1;
export const STAMINA_REGEN_DELAY = 1;

export interface PlayerState {
	health: number;
	maxHealth: number;
	stamina: number;
	maxStamina: number;
	swordDamage: number;
	bowDamage: number;
	weapon: Weapon;
	iframesUntil: number;
	hitFlashUntil: number;
	lastAttackAt: number;
}

export interface GameState {
	player: PlayerState;
	now: number;
	phase: "playing" | "dead" | "won";
	floor: number;
}

export function createInitialState(): GameState {
	return {
		player: {
			health: 3,
			maxHealth: 3,
			stamina: 100,
			maxStamina: 100,
			swordDamage: 1,
			bowDamage: 1,
			weapon: "sword",
			iframesUntil: 0,
			hitFlashUntil: 0,
			lastAttackAt: -Infinity,
		},
		now: 0,
		phase: "playing",
		floor: 0,
	};
}

export function canAttack(state: GameState): boolean {
	return state.player.stamina >= STAMINA_PER_ATTACK;
}

export function consumeAttackStamina(state: GameState): void {
	state.player.stamina = Math.max(0, state.player.stamina - STAMINA_PER_ATTACK);
	state.player.lastAttackAt = state.now;
}
