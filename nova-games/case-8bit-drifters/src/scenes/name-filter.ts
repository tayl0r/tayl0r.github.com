const BAD = [
	"fuck",
	"shit",
	"bitch",
	"asshole",
	"dick",
	"cock",
	"pussy",
	"cunt",
	"fag",
	"nigger",
	"nigga",
	"retard",
	"rape",
	"porn",
	"sex",
	"slut",
	"whore",
];

export type NameValidation = "ok" | "empty" | "too_long" | "profanity";

export function validateName(raw: string): NameValidation {
	const name = raw.trim();
	if (name.length === 0) return "empty";
	const lower = name.toLowerCase();
	for (const bad of BAD) if (lower.includes(bad)) return "profanity";
	if (name.length > 12) return "too_long";
	return "ok";
}
