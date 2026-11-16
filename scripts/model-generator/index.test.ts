import { describe, expect, test } from "bun:test";
import {
	buildModelSource,
	extractTableNames,
	toPascalCase,
} from "./index";

describe("extractTableNames", () => {
	test("finds pgTable declarations", () => {
		expect(
			extractTableNames('export const user = pgTable("user", {});')
		).toEqual(["user"]);
	});

	test("finds multi-line declarations and ignores other exports", () => {
		const content = `export const relations = defineRelationsPart({});
export const session =
	pgTable("session", {});
export const account = pgTable("account", {});`;
		expect(extractTableNames(content)).toEqual(["session", "account"]);
	});
});

describe("toPascalCase", () => {
	test("capitalizes simple and snake_case names", () => {
		expect(toPascalCase("user")).toBe("User");
		expect(toPascalCase("email_verification")).toBe("EmailVerification");
		expect(toPascalCase("emailVerification")).toBe("EmailVerification");
	});
});

describe("buildModelSource", () => {
	test("names select schema XModelSchema", () => {
		const source = buildModelSource("../schema/auth", ["user"]);
		expect(source).toContain(
			"export const UserModelSchema = createSelectSchema(user);"
		);
		expect(source).toContain(
			"export const UserInsertSchema = createInsertSchema(user);"
		);
		expect(source).toContain(
			"export const UserUpdateSchema = createUpdateSchema(user);"
		);
		expect(source).toContain('from "drizzle-zod"');
		expect(source).toContain('from "../schema/auth"');
	});
});
