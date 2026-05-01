import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { pixelButton } from "../ui/button";
import { panel } from "../ui/panel";
import { pixelText } from "../ui/pixel-text";
import { createTabs } from "../ui/tabs";
import { createRaceScene } from "./race";
import { createSettingsModal } from "./settings-modal";

const MODES = ["TIMED RUNS", "FREE PRACTICE", "RANKED"] as const;

export const createHomeScene: SceneFactory = (ctx) => {
	const root = new Container();

	// Top bar: gear, tabs. Declare baseTabsX up front so the click closure
	// below can reference it without TS strict-mode "used before declaration"
	// errors.
	let baseTabsX = 0;
	const gear = pixelText("⚙", { fontSize: 28 });
	gear.eventMode = "static";
	gear.cursor = "pointer";
	const tabs = createTabs(
		[
			{ id: "home", label: "Home", enabled: true },
			{ id: "locker", label: "Locker", enabled: false },
		],
		"home",
		(id) => {
			if (id === "locker") {
				// Disabled — small shake
				const t0 = performance.now();
				const animate = (): void => {
					const t = (performance.now() - t0) / 1000;
					tabs.view.x =
						baseTabsX + Math.sin(t * 50) * 6 * Math.max(0, 1 - t * 5);
					if (t < 0.2) requestAnimationFrame(animate);
					else tabs.view.x = baseTabsX;
				};
				animate();
			}
		},
	);

	// Map list (left)
	const mapPanel = panel(180, 220);
	const mapTitle = pixelText("MAPS", { fontSize: 14 });
	mapTitle.position.set(0, -90);
	const mapEntry = pixelText("• TOKYO", { fontSize: 16, fill: 0x00d2ff });
	mapEntry.position.set(0, -60);
	mapPanel.addChild(mapTitle, mapEntry);

	// Center: car preview
	const carG = new Graphics();
	renderCar(carG, DEFAULT_LOOK);
	carG.scale.set(3);

	// Mode toggle
	let modeIdx = 0;
	const modeButton = pixelButton(
		MODES[modeIdx],
		() => {
			modeIdx = (modeIdx + 1) % MODES.length;
			modeText.text = MODES[modeIdx];
			// Quick rotate animation
			modeWrap.rotation = -Math.PI / 2;
			const t0 = performance.now();
			const tween = (): void => {
				const t = Math.min(1, (performance.now() - t0) / 250);
				modeWrap.rotation = (-Math.PI / 2) * (1 - t);
				if (t < 1) requestAnimationFrame(tween);
			};
			tween();
		},
		16,
	);
	const modeWrap = new Container();
	modeWrap.addChild(modeButton.view);
	const modeText = modeButton.view.children[0] as import("pixi.js").Text;

	// Race button
	const raceButton = pixelButton(
		"RACE",
		() => ctx.switchTo(createRaceScene),
		24,
	);

	root.addChild(gear, tabs.view, mapPanel, carG, modeWrap, raceButton.view);

	// Settings modal lives on top, added/removed by gear click
	let modalOpen = false;
	gear.on("pointertap", () => {
		if (modalOpen) return;
		const modal = createSettingsModal({
			ctx,
			currentSceneFactory: createHomeScene,
			onClose: () => {
				root.removeChild(modal);
				modalOpen = false;
			},
		});
		root.addChild(modal);
		modalOpen = true;
	});

	const place = (): void => {
		const w = ctx.app.screen.width;
		const h = ctx.app.screen.height;
		gear.position.set(24, 16);
		baseTabsX = 80;
		tabs.view.position.set(baseTabsX, 18);
		mapPanel.position.set(140, h / 2);
		carG.position.set(w / 2, h / 2);
		modeWrap.position.set(w - 200, h - 130);
		raceButton.view.position.set(w - 200, h - 70);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
