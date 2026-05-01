export type Knob = {
	label: string;
	min: number;
	max: number;
	step: number;
	get(): number;
	set(v: number): void;
	defaultValue: number;
};

export type KnobGroup = { title: string; knobs: Knob[] };

export type TuningPanel = {
	dispose(): void;
};

type RowControls = { slider: HTMLInputElement; valSpan: HTMLSpanElement };

export function createTuningPanel(
	groups: KnobGroup[],
	onAnyChange: () => void,
	onResetAll: () => void,
): TuningPanel {
	const panel = document.createElement("div");
	panel.id = "tuning-panel";
	Object.assign(panel.style, {
		position: "fixed",
		top: "16px",
		right: "16px",
		width: "280px",
		background: "rgba(10, 10, 20, 0.94)",
		border: "2px solid #00d2ff",
		padding: "12px",
		color: "white",
		fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
		fontSize: "11px",
		zIndex: "100",
		display: "block",
		maxHeight: "calc(100vh - 32px)",
		overflowY: "auto",
		boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
		userSelect: "none",
	} satisfies Partial<CSSStyleDeclaration>);

	const title = document.createElement("div");
	title.textContent = "TUNING — press T to toggle";
	Object.assign(title.style, {
		fontWeight: "bold",
		marginBottom: "8px",
		color: "#00d2ff",
		fontSize: "12px",
	} satisfies Partial<CSSStyleDeclaration>);
	panel.appendChild(title);

	const rowsByKnob = new Map<Knob, RowControls>();
	const fmt = (knob: Knob, v: number): string =>
		v.toFixed(knob.step >= 1 ? 0 : knob.step >= 0.1 ? 1 : 2);

	function syncKnob(knob: Knob): void {
		const r = rowsByKnob.get(knob);
		if (!r) return;
		const v = knob.get();
		r.slider.value = v.toString();
		r.valSpan.textContent = fmt(knob, v);
	}

	for (const group of groups) {
		const header = document.createElement("div");
		header.textContent = group.title;
		Object.assign(header.style, {
			marginTop: "10px",
			marginBottom: "4px",
			color: "#7b8fad",
			fontSize: "10px",
			letterSpacing: "1px",
		} satisfies Partial<CSSStyleDeclaration>);
		panel.appendChild(header);

		for (const knob of group.knobs) {
			const row = document.createElement("div");
			Object.assign(row.style, {
				marginBottom: "8px",
			} satisfies Partial<CSSStyleDeclaration>);

			const labelLine = document.createElement("div");
			Object.assign(labelLine.style, {
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				gap: "4px",
			} satisfies Partial<CSSStyleDeclaration>);
			const labelSpan = document.createElement("span");
			labelSpan.textContent = knob.label;
			Object.assign(labelSpan.style, {
				flex: "1",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			} satisfies Partial<CSSStyleDeclaration>);
			const valSpan = document.createElement("span");
			valSpan.textContent = fmt(knob, knob.get());
			Object.assign(valSpan.style, {
				color: "#00d2ff",
				minWidth: "40px",
				textAlign: "right",
			} satisfies Partial<CSSStyleDeclaration>);
			const resetBtn = document.createElement("button");
			resetBtn.textContent = "↺";
			resetBtn.title = `Reset to ${fmt(knob, knob.defaultValue)}`;
			Object.assign(resetBtn.style, {
				background: "transparent",
				border: "1px solid #444a55",
				color: "#7b8fad",
				width: "20px",
				height: "20px",
				lineHeight: "1",
				padding: "0",
				cursor: "pointer",
				fontSize: "12px",
				borderRadius: "3px",
			} satisfies Partial<CSSStyleDeclaration>);
			resetBtn.addEventListener("click", () => {
				knob.set(knob.defaultValue);
				syncKnob(knob);
				onAnyChange();
			});
			labelLine.appendChild(labelSpan);
			labelLine.appendChild(valSpan);
			labelLine.appendChild(resetBtn);

			const slider = document.createElement("input");
			slider.type = "range";
			slider.min = knob.min.toString();
			slider.max = knob.max.toString();
			slider.step = knob.step.toString();
			slider.value = knob.get().toString();
			slider.style.width = "100%";
			slider.style.marginTop = "2px";
			slider.addEventListener("input", () => {
				const v = Number.parseFloat(slider.value);
				knob.set(v);
				valSpan.textContent = fmt(knob, v);
				onAnyChange();
			});

			row.appendChild(labelLine);
			row.appendChild(slider);
			panel.appendChild(row);
			rowsByKnob.set(knob, { slider, valSpan });
		}
	}

	const resetAllBtn = document.createElement("button");
	resetAllBtn.textContent = "RESET ALL TO DEFAULT";
	Object.assign(resetAllBtn.style, {
		marginTop: "12px",
		width: "100%",
		padding: "8px",
		background: "rgba(255,85,119,0.18)",
		border: "1px solid #ff5577",
		color: "#ff5577",
		fontFamily: "inherit",
		fontSize: "11px",
		fontWeight: "bold",
		cursor: "pointer",
		borderRadius: "3px",
	} satisfies Partial<CSSStyleDeclaration>);
	resetAllBtn.addEventListener("click", () => {
		onResetAll();
		for (const group of groups) for (const k of group.knobs) syncKnob(k);
	});
	panel.appendChild(resetAllBtn);

	document.body.appendChild(panel);

	let visible = true;
	const onKey = (e: KeyboardEvent): void => {
		if (e.key.toLowerCase() === "t" && !e.repeat) {
			visible = !visible;
			panel.style.display = visible ? "block" : "none";
		}
	};
	window.addEventListener("keydown", onKey);

	return {
		dispose() {
			window.removeEventListener("keydown", onKey);
			panel.remove();
		},
	};
}
