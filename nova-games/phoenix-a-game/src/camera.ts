import type { Mesh, PerspectiveCamera } from "three";
import { Vector3 } from "three";

export interface FollowCamera {
	yaw: number;
	pitch: number;
	update(target: Mesh, dt: number, mouseDX: number, mouseDY: number): void;
}

const OFFSET_DISTANCE = 8;
const OFFSET_HEIGHT = 4;
const MOUSE_SENSITIVITY = 0.0025;
const PITCH_MIN = -Math.PI / 3;
const PITCH_MAX = Math.PI / 6;

export function createFollowCamera(camera: PerspectiveCamera): FollowCamera {
	const state: FollowCamera = {
		yaw: 0,
		pitch: -Math.PI / 8,
		update(target, dt, mouseDX, mouseDY) {
			state.yaw -= mouseDX * MOUSE_SENSITIVITY;
			state.pitch = Math.max(
				PITCH_MIN,
				Math.min(PITCH_MAX, state.pitch - mouseDY * MOUSE_SENSITIVITY),
			);
			const horiz = Math.cos(state.pitch) * OFFSET_DISTANCE;
			const offset = new Vector3(
				Math.sin(state.yaw) * horiz,
				OFFSET_HEIGHT - Math.sin(state.pitch) * OFFSET_DISTANCE,
				Math.cos(state.yaw) * horiz,
			);
			camera.position.lerp(
				target.position.clone().add(offset),
				1 - Math.exp(-dt * 10),
			);
			camera.lookAt(
				target.position.x,
				target.position.y + 1,
				target.position.z,
			);
		},
	};
	return state;
}
