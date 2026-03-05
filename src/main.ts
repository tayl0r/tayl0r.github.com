import { updateLetters } from "./animations";
import { createLetters, type LetterMesh } from "./letters";
import { createScene } from "./scene";

const { scene, camera, renderer } = createScene();

let letters: LetterMesh[] = [];

async function init() {
	letters = await createLetters(scene);
	animate();
}

function animate() {
	requestAnimationFrame(animate);

	const timeSec = performance.now() / 1000;
	updateLetters(letters, timeSec);

	renderer.render(scene, camera);
}

init();
