import type { GameState } from "./state";

export function renderHud(state: GameState): void {
	const p = state.player;
	const heartCount = Math.max(0, Math.ceil(p.health));
	const healthEl = document.getElementById("hud-health");
	if (healthEl) healthEl.textContent = `HP ${"♥".repeat(heartCount)}`;
	const stamEl = document.getElementById("hud-stamina");
	if (stamEl)
		stamEl.textContent = `STAM ${Math.round(p.stamina)}/${p.maxStamina}`;
	const hungEl = document.getElementById("hud-hunger");
	if (hungEl) hungEl.textContent = "🍗".repeat(Math.ceil(p.hunger));
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
