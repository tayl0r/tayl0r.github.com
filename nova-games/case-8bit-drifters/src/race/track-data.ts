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

// Nürburgring-inspired loop. Counter-clockwise, ~6500 world units long,
// ~4× the original track. Single closed loop with no self-intersection:
// every segment lives on the OUTER ring of a kidney-bean shape, so the
// road never passes near itself. Layout:
//   - long east-bound start/finish straight at the top (y = -500)
//   - sweeping right turn down the east side to an east apex (x ≈ 1500)
//   - south sector: bumpy west-bound chicane chain at y ≈ 470-510
//   - climb back northwest along the west side
//   - tight return into the start of the straight
export const TOKYO: TrackData = {
	width: 160,
	startIndex: 2, // mid of start straight (waypoint 2 → 3 is the start/finish line)
	centerline: [
		// === Start/finish straight (east-bound, y = -500) ===
		{ x: -800, y: -500 }, // 0  west end of straight
		{ x: -400, y: -500 },
		{ x: 0, y: -500 }, // 2  start/finish line
		{ x: 400, y: -500 },
		{ x: 800, y: -500 }, // 4  east end, begin east curve

		// === East side: long right-hand sweeper from top to south ===
		{ x: 1100, y: -460 }, // 5
		{ x: 1300, y: -350 },
		{ x: 1450, y: -150 },
		{ x: 1500, y: 50 }, // 8  east apex
		{ x: 1430, y: 250 },
		{ x: 1280, y: 400 }, // 10

		// === South sector: bumpy west-bound chicane chain ===
		{ x: 1050, y: 480 }, // 11
		{ x: 800, y: 510 },
		{ x: 550, y: 480 },
		{ x: 300, y: 510 },
		{ x: 50, y: 470 }, // 15
		{ x: -200, y: 500 },
		{ x: -450, y: 480 },
		{ x: -700, y: 440 },

		// === West side: climb back to the start straight ===
		{ x: -950, y: 350 }, // 19
		{ x: -1150, y: 220 },
		{ x: -1300, y: 50 },
		{ x: -1380, y: -150 },
		{ x: -1380, y: -300 },
		{ x: -1280, y: -430 },
		{ x: -1100, y: -480 }, // 25  rejoin start straight
	],

	// Building placement: every building's ENTIRE visual footprint
	// (roof + south-extending facade) must be clear of the road. The
	// constraint for north-side buildings is `y + h + height ≤ road_north_edge`,
	// not just `y + h ≤ road_north_edge` — the facade is what was previously
	// rendering inside the asphalt. Buildings here all stay at least 10
	// units clear of the road on the road-facing side.
	buildings: [
		// === Start straight, NORTH side (road north edge y=-580).
		// y + h + height ≤ -590 keeps facade tip 10 units north of road. ===
		{
			x: -800,
			y: -800,
			w: 200,
			h: 80,
			height: 120,
			color: 0x1a2438,
			neon: 0xff3399,
		},
		{
			x: -540,
			y: -830,
			w: 200,
			h: 100,
			height: 130,
			color: 0x1f2c44,
			neon: 0x00d2ff,
		},
		{
			x: -280,
			y: -790,
			w: 220,
			h: 80,
			height: 110,
			color: 0x222d44,
			neon: 0x00ff88,
		},
		{
			x: 20,
			y: -830,
			w: 200,
			h: 100,
			height: 130,
			color: 0x1c2640,
			neon: 0xff77dd,
		},
		{
			x: 280,
			y: -790,
			w: 200,
			h: 80,
			height: 110,
			color: 0x1a2438,
			neon: 0x00d2ff,
		},
		{
			x: 540,
			y: -820,
			w: 240,
			h: 100,
			height: 120,
			color: 0x21304a,
			neon: 0xffd900,
		},

		// === Start straight, SOUTH side (road south edge y=-420).
		// Building y ≥ -380 keeps the roof 40 units clear; facade extends
		// further south away from the road. ===
		{ x: -780, y: -380, w: 140, h: 70, height: 80, color: 0x182030 },
		{
			x: -350,
			y: -380,
			w: 160,
			h: 70,
			height: 80,
			color: 0x182030,
			neon: 0xff3399,
		},
		{ x: 100, y: -380, w: 140, h: 70, height: 80, color: 0x182030 },
		{
			x: 500,
			y: -380,
			w: 160,
			h: 70,
			height: 80,
			color: 0x182030,
			neon: 0x00d2ff,
		},

		// === East apex landmark (east of road, road east edge x=1580). x ≥ 1620. ===
		{
			x: 1620,
			y: -100,
			w: 120,
			h: 100,
			height: 130,
			color: 0x1c2640,
			neon: 0x00d2ff,
		},

		// === South sector accents (south of road, road south edge y≈590). y ≥ 620. ===
		{
			x: 280,
			y: 620,
			w: 140,
			h: 80,
			height: 90,
			color: 0x222d44,
			neon: 0xff77dd,
		},
		{
			x: -380,
			y: 620,
			w: 160,
			h: 80,
			height: 100,
			color: 0x21304a,
			neon: 0x00ff88,
		},

		// === West apex landmark (west of road, road west edge x=-1460). x ≤ -1620. ===
		{
			x: -1620,
			y: -100,
			w: 120,
			h: 80,
			height: 90,
			color: 0x1c2640,
			neon: 0xffd900,
		},
	],

	// Park/lake in the empty interior of the loop — the kidney-bean shape
	// leaves a big middle area that no track passes through.
	lake: { cx: 100, cy: 0, rx: 300, ry: 180 },
};
