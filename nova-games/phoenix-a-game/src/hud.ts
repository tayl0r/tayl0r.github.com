import { LEVELS } from "./levels";
import {
	type GameState,
	type Item,
	QUALITY_COLORS,
	QUALITY_NAMES,
} from "./state";

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

const slotElems: HTMLElement[] = [];

function ensureHotbarSlots(container: HTMLElement): void {
	if (slotElems.length) return;
	for (let i = 0; i < 10; i++) {
		const slot = document.createElement("div");
		slot.style.cssText = [
			"width: 40px",
			"height: 40px",
			"background: rgba(20,20,28,0.7)",
			"border: 2px solid rgba(255,255,255,0.2)",
			"border-radius: 3px",
			"position: relative",
			"font-family: sans-serif",
			"color: #fff",
		].join(";");
		const keyHint = document.createElement("span");
		keyHint.style.cssText =
			"position: absolute; top: 1px; left: 3px; font-size: 10px; opacity: 0.8;";
		keyHint.textContent = i === 9 ? "0" : String(i + 1);
		slot.appendChild(keyHint);
		const icon = document.createElement("span");
		icon.style.cssText =
			"position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 22px;";
		slot.appendChild(icon);
		const tier = document.createElement("span");
		tier.style.cssText =
			"position: absolute; bottom: 1px; right: 3px; font-size: 10px; opacity: 0.8;";
		slot.appendChild(tier);
		container.appendChild(slot);
		slotElems.push(slot);
	}
}

function iconFor(item: Item | null): string {
	if (!item) return "";
	if (item.kind === "sword") return "⚔";
	if (item.kind === "bow") return "🏹";
	return "🍎";
}

function tierLetter(item: Item | null): string {
	if (!item || item.kind === "food") return "";
	return QUALITY_NAMES[item.quality - 1].charAt(0).toUpperCase();
}

function colorHex(n: number): string {
	return `#${n.toString(16).padStart(6, "0")}`;
}

function renderHotbar(state: GameState): void {
	const container = document.getElementById("hud-hotbar");
	if (!container) return;
	ensureHotbarSlots(container);
	for (let i = 0; i < 10; i++) {
		const slot = slotElems[i];
		const item = state.player.hotbar[i];
		const selected = i === state.player.selectedSlot;
		const borderColor = item
			? colorHex(QUALITY_COLORS[item.quality - 1])
			: "rgba(255,255,255,0.2)";
		slot.style.borderColor = selected ? "#ffffff" : borderColor;
		slot.style.background = selected
			? "rgba(60,60,80,0.85)"
			: "rgba(20,20,28,0.7)";
		const [, iconEl, tierEl] = slot.childNodes as unknown as HTMLElement[];
		iconEl.textContent = iconFor(item);
		tierEl.textContent = tierLetter(item);
	}
}

function renderPrompt(prompt: string | null): void {
	const el = document.getElementById("hud-interact");
	if (!el) return;
	if (prompt) {
		el.style.display = "block";
		el.textContent = `[Space] ${prompt}`;
	} else {
		el.style.display = "none";
	}
}

export function renderHud(
	state: GameState,
	prompt: string | null = null,
	godMode = false,
): void {
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
	const godEl = document.getElementById("hud-godmode");
	if (godEl) godEl.style.display = godMode ? "block" : "none";
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
	renderHotbar(state);
	renderPrompt(prompt);
}
