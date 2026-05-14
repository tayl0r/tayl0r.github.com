// Catalog of player-selectable cars. Sprites are sliced from three 192×128
// spritesheets in /public/cars/. Each sheet is a 3×2 grid of 64×64 cells, but
// the actual car silhouette inside each cell only occupies a tight bbox
// (measured per sheet via ImageMagick `-trim`). We use those bboxes as Pixi
// texture frames so the resulting Sprite is exactly the car with no padding,
// rotates cleanly around its center, and has a sensible bounding box for
// scaling to a target world-length.
//
// Cars face -Y (UP) in the source images. The sprite consumer is responsible
// for adding a +π/2 rotation offset so facing=0 in the game (which means +X)
// renders the car heading east.

export type CarDef = {
	id: string;
	name: string;
	sheet: string; // path under /public, served at base URL
	frame: { x: number; y: number; w: number; h: number };
};

type SheetSpec = {
	id: string;
	label: string;
	sheet: string;
	bbox: { x: number; y: number; w: number; h: number }; // within each 64x64 cell
};

const SHEETS: SheetSpec[] = [
	{
		id: "mk1",
		label: "Mark I",
		sheet: "cars/mark-1.png",
		bbox: { x: 18, y: 4, w: 28, h: 55 },
	},
	{
		id: "mk2",
		label: "Mark II",
		sheet: "cars/mark-2.png",
		bbox: { x: 21, y: 2, w: 22, h: 58 },
	},
	{
		id: "mk3",
		label: "Mark III",
		sheet: "cars/mark-3.png",
		bbox: { x: 19, y: 11, w: 26, h: 47 },
	},
];

const CELL = 64;
const COLS = 3;
const ROWS = 2;

function build(): CarDef[] {
	const out: CarDef[] = [];
	for (const s of SHEETS) {
		let n = 1;
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				out.push({
					id: `${s.id}-${n}`,
					name: `${s.label} #${n}`,
					sheet: s.sheet,
					frame: {
						x: col * CELL + s.bbox.x,
						y: row * CELL + s.bbox.y,
						w: s.bbox.w,
						h: s.bbox.h,
					},
				});
				n++;
			}
		}
	}
	return out;
}

export const CARS: readonly CarDef[] = build();
export const DEFAULT_CAR_ID = "mk1-1";

export function getCar(id: string | null | undefined): CarDef {
	const found = CARS.find((c) => c.id === id);
	return found ?? CARS.find((c) => c.id === DEFAULT_CAR_ID) ?? CARS[0];
}

/** Distinct sheet URLs — useful for preloading. */
export const SHEET_URLS: readonly string[] = SHEETS.map((s) => s.sheet);
