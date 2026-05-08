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
	SpotLight,
	WebGLRenderer,
} from "three";
import { buildForest } from "./forest";
import { createMonster } from "./monster";
import {
	attachPlayerInput,
	createPlayer,
	resetPlayer,
	setInputActive,
	updatePlayer,
} from "./player";
import { createUI } from "./ui";

type GameState = "title" | "playing" | "win";

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

const flashlight = new SpotLight(
	0xfff2cc,
	3,
	25,
	(25 / 180) * Math.PI,
	0.4,
	1.5,
);
flashlight.position.set(0, -0.3, 0);
flashlight.target.position.set(0, -0.3, -1);
camera.add(flashlight);
camera.add(flashlight.target);

const forest = buildForest(scene);
const player = createPlayer();
attachPlayerInput(renderer.domElement, player);
const ui = createUI();
const monster = createMonster();
scene.add(monster.root);

let state: GameState = "title";

function enterTitle() {
	state = "title";
	setInputActive(false);
	if (document.pointerLockElement) document.exitPointerLock();
	ui.hideWin();
	ui.setStaminaVisible(false);
	ui.setResumeHintVisible(false);
	ui.showTitle(() => {
		enterPlaying();
	});
}

function enterPlaying() {
	state = "playing";
	resetPlayer(player);
	ui.hideTitle();
	ui.setStaminaVisible(true);
	ui.setResumeHintVisible(false);
	setInputActive(true);
	renderer.domElement.requestPointerLock();
}

function enterWin() {
	state = "win";
	setInputActive(false);
	if (document.pointerLockElement) document.exitPointerLock();
	ui.setStaminaVisible(false);
	ui.setResumeHintVisible(false);
	ui.showWin(() => {
		enterTitle();
	});
}

document.addEventListener("pointerlockchange", () => {
	if (state !== "playing") return;
	ui.setResumeHintVisible(document.pointerLockElement !== renderer.domElement);
});

enterTitle();

const clock = new Clock();
function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	updatePlayer(player, camera, dt, forest);
	if (state === "playing") {
		ui.setStamina(player.stamina, 100);
		const dx = player.position.x - forest.flagPosition.x;
		const dz = player.position.z - forest.flagPosition.z;
		if (Math.hypot(dx, dz) < 1.5) {
			enterWin();
		}
	}
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
