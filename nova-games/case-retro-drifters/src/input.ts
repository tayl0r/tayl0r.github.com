import type { CarInput } from "./types";

type KeyState = Record<string, boolean>;

export class Input {
	private keys: KeyState = {};
	private prevShift = false;

	constructor() {
		window.addEventListener("keydown", this.onDown);
		window.addEventListener("keyup", this.onUp);
	}

	dispose(): void {
		window.removeEventListener("keydown", this.onDown);
		window.removeEventListener("keyup", this.onUp);
	}

	private onDown = (e: KeyboardEvent): void => {
		this.keys[e.code] = true;
	};
	private onUp = (e: KeyboardEvent): void => {
		this.keys[e.code] = false;
	};

	isDown(code: string): boolean {
		return !!this.keys[code];
	}

	readCar(): CarInput {
		const left = this.isDown("ArrowLeft") || this.isDown("KeyA");
		const right = this.isDown("ArrowRight") || this.isDown("KeyD");
		const throttle =
			this.isDown("Space") || this.isDown("KeyW") || this.isDown("ArrowUp")
				? 1
				: 0;
		const brake = this.isDown("KeyS") ? 1 : 0;
		const shiftNow = this.isDown("ShiftLeft") || this.isDown("ShiftRight");
		const driftPress = shiftNow && !this.prevShift;
		this.prevShift = shiftNow;
		const steer = (left ? -1 : 0) + (right ? 1 : 0);
		return { throttle, brake, steer, driftPress };
	}
}
