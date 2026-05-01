export type Vec2 = { x: number; y: number };

export type BuildingRect = {
	x: number;
	y: number; // top-left in world units
	w: number;
	h: number; // size
	height: number; // axonometric "tallness"
	color: number; // base facade color
	neon?: number; // optional neon trim color
	roofColor?: number;
};

export type TrackData = {
	centerline: Vec2[]; // closed polyline (last → first connects)
	width: number; // road width
	startIndex: number; // segment index where the start line sits
	buildings: BuildingRect[];
	lake?: { cx: number; cy: number; rx: number; ry: number };
};

// Hand-tuned Tokyo loop. Coordinates are arbitrary world units; lap target
// ~60s at the car's cruise speed (~25 units/s when straight). The shape is a
// distorted figure-eight-without-crossing: long start straight at the top,
// hairpin right, sweeping curve through "Shibuya" intersection, second hairpin,
// curve around the lake park, back to start.
export const TOKYO: TrackData = {
	width: 160,
	startIndex: 6, // mid-straight
	centerline: [
		{ x: -800, y: -400 }, // 0  start straight begin (west)
		{ x: -600, y: -400 },
		{ x: -400, y: -400 },
		{ x: -200, y: -400 },
		{ x: 0, y: -400 },
		{ x: 200, y: -400 },
		{ x: 400, y: -400 }, // 6  start/finish line
		{ x: 600, y: -400 },
		{ x: 800, y: -380 }, // 8  approach hairpin 1
		{ x: 900, y: -300 },
		{ x: 920, y: -180 },
		{ x: 900, y: -60 },
		{ x: 820, y: 40 }, // 12 exit hairpin 1
		{ x: 680, y: 100 }, // shibuya approach
		{ x: 500, y: 140 }, // 14 shibuya crossing center
		{ x: 300, y: 140 },
		{ x: 100, y: 120 },
		{ x: -80, y: 80 },
		{ x: -240, y: 0 }, // approach hairpin 2
		{ x: -340, y: -100 },
		{ x: -360, y: -240 }, // hairpin 2 inner
		{ x: -300, y: -340 },
		{ x: -180, y: -360 }, // park approach
		{ x: -40, y: -300 },
		{ x: 40, y: -200 }, // around lake (lake at ~(120, -180))
		{ x: 80, y: -80 },
		{ x: -20, y: 0 },
		{ x: -200, y: 60 },
		{ x: -400, y: 80 },
		{ x: -600, y: 60 },
		{ x: -780, y: 0 },
		{ x: -880, y: -120 },
		{ x: -900, y: -260 },
		{ x: -860, y: -380 }, // returns to start straight
	],
	buildings: [
		// Buildings flanking the start straight (north + south of road)
		{
			x: -800,
			y: -540,
			w: 200,
			h: 80,
			height: 90,
			color: 0x1a2438,
			neon: 0xff3399,
		},
		{
			x: -560,
			y: -560,
			w: 180,
			h: 100,
			height: 110,
			color: 0x1f2c44,
			neon: 0x00d2ff,
		},
		{
			x: -340,
			y: -540,
			w: 220,
			h: 80,
			height: 80,
			color: 0x222d44,
			neon: 0x00ff88,
		},
		{
			x: -100,
			y: -560,
			w: 200,
			h: 100,
			height: 130,
			color: 0x1c2640,
			neon: 0xff77dd,
		},
		{
			x: 140,
			y: -540,
			w: 200,
			h: 80,
			height: 100,
			color: 0x1a2438,
			neon: 0x00d2ff,
		},
		{
			x: 380,
			y: -560,
			w: 240,
			h: 100,
			height: 120,
			color: 0x21304a,
			neon: 0xffd900,
		},
		{ x: -780, y: -340, w: 100, h: 60, height: 70, color: 0x182030 },
		{ x: -40, y: -340, w: 100, h: 60, height: 70, color: 0x182030 },
		{
			x: 600,
			y: -340,
			w: 120,
			h: 80,
			height: 90,
			color: 0x182030,
			neon: 0xff3399,
		},
		// Hairpin 1 enclosure
		{
			x: 900,
			y: -200,
			w: 120,
			h: 100,
			height: 100,
			color: 0x1c2640,
			neon: 0x00d2ff,
		},
		// Shibuya block (4 corners around (500, 140))
		{
			x: 340,
			y: 40,
			w: 120,
			h: 80,
			height: 110,
			color: 0x222d44,
			neon: 0xff77dd,
		},
		{
			x: 540,
			y: 40,
			w: 140,
			h: 80,
			height: 130,
			color: 0x1f2c44,
			neon: 0x00ff88,
		},
		{
			x: 340,
			y: 200,
			w: 140,
			h: 100,
			height: 100,
			color: 0x1a2438,
			neon: 0x00d2ff,
		},
		{
			x: 560,
			y: 200,
			w: 120,
			h: 100,
			height: 120,
			color: 0x21304a,
			neon: 0xffd900,
		},
		// Around hairpin 2
		{ x: -440, y: -140, w: 100, h: 80, height: 90, color: 0x1c2640 },
		{ x: -440, y: -260, w: 100, h: 80, height: 90, color: 0x182030 },
		// Outer ring (variety + occlusion candidates)
		{ x: -1000, y: -500, w: 100, h: 80, height: 60, color: 0x121826 },
		{ x: -100, y: 140, w: 120, h: 100, height: 80, color: 0x172131 },
	],
	lake: { cx: 120, cy: -180, rx: 110, ry: 70 },
};
