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
};

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

	const buildingMat = new MeshStandardMaterial({
		color: 0x1a0a3a,
		emissive: 0x4020c0,
		emissiveIntensity: 0.25,
		metalness: 0.6,
		roughness: 0.4,
	});
	for (let i = 0; i < 40; i++) {
		const idx = Math.floor((i / 40) * sampled.length);
		const s = sampled[idx];
		const next = sampled[(idx + 1) % sampled.length];
		const tx = next.x - s.x;
		const tz = next.z - s.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const offset = s.width / 2 + 4 + Math.random() * 8;
		const h = 6 + Math.random() * 18;
		const bw = 3 + Math.random() * 4;
		const b = new Mesh(new BoxGeometry(bw, h, bw), buildingMat);
		b.position.set(s.x + nx * offset, h / 2, s.z + nz * offset);
		root.add(b);
	}

	return { root, road, sampled };
}
