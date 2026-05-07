import {
	AmbientLight,
	BoxGeometry,
	Clock,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";

const scene = new Scene();
const camera = new PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	1000,
);
camera.position.set(0, 4, 8);
camera.lookAt(0, 0, 0);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a3a1a);
document.body.appendChild(renderer.domElement);

const floor = new Mesh(
	new PlaneGeometry(40, 40),
	new MeshStandardMaterial({ color: 0x2d5a2d }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const cube = new Mesh(
	new BoxGeometry(2, 2, 2),
	new MeshStandardMaterial({ color: 0x88cc44 }),
);
cube.position.y = 1;
scene.add(cube);

scene.add(new AmbientLight(0xffffff, 0.5));
const sun = new DirectionalLight(0xffffff, 0.8);
sun.position.set(5, 10, 5);
scene.add(sun);

const clock = new Clock();

function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	cube.rotation.y += dt * 0.8;
	cube.rotation.x += dt * 0.4;
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
