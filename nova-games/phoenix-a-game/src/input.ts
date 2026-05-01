import type { Weapon } from "./state";

export interface InputState {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
	shift: boolean;
	click: boolean;
	weapon: Weapon;
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
			case "Digit1":
				if (down) input.weapon = "sword";
				break;
			case "Digit2":
				if (down) input.weapon = "bow";
				break;
		}
	};
	window.addEventListener("keydown", (e) => setKey(e, true));
	window.addEventListener("keyup", (e) => setKey(e, false));
	window.addEventListener("mousedown", (e) => {
		if (e.button === 0) input.click = true;
	});
	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) input.click = false;
	});
	window.addEventListener("mousemove", (e) => {
		if (document.pointerLockElement) {
			input.mouseDX += e.movementX;
			input.mouseDY += e.movementY;
		}
	});
}
