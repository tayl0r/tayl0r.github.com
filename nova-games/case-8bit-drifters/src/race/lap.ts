const HALFWAY_DIST = 60;

export type LapLine = {
	ax: number;
	ay: number;
	tx: number;
	ty: number;
};

export class LapTracker {
	private line: LapLine;
	private prevDot: number | null = null;
	private halfwayReached = false;

	constructor(line: LapLine) {
		this.line = line;
	}

	/** Returns true when a lap was just completed. */
	update(pos: { x: number; y: number }, distFromStart: number): boolean {
		const dot =
			(pos.x - this.line.ax) * this.line.tx +
			(pos.y - this.line.ay) * this.line.ty;
		if (distFromStart > HALFWAY_DIST) this.halfwayReached = true;

		let crossed = false;
		if (
			this.prevDot !== null &&
			this.prevDot < 0 &&
			dot >= 0 &&
			this.halfwayReached
		) {
			crossed = true;
			this.halfwayReached = false;
		}
		this.prevDot = dot;
		return crossed;
	}

	reset(): void {
		this.prevDot = null;
		this.halfwayReached = false;
	}
}
