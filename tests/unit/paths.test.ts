import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkDataRootSafety,
  getDataPaths,
  resolveDataRoot,
  resolveLifequestEnv,
  toSqliteUrl,
} from "@/server/config/paths";

describe("local data paths", () => {
  it("uses %LOCALAPPDATA%\\LIFEQUEST for production on Windows", () => {
    const root = resolveDataRoot({ LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local", LIFEQUEST_ENV: "production" }, "win32");
    expect(root).toBe(path.join("C:\\Users\\me\\AppData\\Local", "LIFEQUEST"));
  });

  it("keeps development and test data separate from production", () => {
    const base = { LOCALAPPDATA: "C:\\L" };
    expect(resolveDataRoot({ ...base, LIFEQUEST_ENV: "development" }, "win32")).toMatch(/LIFEQUEST-development$/);
    expect(resolveDataRoot({ ...base, NODE_ENV: "test" }, "win32")).toMatch(/LIFEQUEST-test$/);
    expect(resolveLifequestEnv({})).toBe("development");
    expect(resolveLifequestEnv({ NODE_ENV: "production" })).toBe("production");
  });

  it("honours LIFEQUEST_DATA_DIR", () => {
    const p = getDataPaths({ LIFEQUEST_DATA_DIR: path.resolve("/tmp/lq") });
    expect(p.dbFile).toBe(path.join(path.resolve("/tmp/lq"), "db", "lifequest.db"));
    expect(p.backupsDir).toBe(path.join(path.resolve("/tmp/lq"), "backups"));
  });

  it("refuses a data directory inside the project (would risk committing or serving personal data)", () => {
    expect(() => checkDataRootSafety(path.join(process.cwd(), "public", "data"))).toThrow(/inside the project/);
    expect(() => checkDataRootSafety(path.join(process.cwd(), "data"))).toThrow();
  });

  it("warns when data would land in a cloud-synced folder", () => {
    const { warnings } = checkDataRootSafety("C:\\Users\\me\\OneDrive\\LIFEQUEST", "C:\\code\\lifequest");
    expect(warnings.length).toBe(1);
  });

  it("builds forward-slash sqlite URLs", () => {
    expect(toSqliteUrl("C:\\a\\b.db")).toBe("file:C:/a/b.db");
  });
});
