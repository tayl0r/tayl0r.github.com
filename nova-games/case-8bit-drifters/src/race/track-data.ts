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

// Driver's-track loop. Same kidney-bean envelope as before but every corner
// is now an actual corner — sharp enough that you have to either brake hard
// OR drift through. Sectors, going CCW (in screen space, y-down):
//   0–4   start/finish straight (east-bound at y=-500)
//   5–7   NE elbow — tight ~90° right
//   8–12  SE hairpin — long sweeper into a tight elbow at the deep east apex
//   13–19 south sector — two distinct chicanes joined by short straights
//   20–24 SW hairpin — long inward swing through the deep west apex
//   25–26 NW elbow — tight ~90° back into the start straight
// All corners share an outer ring (no segment passes near another), so the
// road never self-intersects despite the higher waypoint count.
export const TOKYO: TrackData = {
	width: 160,
	startIndex: 2, // start/finish line sits on segment 2 → 3
	centerline: [
		// === Start/finish straight (east-bound, y=-500) ===
		{ x: -800, y: -500 }, // 0  west end of straight
		{ x: -400, y: -500 },
		{ x: 0, y: -500 }, // 2  start/finish line
		{ x: 400, y: -500 },
		{ x: 800, y: -500 }, // 4  east end, begin NE elbow

		// === NE elbow — tight ~90° right ===
		{ x: 1100, y: -440 }, // 5
		{ x: 1300, y: -300 },
		{ x: 1380, y: -100 }, // 7  exit, heading south

		// === SE hairpin — sweep south, then tight elbow back west ===
		{ x: 1430, y: 100 }, // 8
		{ x: 1500, y: 280 },
		{ x: 1500, y: 420 }, // 10  deep east apex
		{ x: 1380, y: 510 }, // 11  tight elbow
		{ x: 1180, y: 530 }, // 12  exit, now west-bound

		// === South sector — chicane → short straight → chicane ===
		{ x: 980, y: 470 }, // 13  chicane 1 north peak
		{ x: 780, y: 530 }, // 14  chicane 1 south valley
		{ x: 580, y: 480 }, // 15  recover
		{ x: 300, y: 510 }, // 16  short connector
		{ x: 50, y: 470 }, // 17  chicane 2 north peak
		{ x: -200, y: 530 }, // 18  chicane 2 south valley
		{ x: -450, y: 470 }, // 19  recover

		// === SW hairpin — long inward swing through deep west apex ===
		{ x: -700, y: 440 }, // 20  entry
		{ x: -950, y: 350 },
		{ x: -1200, y: 200 },
		{ x: -1380, y: 0 }, // 23  deep west apex
		{ x: -1380, y: -200 },

		// === NW elbow — ~90° back into the straight ===
		{ x: -1280, y: -380 }, // 25
		{ x: -1100, y: -480 }, // 26  rejoin start straight
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

		// === East side landmarks. NE elbow exit at x≈1380, y=-100;
		// SE hairpin apex at x=1500, y=420. East edge of road ≈ apex_x + 80. ===
		{
			x: 1640,
			y: -100,
			w: 120,
			h: 100,
			height: 130,
			color: 0x1c2640,
			neon: 0x00d2ff,
		},
		{
			x: 1640,
			y: 380,
			w: 140,
			h: 110,
			height: 130,
			color: 0x21304a,
			neon: 0xffd900,
		},

		// === South sector accents (south of road). Chicanes peak at y=530
		// → road south edge y=610. Buildings y≥640 leaves 30-unit margin. ===
		{
			x: 280,
			y: 640,
			w: 140,
			h: 80,
			height: 90,
			color: 0x222d44,
			neon: 0xff77dd,
		},
		{
			x: -380,
			y: 640,
			w: 160,
			h: 80,
			height: 100,
			color: 0x21304a,
			neon: 0x00ff88,
		},

		// === West side landmarks. SW hairpin apex at x=-1380, y=0;
		// west edge of road ≈ -1460. Buildings x ≤ -1620 leaves 160-unit margin. ===
		{
			x: -1620,
			y: -100,
			w: 120,
			h: 80,
			height: 90,
			color: 0x1c2640,
			neon: 0xffd900,
		},
		{
			x: -1620,
			y: 100,
			w: 120,
			h: 90,
			height: 100,
			color: 0x21304a,
			neon: 0xff3399,
		},
	],

	// Park/lake in the empty interior of the loop — the kidney-bean shape
	// leaves a big middle area that no track passes through.
	lake: { cx: 100, cy: 0, rx: 300, ry: 180 },
};
