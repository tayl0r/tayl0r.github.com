import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import type { Font } from "three/addons/loaders/FontLoader.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";

const LETTERS = ["T", "A", "Y", "L", "O", "R"] as const;

const BASE_COLOR = 0xff8c00; // orange

export interface LetterMesh {
	mesh: THREE.Mesh;
	material: THREE.MeshStandardMaterial;
	homePosition: THREE.Vector3;
	index: number;
}

export async function createLetters(scene: THREE.Scene): Promise<LetterMesh[]> {
	const font = await loadFont();
	const letterMeshes: LetterMesh[] = [];

	// Calculate total width for centering
	const spacing = 2.0;
	const totalWidth = (LETTERS.length - 1) * spacing;
	const startX = -totalWidth / 2;

	for (let i = 0; i < LETTERS.length; i++) {
		const geometry = new TextGeometry(LETTERS[i], {
			font,
			size: 1.5,
			depth: 0.4,
			curveSegments: 12,
			bevelEnabled: true,
			bevelThickness: 0.03,
			bevelSize: 0.02,
			bevelSegments: 5,
		});

		// Center each letter's geometry on its own origin
		geometry.computeBoundingBox();
		if (geometry.boundingBox) {
			const cx =
				(geometry.boundingBox.max.x - geometry.boundingBox.min.x) / 2 +
				geometry.boundingBox.min.x;
			const cy =
				(geometry.boundingBox.max.y - geometry.boundingBox.min.y) / 2 +
				geometry.boundingBox.min.y;
			geometry.translate(-cx, -cy, 0);
		}

		const material = new THREE.MeshStandardMaterial({
			color: BASE_COLOR,
			roughness: 1,
			metalness: 0,
			wireframe: true,
		});

		const mesh = new THREE.Mesh(geometry, material);
		const homePosition = new THREE.Vector3(startX + i * spacing, 0, 0);
		mesh.position.copy(homePosition);

		scene.add(mesh);
		letterMeshes.push({ mesh, material, homePosition: homePosition.clone(), index: i });
	}

	return letterMeshes;
}

function loadFont(): Promise<Font> {
	return new Promise((resolve, reject) => {
		const loader = new FontLoader();
		// Use the helvetiker bold font bundled with three.js examples
		loader.load(
			"https://cdn.jsdelivr.net/npm/three@0.183.2/examples/fonts/helvetiker_bold.typeface.json",
			(font) => resolve(font),
			undefined,
			(err) => reject(err),
		);
	});
}
