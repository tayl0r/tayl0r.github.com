import type { Weapon } from "./state";

export interface InputState {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
	shift: boolean;
	click: boolean;
	weapon: Weapon; // legacy — removed in Task 14
	interact: boolean;
	cycleLeft: boolean;
	cycleRight: boolean;
	dropSelected: boolean;
	slotDigit: number | null;
	mouseDX: number;
	mouseDY: number;
}

export function createInput(): InputState {
	return {
		w: false,
		a: false,
		s: false,
		d: false,
		shift: false,
		click: false,
		weapon: "sword",
		interact: false,
		cycleLeft: false,
		cycleRight: false,
		dropSelected: false,
		slotDigit: null,
		mouseDX: 0,
		mouseDY: 0,
	};
}

export function wireInput(input: InputState): void {
	const setKey = (e: KeyboardEvent, down: boolean) => {
		switch (e.code) {
			case "KeyW":
				input.w = down;
				break;
			case "KeyA":
				input.a = down;
				break;
			case "KeyS":
				input.s = down;
				break;
			case "KeyD":
				input.d = down;
				break;
			case "ShiftLeft":
			case "ShiftRight":
				input.shift = down;
				break;
			case "KeyQ":
				if (down) input.cycleLeft = true;
				break;
			case "KeyE":
				if (down) input.cycleRight = true;
				break;
			case "Space":
				if (down) input.interact = true;
				break;
			case "Digit1":
				if (down) {
					input.weapon = "sword";
					input.slotDigit = 0;
				}
				break;
			case "Digit2":
				if (down) {
					input.weapon = "bow";
					input.slotDigit = 1;
				}
				break;
			case "Digit3":
				if (down) input.slotDigit = 2;
				break;
			case "Digit4":
				if (down) input.slotDigit = 3;
				break;
			case "Digit5":
				if (down) input.slotDigit = 4;
				break;
			case "Digit6":
				if (down) input.slotDigit = 5;
				break;
			case "Digit7":
				if (down) input.slotDigit = 6;
				break;
			case "Digit8":
				if (down) input.slotDigit = 7;
				break;
			case "Digit9":
				if (down) input.slotDigit = 8;
				break;
			case "Digit0":
				if (down) input.slotDigit = 9;
				break;
		}
	};
	window.addEventListener("keydown", (e) => setKey(e, true));
	window.addEventListener("keyup", (e) => setKey(e, false));
	window.addEventListener("mousedown", (e) => {
		if (e.button === 0) input.click = true;
		if (e.button === 2) input.dropSelected = true;
	});
	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) input.click = false;
	});
	window.addEventListener("contextmenu", (e) => e.preventDefault());
	window.addEventListener("mousemove", (e) => {
		if (document.pointerLockElement) {
			input.mouseDX += e.movementX;
			input.mouseDY += e.movementY;
		}
	});
}
