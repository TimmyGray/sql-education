import { LevelSchema, type Level } from "@sql-edu/contracts";

/**
 * Smoke test proving the @sql-edu/contracts workspace package is resolvable
 * and usable from the API. Wave 1 agents can rely on this import pattern.
 */
describe("@sql-edu/contracts integration", () => {
  it("exposes LevelSchema with the expected values", () => {
    expect(LevelSchema.options).toEqual(["NOVICE", "JUNIOR", "MIDDLE"]);
  });

  it("parses a valid level", () => {
    const level: Level = LevelSchema.parse("JUNIOR");
    expect(level).toBe("JUNIOR");
  });
});
