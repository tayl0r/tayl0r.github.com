import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { persist } from "../storage";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createHomeScene } from "./home";
import { validateName } from "./name-filter";

export const createNamePickerScene: SceneFactory = (ctx) => {
	const root = new Container();

	const carG = new Graphics();
	renderCar(carG, DEFAULT_LOOK);
	carG.scale.set(2.5);
	const tag = pixelText(ctx.profile?.name ?? "click to name", { fontSize: 22 });
	tag.eventMode = "static";
	tag.cursor = "text";
	const errText = pixelText("", { fontSize: 14, fill: 0xff5577 });
	const cont = pixelButton(
		"CONTINUE",
		() => {
			if (!ctx.profile) return;
			persist(ctx);
			ctx.switchTo(createHomeScene);
		},
		22,
	);
	cont.setEnabled(!!ctx.profile);

	root.addChild(carG, tag, errText, cont.view);

	const place = (): void => {
		const cx = ctx.app.screen.width / 2;
		const cy = ctx.app.screen.height / 2;
		tag.position.set(cx, cy - 110);
		carG.position.set(cx, cy);
		errText.position.set(cx, cy + 90);
		cont.view.position.set(cx, cy + 150);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const beginEdit = (): void => {
		tag.visible = false;
		errText.text = ""; // clear any previous error message before re-edit
		const input = document.createElement("input");
		input.type = "text";
		input.maxLength = 12;
		input.value = ctx.profile?.name ?? "";
		Object.assign(input.style, {
			position: "fixed",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -160px)",
			fontFamily: '"Press Start 2P", monospace',
			fontSize: "22px",
			background: "#0a0a14",
			color: "white",
			border: "2px solid #00d2ff",
			padding: "8px 12px",
			textAlign: "center",
			zIndex: "10",
		});
		document.body.appendChild(input);
		input.focus();
		input.select();
		const commit = (): void => {
			const v = validateName(input.value);
			if (v !== "ok") {
				errText.text =
					v === "empty"
						? "name can't be empty"
						: v === "too_long"
							? "max 12 characters"
							: "school-appropriate names please";
				input.remove();
				tag.visible = true;
				return;
			}
			errText.text = "";
			ctx.profile = { name: input.value.trim() };
			tag.text = ctx.profile.name;
			tag.visible = true;
			cont.setEnabled(true);
			input.remove();
		};
		input.addEventListener("blur", commit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") input.blur();
			if (e.key === "Escape") {
				input.remove();
				tag.visible = true;
			}
		});
	};
	tag.on("pointertap", beginEdit);

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
