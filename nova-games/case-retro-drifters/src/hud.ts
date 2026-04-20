import { MAX_SPEED } from "./car/physics";

export class HUD {
	private root = document.getElementById("race-hud") as HTMLDivElement;
	private fill = document.getElementById("hud-speed-fill") as HTMLDivElement;
	private lap = document.getElementById("hud-lap") as HTMLDivElement;
	private timerCurrent = document.getElementById(
		"hud-timer-current",
	) as HTMLSpanElement;
	private timerBest = document.getElementById(
		"hud-timer-best",
	) as HTMLSpanElement;
	private center = document.getElementById("hud-center") as HTMLDivElement;
	private back = document.getElementById("hud-back") as HTMLButtonElement;
	private hideTimer: number | null = null;

	show(): void {
		this.root.classList.add("active");
	}
	hide(): void {
		this.root.classList.remove("active");
		this.back.classList.remove("visible");
	}

	setSpeed(speed: number, drifting: boolean): void {
		const pct = Math.max(0, Math.min(1, speed / MAX_SPEED));
		this.fill.style.height = `${pct * 100}%`;
		this.fill.style.filter = drifting ? "brightness(1.4) saturate(1.5)" : "";
	}

	setLap(current: number, total: number): void {
		this.lap.textContent = `LAP ${current} / ${total}`;
	}

	setTimes(current: number, best: number | null): void {
		this.timerCurrent.textContent = fmt(current);
		this.timerBest.textContent = best == null ? "best --" : `best ${fmt(best)}`;
	}

	flash(text: string, durationMs: number): void {
		this.setCenter(text);
		if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
		this.hideTimer = window.setTimeout(() => {
			this.clearCenter();
			this.hideTimer = null;
		}, durationMs);
	}

	setCenter(text: string): void {
		this.center.textContent = text;
		this.center.classList.add("visible");
	}

	clearCenter(): void {
		this.center.classList.remove("visible");
	}

	onBack(handler: () => void): () => void {
		this.back.addEventListener("click", handler);
		return () => this.back.removeEventListener("click", handler);
	}

	showBack(): void {
		this.back.classList.add("visible");
	}
}

function fmt(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = (seconds % 60).toFixed(3).padStart(6, "0");
	return `${m.toString().padStart(2, "0")}:${s}`;
}
