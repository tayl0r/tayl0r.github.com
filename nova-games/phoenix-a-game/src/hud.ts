import { LEVELS } from "./levels";
import type { GameState } from "./state";

function setHearts(el: HTMLElement, filled: number, empty: number): void {
	while (el.firstChild) el.removeChild(el.firstChild);
	const full = document.createElement("span");
	full.style.color = "#ff3344";
	full.textContent = "♥".repeat(filled);
	const hollow = document.createElement("span");
	hollow.style.color = "#ffffff";
	hollow.textContent = "♡".repeat(empty);
	el.appendChild(full);
	el.appendChild(hollow);
}

export function renderHud(state: GameState): void {
	const p = state.player;
	const filled = Math.max(0, Math.min(p.maxHealth, Math.ceil(p.health)));
	const empty = p.maxHealth - filled;
	const healthEl = document.getElementById("hud-health");
	if (healthEl) setHearts(healthEl, filled, empty);
	const floorEl = document.getElementById("hud-floor");
	if (floorEl) {
		const floorIdx = Math.min(state.floor, LEVELS.length - 1);
		const level = LEVELS[floorIdx];
		floorEl.textContent = `Floor ${state.floor + 1} / ${LEVELS.length} — ${level.name}`;
	}
	const stamFillEl = document.getElementById("hud-stamina-fill");
	if (stamFillEl) {
		const pct = Math.max(0, Math.min(1, p.stamina / p.maxStamina)) * 100;
		stamFillEl.style.width = `${pct}%`;
	}
	const hud = document.getElementById("hud");
	if (hud) {
		const flashing = state.now < p.hitFlashUntil;
		hud.classList.toggle("hud-flash", flashing);
	}
	const banner = document.getElementById("hud-banner");
	if (banner) {
		if (state.phase === "dead") {
			banner.style.display = "flex";
			banner.textContent = "You Died — click to respawn";
		} else if (state.phase === "won") {
			banner.style.display = "flex";
			banner.textContent = "You Win! — click to restart";
		} else {
			banner.style.display = "none";
		}
	}
}
