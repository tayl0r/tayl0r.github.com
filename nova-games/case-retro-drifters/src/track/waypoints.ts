import type { Waypoint } from "../types";

const W = 8;

export const tokyoWaypoints: Waypoint[] = [
	{ pos: { x: 0, z: 0 }, width: W, tag: "start" },
	{ pos: { x: 30, z: 10 }, width: W },
	{ pos: { x: 55, z: 35 }, width: W },
	{ pos: { x: 70, z: 70 }, width: W },
	{ pos: { x: 70, z: 105 }, width: W },
	{ pos: { x: 50, z: 130 }, width: W },
	{ pos: { x: 20, z: 140 }, width: W },
	{ pos: { x: -15, z: 130 }, width: W },
	{ pos: { x: -40, z: 110 }, width: W },
	{ pos: { x: -50, z: 80 }, width: W },
	{ pos: { x: -55, z: 45 }, width: W * 1.8, tag: "shibuya" },
	{ pos: { x: -50, z: 10 }, width: W },
	{ pos: { x: -35, z: -20 }, width: W },
	{ pos: { x: -10, z: -40 }, width: W },
	{ pos: { x: 20, z: -45 }, width: W },
	{ pos: { x: 50, z: -35 }, width: W },
	{ pos: { x: 65, z: -15 }, width: W },
	{ pos: { x: 40, z: -5 }, width: W },
	{ pos: { x: 20, z: -2 }, width: W },
];
