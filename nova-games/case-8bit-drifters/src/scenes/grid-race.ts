import { Container } from "pixi.js";
import type { Scene, SceneFactory } from "../context";
import { loadGridTrack } from "../race/grid-storage";
import { gridToTrackData } from "../race/grid-to-track";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createEditorScene } from "./editor";
import { createHomeScene } from "./home";
import { createRaceSceneFor } from "./race";

/** Loads the saved grid track, extracts a centerline + width, then delegates
 * to the standard race scene so the user gets the same asphalt + yellow
 * stripes + drift physics as the built-in tracks. If the grid can't be
 * converted (no start cell, too small, etc.) shows an error and offers a
 * jump back to the editor or home. */
export const createGridRaceScene: SceneFactory = (ctx) => {
	const grid = loadGridTrack();
	const track = gridToTrackData(grid);

	if (track) {
		return createRaceSceneFor({
			track,
			mapId: "custom",
			back: createEditorScene,
		})(ctx);
	}

	return createConversionFailedScene(ctx);
};

function createConversionFailedScene(ctx: Parameters<SceneFactory>[0]): Scene {
	const root = new Container();

	const msg = pixelText(
		"Couldn't build a track from the editor.\n\nMake sure your painted track\nincludes at least one START cell\nand forms a closed loop.",
		{ fontSize: 14, fill: 0xff8888 },
	);
	const editBtn = pixelButton(
		"← BACK TO EDITOR",
		() => ctx.switchTo(createEditorScene),
		14,
	);
	const menuBtn = pixelButton("MENU", () => ctx.switchTo(createHomeScene), 14);
	root.addChild(msg, editBtn.view, menuBtn.view);

	const place = (): void => {
		const w = ctx.app.screen.width;
		const h = ctx.app.screen.height;
		msg.position.set(w / 2 - msg.width / 2, h / 2 - 100);
		editBtn.view.position.set(w / 2 - 200, h / 2 + 100);
		menuBtn.view.position.set(w / 2 + 60, h / 2 + 100);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	return {
		root,
		update: () => {},
		dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
}
