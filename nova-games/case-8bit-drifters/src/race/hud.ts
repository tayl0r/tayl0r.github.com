import { Container } from "pixi.js";
import { pixelText } from "../ui/pixel-text";

export type HudApi = {
	view: Container;
	setLap(n: number, total: number): void;
	setCurrent(ms: number): void;
	setBest(ms: number | null): void;
	place(width: number): void;
};

export function formatTime(ms: number): string {
	const m = Math.floor(ms / 60000);
	const s = Math.floor((ms % 60000) / 1000);
	const mm = ms % 1000;
	return `${m}:${s.toString().padStart(2, "0")}.${mm.toString().padStart(3, "0").slice(0, 2)}`;
}

export function createHud(): HudApi {
	const view = new Container();
	const lap = pixelText("LAP 1 / 5", { fontSize: 16 });
	const cur = pixelText("0:00.00", { fontSize: 16 });
	const best = pixelText("BEST —", { fontSize: 12, fill: 0x8a92a3 });
	lap.anchor.set(1, 0);
	cur.anchor.set(1, 0);
	best.anchor.set(1, 0);
	lap.position.set(0, 0);
	cur.position.set(0, 24);
	best.position.set(0, 48);
	view.addChild(lap, cur, best);
	return {
		view,
		setLap(n, total) {
			lap.text = `LAP ${n} / ${total}`;
		},
		setCurrent(ms) {
			cur.text = formatTime(ms);
		},
		setBest(ms) {
			best.text = ms === null ? "BEST —" : `BEST ${formatTime(ms)}`;
		},
		place(width) {
			view.position.set(width - 16, 16);
		},
	};
}
