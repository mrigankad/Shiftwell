import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("defaults to help", () => { expect(parseArgs([]).command).toBe("help"); });
  it("parses start flags", () => {
    const a = parseArgs(["start", "--port", "4600", "--no-open"]);
    expect(a.command).toBe("start");
    expect(a.flags).toEqual({ port: "4600", "no-open": true });
  });
  it("collects repeated --account and a task", () => {
    const a = parseArgs(["run", "fix the bug", "--account", "A", "--account=B", "--repo", "."]);
    expect(a.positionals).toEqual(["fix the bug"]);
    expect(a.multi.account).toEqual(["A", "B"]);
    expect(a.flags.repo).toBe(".");
  });
  it("handles --version and --help", () => {
    expect(parseArgs(["--version"]).command).toBe("version");
    expect(parseArgs(["status", "--help"]).command).toBe("help");
  });
  it("errors on a missing value", () => { expect(() => parseArgs(["handoff", "x", "--to"])).toThrow(/--to/); });
  it("parses done with a boolean flag", () => {
    const a = parseArgs(["done", "abc", "--remove-folder"]);
    expect(a.positionals).toEqual(["abc"]);
    expect(a.flags["remove-folder"]).toBe(true);
  });
});
