let ctx: AudioContext | null = null;
let outerGain: GainNode | null = null;

function makeBrownNoiseBuffer(
	audio: AudioContext,
	seconds: number,
): AudioBuffer {
	const length = Math.floor(seconds * audio.sampleRate);
	const buffer = audio.createBuffer(1, length, audio.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < length; i++) {
		const white = Math.random() * 2 - 1;
		last = (last + 0.02 * white) / 1.02;
		data[i] = last * 3.5;
	}
	return buffer;
}

export function startBreathing(): void {
	if (ctx) return;
	const audio = new AudioContext();
	ctx = audio;

	const noise = audio.createBufferSource();
	noise.buffer = makeBrownNoiseBuffer(audio, 2);
	noise.loop = true;

	const lowpass = audio.createBiquadFilter();
	lowpass.type = "lowpass";
	lowpass.frequency.value = 600;
	lowpass.Q.value = 1;

	const breathMod = audio.createGain();
	breathMod.gain.value = 0.5;

	const lfo = audio.createOscillator();
	lfo.type = "sine";
	lfo.frequency.value = 0.33;

	const lfoGain = audio.createGain();
	lfoGain.gain.value = 0.5;

	const master = audio.createGain();
	master.gain.value = 0;
	outerGain = master;

	noise.connect(lowpass);
	lowpass.connect(breathMod);
	breathMod.connect(master);
	master.connect(audio.destination);

	lfo.connect(lfoGain);
	lfoGain.connect(breathMod.gain);

	noise.start();
	lfo.start();
}

export function setBreathingGain(gain01: number): void {
	if (!ctx || !outerGain) return;
	const clamped = Math.max(0, Math.min(1, gain01));
	outerGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.05);
}

export function playScream(): void {
	if (!ctx) return;
	const audio = ctx;
	const now = audio.currentTime;

	const osc1 = audio.createOscillator();
	osc1.type = "sawtooth";
	osc1.frequency.setValueAtTime(150, now);
	osc1.frequency.exponentialRampToValueAtTime(70, now + 1.0);

	const osc2 = audio.createOscillator();
	osc2.type = "square";
	osc2.frequency.setValueAtTime(170, now);
	osc2.frequency.exponentialRampToValueAtTime(80, now + 1.0);

	const filter = audio.createBiquadFilter();
	filter.type = "bandpass";
	filter.Q.value = 2;
	filter.frequency.setValueAtTime(1500, now);
	filter.frequency.linearRampToValueAtTime(400, now + 1.0);

	const env = audio.createGain();
	env.gain.setValueAtTime(0, now);
	env.gain.linearRampToValueAtTime(0.8, now + 0.05);
	env.gain.linearRampToValueAtTime(0, now + 1.2);

	osc1.connect(filter);
	osc2.connect(filter);
	filter.connect(env);
	env.connect(audio.destination);

	osc1.start(now);
	osc2.start(now);
	osc1.stop(now + 1.3);
	osc2.stop(now + 1.3);
}

export function stopAll(): void {
	if (!ctx || !outerGain) return;
	outerGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}
