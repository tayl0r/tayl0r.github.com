import { type GameState, HOTBAR_SIZE, type Item } from "./state";

export function cycle(state: GameState, dir: -1 | 1): void {
	const next = (state.player.selectedSlot + dir + HOTBAR_SIZE) % HOTBAR_SIZE;
	state.player.selectedSlot = next;
}

export function selectSlot(state: GameState, slot: number): void {
	const clamped = Math.max(0, Math.min(HOTBAR_SIZE - 1, Math.floor(slot)));
	state.player.selectedSlot = clamped;
}

export function firstEmptySlot(state: GameState): number {
	for (let i = 0; i < HOTBAR_SIZE; i++) {
		if (state.player.hotbar[i] === null) return i;
	}
	return -1;
}

export interface AddResult {
	slotted: number;
	displaced: Item | null;
}

export function addItem(state: GameState, item: Item): AddResult {
	const empty = firstEmptySlot(state);
	if (empty !== -1) {
		state.player.hotbar[empty] = item;
		return { slotted: empty, displaced: null };
	}
	const slot = state.player.selectedSlot;
	const displaced = state.player.hotbar[slot] ?? null;
	state.player.hotbar[slot] = item;
	return { slotted: slot, displaced };
}

export function removeSlot(state: GameState, slot: number): Item | null {
	const prev = state.player.hotbar[slot] ?? null;
	state.player.hotbar[slot] = null;
	return prev;
}
