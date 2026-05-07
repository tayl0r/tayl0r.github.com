import {
	AmbientLight,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";

const scene = new Scene();
scene.fog = new FogExp2(0x050a08, 0.05);

const camera = new PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	500,
);
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -1);
scene.add(camera);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050a08);
document.body.appendChild(renderer.domElement);

const ground = new Mesh(
	new PlaneGeometry(220, 220),
	new MeshStandardMaterial({ color: 0x0a1408 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

scene.add(new AmbientLight(0xffffff, 0.08));
scene.add(new HemisphereLight(0x0a0a14, 0x020402, 0.05));

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
