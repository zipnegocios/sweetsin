import { describe, expect, it } from "vitest";
import { parseAssignedRows } from "./parse-assigned-rows";

describe("parseAssignedRows", () => {
  it("parsea filas válidas y omite las corruptas", () => {
    const rows = [{ payload: '{"id":"a"}' }, { payload: "{no-json" }, { payload: '{"id":"b"}' }];
    expect(parseAssignedRows<{ id: string }>(rows)).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
