import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	CatmullRomCurve3,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Vector3,
} from "three";
import type { Waypoint } from "../types";

export type TrackSample = { x: number; z: number; width: number; tag?: string };

export type TrackMeshes = {
	root: Group;
	road: Mesh;
	sampled: TrackSample[];
	buildings: Mesh[];
	startInfo: {
		pos: { x: number; z: number };
		dir: { x: number; z: number };
		rightNormal: { x: number; z: number };
		halfWidth: number;
	};
};

function buildCheckerStrip(
	startPos: { x: number; z: number },
	dir: { x: number; z: number },
	halfWidth: number,
	depth: number,
): Mesh {
	const squareSize = 0.6;
	const squaresAcross = Math.floor((halfWidth * 2) / squareSize);
	const rows = Math.max(1, Math.floor(depth / squareSize));
	const positions: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];
	const nx = -dir.z;
	const nz = dir.x;
	let v = 0;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < squaresAcross; c++) {
			const white = (r + c) % 2 === 0;
			const col = white ? 1 : 0.04;
			const u0 = c * squareSize - halfWidth;
			const u1 = u0 + squareSize;
			const t0 = r * squareSize - depth / 2;
			const t1 = t0 + squareSize;
			for (const [u, t] of [
				[u0, t0],
				[u1, t0],
				[u1, t1],
				[u0, t1],
			] as const) {
				const x = startPos.x + nx * u + dir.x * t;
				const z = startPos.z + nz * u + dir.z * t;
				positions.push(x, 0.015, z);
				colors.push(col, col, col);
			}
			indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
			v += 4;
		}
	}
	const geo = new BufferGeometry();
	geo.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(positions), 3),
	);
	geo.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return new Mesh(
		geo,
		new MeshStandardMaterial({
			vertexColors: true,
			roughness: 0.9,
			side: DoubleSide,
		}),
	);
}

function buildLineStrip(
	samples: { x: number; z: number }[],
	_sampled: TrackSample[],
	centerOffset: number,
	lineWidth: number,
	color: number,
	dashed: boolean,
): Mesh {
	const positions: number[] = [];
	const indices: number[] = [];
	let vertIdx = 0;
	const n = samples.length;
	for (let i = 0; i < n; i++) {
		const dashOn = !dashed || Math.floor(i / 4) % 2 === 0;
		const curr = samples[i];
		const next = samples[(i + 1) % n];
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const bx = curr.x + nx * centerOffset;
		const bz = curr.z + nz * centerOffset;
		positions.push(bx + nx * (lineWidth / 2), 0.02, bz + nz * (lineWidth / 2));
		positions.push(bx - nx * (lineWidth / 2), 0.02, bz - nz * (lineWidth / 2));
		if (i < n - 1 && dashOn) {
			const a = vertIdx;
			const b = vertIdx + 1;
			const c = vertIdx + 2;
			const d = vertIdx + 3;
			indices.push(a, c, b, b, c, d);
		}
		vertIdx += 2;
	}
	const geo = new BufferGeometry();
	geo.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(positions), 3),
	);
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return new Mesh(
		geo,
		new MeshStandardMaterial({
			color,
			roughness: 0.7,
			side: DoubleSide,
		}),
	);
}

export function buildRoad(waypoints: Waypoint[]): TrackMeshes {
	const pts = waypoints.map((w) => new Vector3(w.pos.x, 0, w.pos.z));
	const curve = new CatmullRomCurve3(pts, true, "catmullrom", 0.3);
	const samples = curve.getPoints(200);

	const sampled: TrackSample[] = samples.map((p) => {
		let nearest = waypoints[0];
		let best = Number.POSITIVE_INFINITY;
		for (const w of waypoints) {
			const d = Math.hypot(p.x - w.pos.x, p.z - w.pos.z);
			if (d < best) {
				best = d;
				nearest = w;
			}
		}
		return { x: p.x, z: p.z, width: nearest.width, tag: nearest.tag };
	});

	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	for (let i = 0; i < samples.length; i++) {
		const curr = samples[i];
		const next = samples[(i + 1) % samples.length];
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const halfW = sampled[i].width / 2;
		positions.push(curr.x + nx * halfW, 0.01, curr.z + nz * halfW);
		positions.push(curr.x - nx * halfW, 0.01, curr.z - nz * halfW);
		uvs.push(0, i / 4);
		uvs.push(1, i / 4);
	}

	const n = samples.length;
	for (let i = 0; i < n; i++) {
		const a = i * 2;
		const b = i * 2 + 1;
		const c = ((i + 1) % n) * 2;
		const d = ((i + 1) % n) * 2 + 1;
		indices.push(a, c, b, b, c, d);
	}

	const roadGeo = new BufferGeometry();
	roadGeo.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(positions), 3),
	);
	roadGeo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
	roadGeo.setIndex(indices);
	roadGeo.computeVertexNormals();

	const roadMat = new MeshStandardMaterial({
		color: 0x3a3a3e,
		roughness: 0.9,
		metalness: 0.05,
		side: DoubleSide,
	});
	const road = new Mesh(roadGeo, roadMat);

	const root = new Group();

	const ground = new Mesh(
		new PlaneGeometry(800, 800),
		new MeshStandardMaterial({ color: 0x1a1c20, roughness: 1 }),
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -0.01;
	root.add(ground);
	root.add(road);

	const centerline = buildLineStrip(samples, sampled, 0, 0.3, 0xe8c200, true);
	root.add(centerline);
	const avgHalfW = sampled[0].width / 2;
	const leftEdge = buildLineStrip(
		samples,
		sampled,
		avgHalfW - 0.4,
		0.25,
		0xe8e8e8,
		false,
	);
	const rightEdge = buildLineStrip(
		samples,
		sampled,
		-(avgHalfW - 0.4),
		0.25,
		0xe8e8e8,
		false,
	);
	root.add(leftEdge);
	root.add(rightEdge);

	const startA = waypoints[0].pos;
	const startB = waypoints[1].pos;
	const ddx = startB.x - startA.x;
	const ddz = startB.z - startA.z;
	const dlen = Math.hypot(ddx, ddz) || 1;
	const startDir = { x: ddx / dlen, z: ddz / dlen };
	const checker = buildCheckerStrip(
		startA,
		startDir,
		waypoints[0].width / 2,
		1.5,
	);
	root.add(checker);

	const wallMat = new MeshStandardMaterial({
		color: 0xb0b0b0,
		roughness: 0.8,
		metalness: 0.1,
	});
	for (let i = 0; i < sampled.length; i++) {
		if (sampled[i].tag === "shibuya") continue;
		const curr = sampled[i];
		const next = sampled[(i + 1) % sampled.length];
		if (next.tag === "shibuya") continue;
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const halfW = curr.width / 2 + 0.4;
		for (const side of [1, -1]) {
			// Long axis of the box is Z so that after lookAt (which orients
			// local -Z toward the target), the wall extends along the track.
			const wall = new Mesh(new BoxGeometry(0.4, 1.2, len + 0.6), wallMat);
			wall.position.set(
				curr.x + nx * halfW * side + tx / 2,
				0.6,
				curr.z + nz * halfW * side + tz / 2,
			);
			wall.lookAt(wall.position.x + tx, 0.6, wall.position.z + tz);
			root.add(wall);
		}
	}

	const buildingColors = [0x8a8a90, 0xa09888, 0x6a6a78, 0x7a6a5a];
	const buildings: Mesh[] = [];

	const distToTrack = (px: number, pz: number): number => {
		let best = Number.POSITIVE_INFINITY;
		for (let i = 0; i < sampled.length; i++) {
			const a = sampled[i];
			const b = sampled[(i + 1) % sampled.length];
			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const lenSq = dx * dx + dz * dz || 1;
			let t = ((px - a.x) * dx + (pz - a.z) * dz) / lenSq;
			t = Math.max(0, Math.min(1, t));
			const cx = a.x + dx * t;
			const cz = a.z + dz * t;
			const d = Math.hypot(px - cx, pz - cz) - a.width / 2;
			if (d < best) best = d;
		}
		return best;
	};

	const BUILDING_COUNT = 50;
	for (let i = 0; i < BUILDING_COUNT; i++) {
		const idx = Math.floor((i / BUILDING_COUNT) * sampled.length);
		const s = sampled[idx];
		const next = sampled[(idx + 1) % sampled.length];
		const tx = next.x - s.x;
		const tz = next.z - s.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const side = Math.random() < 0.5 ? 1 : -1;
		const h = 6 + Math.random() * 18;
		const bw = 3 + Math.random() * 4;

		let placed = false;
		for (const attempt of [6 + Math.random() * 10, 10 + Math.random() * 8]) {
			const offset = s.width / 2 + attempt;
			const bx = s.x + nx * offset * side;
			const bz = s.z + nz * offset * side;
			const buildingRadius = (bw * Math.SQRT2) / 2;
			if (distToTrack(bx, bz) - buildingRadius > 2) {
				const mat = new MeshStandardMaterial({
					color: buildingColors[i % buildingColors.length],
					roughness: 0.85,
					metalness: 0.1,
				});
				const b = new Mesh(new BoxGeometry(bw, h, bw), mat);
				b.position.set(bx, h / 2, bz);
				root.add(b);
				buildings.push(b);
				placed = true;
				break;
			}
		}
		if (!placed) continue;
	}

	return {
		root,
		road,
		sampled,
		buildings,
		startInfo: {
			pos: startA,
			dir: startDir,
			rightNormal: { x: startDir.z, z: -startDir.x },
			halfWidth: waypoints[0].width / 2,
		},
	};
}
