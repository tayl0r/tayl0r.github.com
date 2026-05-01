import { expect, test } from "vitest";
import { validateName } from "./name-filter";

test("empty name rejected", () => expect(validateName("")).toBe("empty"));
test("whitespace-only rejected", () =>
	expect(validateName("   ")).toBe("empty"));
test("too long rejected", () =>
	expect(validateName("a".repeat(13))).toBe("too_long"));
test("profanity rejected (substring)", () =>
	expect(validateName("xxhellfuckerxx")).toBe("profanity"));
test("clean name accepted", () => expect(validateName("Case")).toBe("ok"));
test("trims before checking length", () =>
	expect(validateName("  Bo  ")).toBe("ok"));
