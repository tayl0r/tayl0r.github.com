import { Container, Graphics } from "pixi.js";
import { makeCarUiSprite } from "../art/car";
import { CARS } from "../art/car-catalog";
import type { Scene, SceneFactory } from "../context";
import { persist } from "../storage";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createHomeScene } from "./home";

const COLS = 6;
const CARD_W = 130;
const CARD_H = 150;
const GAP = 18;
const SPRITE_BOX = 86; // car art is fit into this square (UI px)

type Card = {
	view: Container;
	frame: Graphics;
	badge: Container; // shown when this car is the equipped one
};

export const createLockerScene: SceneFactory = (ctx) => {
	const root = new Container();

	const title = pixelText("LOCKER", { fontSize: 32, fill: 0x00d2ff });
	const subtitle = pixelText("CLICK A CAR TO EQUIP IT", {
		fontSize: 12,
		fill: 0x8a92a3,
	});

	const back = pixelButton("← BACK", () => ctx.switchTo(createHomeScene), 16);

	const grid = new Container();
	const cards: Card[] = [];

	const select = (carId: string): void => {
		ctx.carId = carId;
		persist(ctx);
		for (let i = 0; i < CARS.length; i++) {
			const isSel = CARS[i].id === carId;
			cards[i].frame.tint = isSel ? 0x00d2ff : 0xffffff;
			cards[i].badge.visible = isSel;
		}
	};

	for (let i = 0; i < CARS.length; i++) {
		const car = CARS[i];
		const view = new Container();
		view.eventMode = "static";
		view.cursor = "pointer";

		// Card background — drawn at the card's local origin (0,0); the card
		// container is positioned to its top-left in `place()`.
		const frame = new Graphics()
			.roundRect(0, 0, CARD_W, CARD_H, 12)
			.fill({ color: 0x131726, alpha: 0.96 })
			.stroke({ color: 0xffffff, width: 2, alpha: 0.55 });
		view.addChild(frame);

		const sprite = makeCarUiSprite(car.id);
		// Fit sprite into SPRITE_BOX while preserving aspect ratio.
		const native = Math.max(car.frame.w, car.frame.h);
		const scale = SPRITE_BOX / native;
		sprite.scale.set(scale);
		sprite.position.set(CARD_W / 2, CARD_H / 2 - 18);
		view.addChild(sprite);

		const name = pixelText(car.name.toUpperCase(), {
			fontSize: 10,
			fill: 0xc9d1e1,
		});
		name.position.set(CARD_W / 2, CARD_H - 18);
		view.addChild(name);

		// "EQUIPPED" badge — visibility toggled by select().
		const badge = new Container();
		const badgeBg = new Graphics()
			.roundRect(-46, -8, 92, 16, 4)
			.fill({ color: 0x00d2ff });
		const badgeText = pixelText("EQUIPPED", {
			fontSize: 8,
			fill: 0x0a0a14,
		});
		badge.addChild(badgeBg, badgeText);
		badge.position.set(CARD_W / 2, 12);
		badge.visible = false;
		view.addChild(badge);

		view.on("pointerover", () => {
			view.scale.set(1.04);
		});
		view.on("pointerout", () => {
			view.scale.set(1);
		});
		view.on("pointertap", () => select(car.id));

		grid.addChild(view);
		cards.push({ view, frame, badge });
	}

	root.addChild(title, subtitle, back.view, grid);

	const place = (): void => {
		const w = ctx.app.screen.width;
		const h = ctx.app.screen.height;
		title.position.set(w / 2, 50);
		subtitle.position.set(w / 2, 80);
		back.view.position.set(60, 50);

		const rows = Math.ceil(CARS.length / COLS);
		const gridW = COLS * CARD_W + (COLS - 1) * GAP;
		const gridH = rows * CARD_H + (rows - 1) * GAP;
		const gridX = (w - gridW) / 2;
		const gridY = Math.max(110, (h - gridH) / 2);
		// Place each card by its top-left within the grid container.
		for (let i = 0; i < CARS.length; i++) {
			const col = i % COLS;
			const row = Math.floor(i / COLS);
			cards[i].view.position.set(col * (CARD_W + GAP), row * (CARD_H + GAP));
		}
		grid.position.set(gridX, gridY);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	// Initial selection state — defaults to whatever is persisted (or the
	// catalog default if nothing).
	select(ctx.carId ?? CARS[0].id);

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
