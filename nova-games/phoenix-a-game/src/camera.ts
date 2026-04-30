import type { Object3D, PerspectiveCamera } from "three";

export interface FollowCamera {
	yaw: number;
	pitch: number;
	update(target: Object3D, mouseDX: number, mouseDY: number): void;
}

const EYE_HEIGHT = 1.8;
const MOUSE_SENSITIVITY = 0.0025;
const PITCH_MIN = -Math.PI / 2 + 0.05;
const PITCH_MAX = Math.PI / 2 - 0.05;

export function createFollowCamera(camera: PerspectiveCamera): FollowCamera {
	camera.rotation.order = "YXZ";
	const state: FollowCamera = {
		yaw: 0,
		pitch: 0,
		update(target, mouseDX, mouseDY) {
			state.yaw -= mouseDX * MOUSE_SENSITIVITY;
			state.pitch = Math.max(
				PITCH_MIN,
				Math.min(PITCH_MAX, state.pitch - mouseDY * MOUSE_SENSITIVITY),
			);
			camera.position.set(
				target.position.x,
				target.position.y + EYE_HEIGHT,
				target.position.z,
			);
			camera.rotation.y = state.yaw;
			camera.rotation.x = state.pitch;
		},
	};
	return state;
}
