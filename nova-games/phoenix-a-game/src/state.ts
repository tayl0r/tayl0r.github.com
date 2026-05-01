export type Weapon = "sword" | "bow";

export interface PlayerState {
	health: number;
	maxHealth: number;
	stamina: number;
	maxStamina: number;
	hunger: number;
	maxHunger: number;
	swordDamage: number;
	bowDamage: number;
	weapon: Weapon;
	iframesUntil: number;
	hitFlashUntil: number;
}

export interface GameState {
	player: PlayerState;
	now: number;
	phase: "playing" | "dead" | "won";
}

export function createInitialState(): GameState {
	return {
		player: {
			health: 3,
			maxHealth: 3,
			stamina: 20,
			maxStamina: 20,
			hunger: 10,
			maxHunger: 10,
			swordDamage: 1,
			bowDamage: 1,
			weapon: "sword",
			iframesUntil: 0,
			hitFlashUntil: 0,
		},
		now: 0,
		phase: "playing",
	};
}
