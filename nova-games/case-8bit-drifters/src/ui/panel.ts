import { Container, Graphics } from "pixi.js";

export function panel(width: number, height: number): Container {
	const c = new Container();
	const bg = new Graphics()
		.roundRect(-width / 2, -height / 2, width, height, 16)
		.fill({ color: 0x131726, alpha: 0.96 })
		.stroke({ color: 0x00d2ff, width: 2, alpha: 0.4 });
	c.addChild(bg);
	return c;
}
