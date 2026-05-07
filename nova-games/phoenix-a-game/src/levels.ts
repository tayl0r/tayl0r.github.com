export interface LevelConfig {
	name: string;
	hallwayEdges: ReadonlyArray<readonly [number, number]>;
	spawn: number;
	boss: number;
	goblinRooms: readonly number[];
	ogreRooms: readonly number[];
	switchRooms: readonly number[];
	chestRooms: readonly number[];
}

const LEVEL_1: LevelConfig = {
	name: "Catacombs",
	hallwayEdges: [
		[0, 1],
		[1, 2],
		[1, 4],
		[3, 6],
		[4, 5],
		[5, 8],
		[6, 7],
		[6, 9],
		[7, 10],
		[8, 11],
		[9, 12],
		[10, 13],
		[11, 14],
		[12, 15],
		[13, 14],
		[13, 16],
		[14, 17],
		[15, 16],
		[16, 17],
	],
	spawn: 1,
	boss: 16,
	goblinRooms: [4, 5, 7, 8, 10, 11, 13, 14],
	ogreRooms: [6, 9, 12, 15],
	switchRooms: [0, 2, 3, 6, 9, 12, 15, 17],
	chestRooms: [0, 2, 3, 5, 8, 11, 14, 17],
};

const LEVEL_2: LevelConfig = {
	name: "Serpent's Coil",
	hallwayEdges: [
		[0, 1],
		[1, 2],
		[2, 5],
		[3, 4],
		[4, 5],
		[3, 6],
		[6, 7],
		[7, 8],
		[8, 11],
		[9, 10],
		[10, 11],
		[9, 12],
		[12, 13],
		[13, 14],
		[14, 17],
		[15, 16],
		[16, 17],
		[1, 4],
		[7, 10],
		[13, 16],
	],
	spawn: 0,
	boss: 15,
	goblinRooms: [1, 2, 4, 5, 7, 8, 10, 11, 13, 14],
	ogreRooms: [3, 6, 9, 12],
	switchRooms: [2, 5, 8, 11, 14, 17],
	chestRooms: [3, 6, 9, 12, 16, 17],
};

const LEVEL_3: LevelConfig = {
	name: "Spiral Sanctum",
	hallwayEdges: [
		[0, 1],
		[1, 2],
		[2, 5],
		[5, 8],
		[8, 11],
		[11, 14],
		[14, 17],
		[16, 17],
		[15, 16],
		[12, 15],
		[9, 12],
		[6, 9],
		[3, 6],
		[3, 4],
		[4, 7],
		[7, 10],
		[10, 13],
	],
	spawn: 0,
	boss: 13,
	goblinRooms: [2, 5, 8, 11, 14, 17, 4, 7],
	ogreRooms: [9, 12, 15, 16, 10],
	switchRooms: [2, 5, 8, 11, 14, 17, 16, 15, 4, 6],
	chestRooms: [3, 6, 9, 12, 11, 15, 17],
};

export const LEVELS: readonly LevelConfig[] = [LEVEL_1, LEVEL_2, LEVEL_3];
