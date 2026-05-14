const CONTAINER_STYLE = `
	position: fixed;
	inset: 0;
	display: none;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 24px;
	font-family: Georgia, "Times New Roman", serif;
	color: #d4d4cc;
	pointer-events: auto;
	user-select: none;
`;

const TITLE_BG = `
	background: radial-gradient(circle at 50% 40%, rgba(8, 14, 10, 0.6), rgba(0, 0, 0, 0.95));
`;

const WIN_BG = `
	background: radial-gradient(circle at 50% 40%, rgba(6, 24, 12, 0.6), rgba(0, 0, 0, 0.95));
`;

const BUTTON_STYLE = `
	font: inherit;
	font-size: 22px;
	padding: 12px 32px;
	color: #d4d4cc;
	background: rgba(20, 30, 22, 0.7);
	border: 1px solid #4a6450;
	border-radius: 4px;
	cursor: pointer;
	letter-spacing: 0.05em;
`;

const TITLE_TEXT_STYLE = `
	font-size: 64px;
	letter-spacing: 0.12em;
	text-shadow: 0 0 20px rgba(20, 60, 30, 0.6);
	margin: 0;
	animation: wv-title-shake 0.32s linear infinite;
	transform-origin: center;
	will-change: transform;
`;

const TITLE_KEYFRAMES = `
@keyframes wv-title-shake {
	0%   { transform: translate(0px, 0px) rotate(0deg); }
	10%  { transform: translate(-1px, 1px) rotate(-0.3deg); }
	20%  { transform: translate(1px, -1px) rotate(0.4deg); }
	30%  { transform: translate(-2px, -1px) rotate(-0.2deg); }
	40%  { transform: translate(2px, 0px) rotate(0.3deg); }
	50%  { transform: translate(-2px, 2px) rotate(-0.4deg); }
	60%  { transform: translate(1px, 2px) rotate(0.2deg); }
	70%  { transform: translate(-1px, -2px) rotate(0.4deg); }
	80%  { transform: translate(2px, 1px) rotate(-0.3deg); }
	90%  { transform: translate(-1px, -1px) rotate(0.2deg); }
	100% { transform: translate(0px, 0px) rotate(0deg); }
}
`;

const SUBTITLE_STYLE = `
	font-size: 16px;
	color: #8a8a82;
	margin: 0;
	max-width: 400px;
	text-align: center;
	line-height: 1.5;
`;

const STAMINA_WRAP_STYLE = `
	position: fixed;
	top: 16px;
	left: 16px;
	width: 200px;
	height: 16px;
	background: rgba(0, 0, 0, 0.55);
	border: 1px solid #4a6450;
	border-radius: 3px;
	display: none;
	overflow: hidden;
	font-family: Georgia, "Times New Roman", serif;
`;

const STAMINA_FILL_STYLE = `
	height: 100%;
	width: 100%;
	background: linear-gradient(to right, #6cdc7a, #2a8a3a);
	transition: width 0.05s linear, background 0.2s linear;
`;

const RESUME_HINT_STYLE = `
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	padding: 14px 28px;
	background: rgba(0, 0, 0, 0.7);
	border: 1px solid #4a6450;
	border-radius: 4px;
	color: #d4d4cc;
	font-family: Georgia, "Times New Roman", serif;
	font-size: 18px;
	letter-spacing: 0.05em;
	display: none;
	pointer-events: none;
	user-select: none;
`;

const HIDE_PROMPT_STYLE = `
	position: fixed;
	bottom: 80px;
	left: 50%;
	transform: translateX(-50%);
	padding: 10px 22px;
	background: rgba(0, 0, 0, 0.7);
	border: 1px solid #4a6450;
	border-radius: 4px;
	color: #d4d4cc;
	font-family: Georgia, "Times New Roman", serif;
	font-size: 16px;
	letter-spacing: 0.04em;
	display: none;
	pointer-events: none;
	user-select: none;
`;

const JUMPSCARE_BG_STYLE = `
	position: fixed;
	inset: 0;
	display: none;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.92);
	pointer-events: none;
	z-index: 100;
`;

const JUMPSCARE_FLASH_STYLE = `
	position: absolute;
	inset: 0;
	background: rgba(180, 0, 0, 0);
	transition: background 0.15s linear;
	pointer-events: none;
`;

const SKULL_STYLE = `
	position: relative;
	width: 380px;
	height: 480px;
`;

const SKULL_DOME_STYLE = `
	position: absolute;
	left: 0;
	top: 0;
	width: 380px;
	height: 380px;
	background: #f0ebd8;
	border-radius: 50% 50% 45% 45%;
	box-shadow: 0 0 60px rgba(255, 240, 220, 0.4);
`;

const SKULL_SOCKET_STYLE = `
	position: absolute;
	width: 90px;
	height: 110px;
	background: #050505;
	border-radius: 50%;
	top: 130px;
`;

const SKULL_GREEN_STYLE = `
	position: absolute;
	width: 26px;
	height: 26px;
	background: #00ff44;
	border-radius: 50%;
	box-shadow: 0 0 30px #00ff44, 0 0 60px #00ff44;
	top: 175px;
	left: 110px;
`;

const SKULL_JAW_STYLE = `
	position: absolute;
	left: 80px;
	top: 320px;
	width: 220px;
	height: 130px;
	background: #f0ebd8;
	clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
`;

export type UI = {
	setStamina: (value: number, max: number) => void;
	setStaminaVisible: (visible: boolean) => void;
	setResumeHintVisible: (visible: boolean) => void;
	setHidePromptVisible: (visible: boolean, mode: "hide" | "exit") => void;
	showTitle: (onStart: () => void) => void;
	hideTitle: () => void;
	showWin: (onPlayAgain: () => void) => void;
	hideWin: () => void;
	showJumpscare: () => void;
	hideJumpscare: () => void;
	showLose: (onNewGame: () => void, onTitle: () => void) => void;
	hideLose: () => void;
};

function makeOverlay(bgStyle: string): HTMLDivElement {
	const div = document.createElement("div");
	div.setAttribute("style", CONTAINER_STYLE + bgStyle);
	return div;
}

function makeButton(label: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = label;
	btn.setAttribute("style", BUTTON_STYLE);
	return btn;
}

export function createUI(): UI {
	const styleTag = document.createElement("style");
	styleTag.textContent = TITLE_KEYFRAMES;
	document.head.appendChild(styleTag);

	// Title overlay
	const title = makeOverlay(TITLE_BG);
	const titleHeading = document.createElement("h1");
	titleHeading.textContent = "The Woodland Virus";
	titleHeading.setAttribute("style", TITLE_TEXT_STYLE);
	title.appendChild(titleHeading);
	const titleHint = document.createElement("p");
	titleHint.textContent =
		"WASD to move. Mouse to look. Hold Q to sprint. Reach the green flag.";
	titleHint.setAttribute("style", SUBTITLE_STYLE);
	title.appendChild(titleHint);
	const startButton = makeButton("Start Game");
	title.appendChild(startButton);
	document.body.appendChild(title);

	// Win overlay
	const win = makeOverlay(WIN_BG);
	const winHeading = document.createElement("h1");
	winHeading.textContent = "You Survived";
	winHeading.setAttribute("style", TITLE_TEXT_STYLE);
	win.appendChild(winHeading);
	const playAgainButton = makeButton("Play Again");
	win.appendChild(playAgainButton);
	document.body.appendChild(win);

	// Stamina bar
	const staminaWrap = document.createElement("div");
	staminaWrap.setAttribute("style", STAMINA_WRAP_STYLE);
	const staminaFill = document.createElement("div");
	staminaFill.setAttribute("style", STAMINA_FILL_STYLE);
	staminaWrap.appendChild(staminaFill);
	document.body.appendChild(staminaWrap);

	// Resume hint
	const resumeHint = document.createElement("div");
	resumeHint.setAttribute("style", RESUME_HINT_STYLE);
	resumeHint.textContent = "Click to resume";
	document.body.appendChild(resumeHint);

	// Hide prompt
	const hidePrompt = document.createElement("div");
	hidePrompt.setAttribute("style", HIDE_PROMPT_STYLE);
	document.body.appendChild(hidePrompt);

	// Jumpscare overlay (CSS skull + red flash)
	const jumpscare = document.createElement("div");
	jumpscare.setAttribute("style", JUMPSCARE_BG_STYLE);

	const skull = document.createElement("div");
	skull.setAttribute("style", SKULL_STYLE);

	const skullDome = document.createElement("div");
	skullDome.setAttribute("style", SKULL_DOME_STYLE);
	skull.appendChild(skullDome);

	const socketL = document.createElement("div");
	socketL.setAttribute("style", `${SKULL_SOCKET_STYLE} left: 100px;`);
	skull.appendChild(socketL);

	const socketR = document.createElement("div");
	socketR.setAttribute("style", `${SKULL_SOCKET_STYLE} right: 100px;`);
	skull.appendChild(socketR);

	const greenEye = document.createElement("div");
	greenEye.setAttribute("style", SKULL_GREEN_STYLE);
	skull.appendChild(greenEye);

	const jaw = document.createElement("div");
	jaw.setAttribute("style", SKULL_JAW_STYLE);
	skull.appendChild(jaw);

	jumpscare.appendChild(skull);

	const flash = document.createElement("div");
	flash.setAttribute("style", JUMPSCARE_FLASH_STYLE);
	jumpscare.appendChild(flash);

	document.body.appendChild(jumpscare);

	// LOSE overlay
	const lose = makeOverlay(WIN_BG);
	const loseHeading = document.createElement("h1");
	loseHeading.textContent = "You Died";
	loseHeading.setAttribute("style", TITLE_TEXT_STYLE);
	lose.appendChild(loseHeading);
	const loseRow = document.createElement("div");
	loseRow.setAttribute("style", "display: flex; gap: 20px;");
	const newGameButton = makeButton("New Game");
	const titleButton = makeButton("Title Screen");
	loseRow.appendChild(newGameButton);
	loseRow.appendChild(titleButton);
	lose.appendChild(loseRow);
	document.body.appendChild(lose);

	let startHandler: (() => void) | null = null;
	let playAgainHandler: (() => void) | null = null;
	let newGameHandler: (() => void) | null = null;
	let titleHandler: (() => void) | null = null;

	startButton.addEventListener("click", () => {
		startHandler?.();
	});
	playAgainButton.addEventListener("click", () => {
		playAgainHandler?.();
	});
	newGameButton.addEventListener("click", () => {
		newGameHandler?.();
	});
	titleButton.addEventListener("click", () => {
		titleHandler?.();
	});

	return {
		setStamina(value, max) {
			const ratio = Math.max(0, Math.min(1, value / max));
			staminaFill.style.width = `${ratio * 100}%`;
			if (ratio < 0.25) {
				staminaFill.style.background = "linear-gradient(to right, #c44, #722)";
			} else {
				staminaFill.style.background =
					"linear-gradient(to right, #6cdc7a, #2a8a3a)";
			}
		},
		setStaminaVisible(visible) {
			staminaWrap.style.display = visible ? "block" : "none";
		},
		setResumeHintVisible(visible) {
			resumeHint.style.display = visible ? "block" : "none";
		},
		setHidePromptVisible(visible, mode) {
			hidePrompt.textContent =
				mode === "hide" ? "Press E to hide" : "Press E to exit";
			hidePrompt.style.display = visible ? "block" : "none";
		},
		showTitle(onStart) {
			startHandler = onStart;
			title.style.display = "flex";
		},
		hideTitle() {
			title.style.display = "none";
		},
		showWin(onPlayAgain) {
			playAgainHandler = onPlayAgain;
			win.style.display = "flex";
		},
		hideWin() {
			win.style.display = "none";
		},
		showJumpscare() {
			jumpscare.style.display = "flex";
			flash.style.background = "rgba(180, 0, 0, 0.6)";
			window.setTimeout(() => {
				flash.style.background = "rgba(180, 0, 0, 0)";
			}, 150);
		},
		hideJumpscare() {
			jumpscare.style.display = "none";
			flash.style.background = "rgba(180, 0, 0, 0)";
		},
		showLose(onNewGame, onTitle) {
			newGameHandler = onNewGame;
			titleHandler = onTitle;
			lose.style.display = "flex";
		},
		hideLose() {
			lose.style.display = "none";
		},
	};
}
