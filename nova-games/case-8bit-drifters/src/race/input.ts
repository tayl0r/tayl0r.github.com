export type InputState = {
	throttle: -1 | 0 | 1;
	steer: -1 | 0 | 1;
	drift: boolean;
	driftPressed: boolean; // edge: true the frame Shift is pressed
};

export type Input = {
	read(): InputState;
	dispose(): void;
};

export function createKeyboardInput(): Input {
	const keys = new Set<string>();
	let driftPressedEdge = false;
	const onDown = (e: KeyboardEvent): void => {
		const k = e.key.toLowerCase();
		if (k === "shift" && !keys.has("shift")) driftPressedEdge = true;
		keys.add(k);
	};
	const onUp = (e: KeyboardEvent): void => {
		keys.delete(e.key.toLowerCase());
	};
	window.addEventListener("keydown", onDown);
	window.addEventListener("keyup", onUp);
	return {
		read() {
			const throttle: -1 | 0 | 1 =
				keys.has("w") || keys.has("arrowup")
					? 1
					: keys.has("s") || keys.has("arrowdown")
						? -1
						: 0;
			const steer: -1 | 0 | 1 =
				keys.has("a") || keys.has("arrowleft")
					? -1
					: keys.has("d") || keys.has("arrowright")
						? 1
						: 0;
			const drift = keys.has("shift");
			const driftPressed = driftPressedEdge;
			driftPressedEdge = false;
			return { throttle, steer, drift, driftPressed };
		},
		dispose() {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
		},
	};
}
