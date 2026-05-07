import {
	AmbientLight,
	Clock,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";
import { buildForest } from "./forest";
import { attachPlayerInput, createPlayer, updatePlayer } from "./player";

const scene = new Scene();
scene.fog = new FogExp2(0x050a08, 0.05);

const camera = new PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	500,
);
camera.position.set(0, 1.7, 0);
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

const forest = buildForest(scene);
void forest;

const player = createPlayer();
attachPlayerInput(renderer.domElement, player);

const clock = new Clock();
function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	updatePlayer(player, camera, dt);
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
