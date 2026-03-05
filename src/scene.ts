import * as THREE from "three";

export interface SceneContext {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
}

export function createScene(): SceneContext {
	const scene = new THREE.Scene();

	// Camera: positioned to see ~12 units wide (6 letters with spacing)
	const camera = new THREE.PerspectiveCamera(
		50,
		window.innerWidth / window.innerHeight,
		0.1,
		100,
	);
	camera.position.set(0, 0, 12);

	// Renderer: full viewport, transparent background
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	document.body.appendChild(renderer.domElement);

	// Lighting
	const ambient = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambient);

	const directional = new THREE.DirectionalLight(0xffffff, 0.8);
	directional.position.set(5, 5, 10);
	scene.add(directional);

	// Resize handler
	window.addEventListener("resize", () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	return { scene, camera, renderer };
}
