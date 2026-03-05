import * as THREE from "three";
import type { LetterMesh } from "./letters";

const ANIM_DURATION = 10; // seconds of animation
const PAUSE_DURATION = 1; // seconds of pause
const CYCLE_DURATION = ANIM_DURATION + PAUSE_DURATION;

const INITIAL_COLOR = new THREE.Color(0xff8c00);

const TARGET_PALETTE = [
	0x1a5fb4, // deep blue
	0x9141ac, // purple
	0xe01b24, // red
	0x2ec27e, // green
	0x1c71d8, // bright blue
	0xf5c211, // yellow
	0xe66100, // burnt orange
	0x26a269, // teal
	0xc061cb, // pink
	0x33d17a, // lime
];

interface Offset {
	x: number;
	y: number;
	z: number;
}

type MotionFn = (t: number) => Offset;

function sineWave(t: number): Offset {
	return { x: 0, y: Math.sin(t) * 1.6, z: 0 };
}

function circularOrbit(t: number): Offset {
	return { x: Math.cos(t) * 1.2, y: Math.sin(t) * 1.2, z: 0 };
}

function parabolicArc(t: number): Offset {
	const y = (1 - Math.cos(t)) / 2;
	return { x: 0, y: y * 2.4, z: 0 };
}

function figure8(t: number): Offset {
	return {
		x: Math.sin(t) * 1.4,
		y: 0,
		z: Math.sin(t * 2) * 0.8,
	};
}

function ellipticalOrbit(t: number): Offset {
	return {
		x: 0,
		y: Math.sin(t) * 1.0,
		z: Math.cos(t) * 1.6,
	};
}

function pendulumSwing(t: number): Offset {
	return {
		x: Math.sin(t) * 1.4,
		y: (1 - Math.cos(t)) * 0.6,
		z: 0,
	};
}

const MOTION_FUNCTIONS: MotionFn[] = [
	sineWave,
	circularOrbit,
	parabolicArc,
	figure8,
	ellipticalOrbit,
	pendulumSwing,
];

interface RotationTarget {
	x: number;
	y: number;
	z: number;
}

const MAX_ROTATION = Math.PI * 0.5; // up to 90 degrees

function randomRotationTarget(): RotationTarget {
	return {
		x: (Math.random() - 0.5) * 2 * MAX_ROTATION,
		y: (Math.random() - 0.5) * 2 * MAX_ROTATION,
		z: (Math.random() - 0.5) * 2 * MAX_ROTATION,
	};
}

interface CycleState {
	motionIndices: number[];
	rotationTargets: RotationTarget[];
	zOffsets: number[];
	cycleColor: THREE.Color;
	letterColors: THREE.Color[];
	nextCycleColor: THREE.Color;
	startPositions: THREE.Vector3[];
	endPositions: THREE.Vector3[];
}

let cycleState: CycleState | null = null;
let cycleStartTime = 0;
let currentCycleColor: THREE.Color = INITIAL_COLOR.clone();

function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickUniqueColors(count: number): THREE.Color[] {
	const available = [...TARGET_PALETTE];
	const colors: THREE.Color[] = [];
	for (let i = 0; i < count; i++) {
		if (available.length === 0) {
			colors.push(new THREE.Color(pickRandom(TARGET_PALETTE)));
		} else {
			const idx = Math.floor(Math.random() * available.length);
			colors.push(new THREE.Color(available[idx]));
			available.splice(idx, 1);
		}
	}
	return colors;
}

const MAX_Z_OFFSET = 4; // moves letters from Z=0 towards camera at Z=12, ~50% larger at max

function computeSwappedPositions(letters: LetterMesh[]): THREE.Vector3[] {
	// Collect the unique Y values per row
	const rowYs = new Map<number, number>();
	for (const letter of letters) {
		if (!rowYs.has(letter.row)) {
			rowYs.set(letter.row, letter.homePosition.y);
		}
	}
	const y0 = rowYs.get(0) ?? 0;
	const y1 = rowYs.get(1) ?? 0;

	return letters.map((letter) => {
		const swappedY = letter.row === 0 ? y1 : y0;
		return new THREE.Vector3(
			letter.homePosition.x,
			swappedY,
			letter.homePosition.z,
		);
	});
}

function newCycleState(
	letters: LetterMesh[],
	cycleColor: THREE.Color,
): CycleState {
	const motionIndices: number[] = [];
	const rotationTargets: RotationTarget[] = [];
	const zOffsets: number[] = [];
	for (let i = 0; i < letters.length; i++) {
		motionIndices.push(Math.floor(Math.random() * MOTION_FUNCTIONS.length));
		rotationTargets.push(randomRotationTarget());
		zOffsets.push(Math.random() * MAX_Z_OFFSET);
	}

	const startPositions = letters.map((l) => l.homePosition.clone());
	const endPositions = computeSwappedPositions(letters);

	return {
		motionIndices,
		rotationTargets,
		zOffsets,
		cycleColor: cycleColor.clone(),
		letterColors: pickUniqueColors(letters.length),
		nextCycleColor: new THREE.Color(pickRandom(TARGET_PALETTE)),
		startPositions,
		endPositions,
	};
}

const HALF_ANIM = ANIM_DURATION / 2;

function applySwap(letters: LetterMesh[], state: CycleState): void {
	for (let i = 0; i < letters.length; i++) {
		letters[i].homePosition.copy(state.endPositions[i]);
	}
	for (const letter of letters) {
		letter.row = letter.row === 0 ? 1 : 0;
	}
}

export function updateLetters(letters: LetterMesh[], timeSec: number): void {
	if (cycleState === null) {
		cycleState = newCycleState(letters, currentCycleColor);
		// First cycle: override nextCycleColor to orange so the pause shows orange
		cycleState.nextCycleColor = INITIAL_COLOR.clone();
		// First cycle: no swap, start and end are the same
		for (let i = 0; i < letters.length; i++) {
			cycleState.endPositions[i].copy(cycleState.startPositions[i]);
		}
		// Start in the pause phase
		cycleStartTime = timeSec - ANIM_DURATION;
	}

	const elapsed = timeSec - cycleStartTime;

	// Check if we need a new cycle
	if (elapsed >= CYCLE_DURATION) {
		applySwap(letters, cycleState);
		currentCycleColor = cycleState.nextCycleColor.clone();
		cycleState = newCycleState(letters, currentCycleColor);
		cycleStartTime = timeSec;
		updateLetters(letters, timeSec);
		return;
	}

	const animating = elapsed < ANIM_DURATION;

	for (let i = 0; i < letters.length; i++) {
		const letter = letters[i];

		if (animating) {
			// Linear progress 0→1 for the position swap
			const swapT = elapsed / ANIM_DURATION;
			// Sine envelope for chaotic motion: peaks in the middle
			const envelope = Math.sin(swapT * Math.PI);

			// Base position: lerp from start to end (the row swap)
			const start = cycleState.startPositions[i];
			const end = cycleState.endPositions[i];
			const baseX = start.x + (end.x - start.x) * swapT;
			const baseY = start.y + (end.y - start.y) * swapT;
			const baseZ = start.z + (end.z - start.z) * swapT;

			// Chaotic motion offset
			const motionFn = MOTION_FUNCTIONS[cycleState.motionIndices[i]];
			const normalizedTime = swapT * Math.PI * 2;
			const offset = motionFn(normalizedTime);

			letter.mesh.position.set(
				baseX + offset.x * envelope,
				baseY + offset.y * envelope,
				baseZ + offset.z * envelope + cycleState.zOffsets[i] * envelope,
			);

			// Rotation
			const rot = cycleState.rotationTargets[i];
			letter.mesh.rotation.set(
				rot.x * envelope,
				rot.y * envelope,
				rot.z * envelope,
			);

			// Color: two-phase linear tween
			if (elapsed < HALF_ANIM) {
				const t = elapsed / HALF_ANIM;
				letter.material.color
					.copy(cycleState.cycleColor)
					.lerp(cycleState.letterColors[i], t);
			} else {
				const t = (elapsed - HALF_ANIM) / HALF_ANIM;
				letter.material.color
					.copy(cycleState.letterColors[i])
					.lerp(cycleState.nextCycleColor, t);
			}
		} else {
			// Pause: at end position, no rotation, next cycle color
			letter.mesh.position.copy(cycleState.endPositions[i]);
			letter.mesh.rotation.set(0, 0, 0);
			letter.material.color.copy(cycleState.nextCycleColor);
		}
	}
}
