export type ItemKind = "sword" | "bow" | "food";
export type Quality = 1 | 2 | 3 | 4 | 5 | 6;

export interface Item {
	kind: ItemKind;
	quality: Quality;
}

export const HOTBAR_SIZE = 10;

export const QUALITY_NAMES = [
	"common",
	"uncommon",
	"rare",
	"epic",
	"legendary",
	"godly",
] as const;

export const QUALITY_COLORS: readonly number[] = [
	0xcccccc, // common
	0x44dd44, // uncommon
	0x4488ff, // rare
	0xcc44ff, // epic
	0xffaa22, // legendary
	0xff3333, // godly
];

export function damageOf(quality: Quality): number {
	return quality;
}

export const STAMINA_PER_ATTACK = 1;
export const STAMINA_REGEN_DELAY = 1;

export interface PlayerState {
	health: number;
	maxHealth: number;
	stamina: number;
	maxStamina: number;
	hotbar: (Item | null)[];
	selectedSlot: number;
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
	const hotbar: (Item | null)[] = new Array(HOTBAR_SIZE).fill(null);
	hotbar[0] = { kind: "sword", quality: 1 };
	return {
		player: {
			health: 3,
			maxHealth: 3,
			stamina: 100,
			maxStamina: 100,
			hotbar,
			selectedSlot: 0,
			iframesUntil: 0,
			hitFlashUntil: 0,
			lastAttackAt: -Infinity,
		},
		now: 0,
		phase: "playing",
		floor: 0,
	};
}

export function equippedItem(state: GameState): Item | null {
	return state.player.hotbar[state.player.selectedSlot] ?? null;
}

export function canAttack(state: GameState): boolean {
	return state.player.stamina >= STAMINA_PER_ATTACK;
}

export function consumeAttackStamina(state: GameState): void {
	state.player.stamina = Math.max(0, state.player.stamina - STAMINA_PER_ATTACK);
	state.player.lastAttackAt = state.now;
}
