import {
  computeBlockStatuses,
  computeSingleBlockStatus,
  countCompletedTasks,
  isBlockComplete,
  XP_PER_BLOCK,
  type OrderedBlock,
} from "./progression";

const blocks: OrderedBlock[] = [
  { id: "b1", order: 1 },
  { id: "b2", order: 2 },
  { id: "b3", order: 3 },
];

describe("computeBlockStatuses — unlock chain", () => {
  it("unlocks only block 1 when nothing is completed", () => {
    const map = computeBlockStatuses(blocks, new Set());
    expect(map.get("b1")).toBe("IN_PROGRESS");
    expect(map.get("b2")).toBe("LOCKED");
    expect(map.get("b3")).toBe("LOCKED");
  });

  it("unlocks block 2 once block 1 is completed", () => {
    const map = computeBlockStatuses(blocks, new Set(["b1"]));
    expect(map.get("b1")).toBe("COMPLETED");
    expect(map.get("b2")).toBe("IN_PROGRESS");
    expect(map.get("b3")).toBe("LOCKED");
  });

  it("unlocks block 3 once blocks 1 and 2 are completed", () => {
    const map = computeBlockStatuses(blocks, new Set(["b1", "b2"]));
    expect(map.get("b2")).toBe("COMPLETED");
    expect(map.get("b3")).toBe("IN_PROGRESS");
  });

  it("does NOT unlock block 3 if block 2 is incomplete even when block 1 is done", () => {
    const map = computeBlockStatuses(blocks, new Set(["b1"]));
    expect(map.get("b3")).toBe("LOCKED");
  });

  it("handles a completed block that is past the contiguous prefix (gap)", () => {
    // b3 completed but b2 not → b3 shows COMPLETED, b2 IN_PROGRESS, and the
    // block after a completed b3 would unlock.
    const map = computeBlockStatuses(blocks, new Set(["b1", "b3"]));
    expect(map.get("b1")).toBe("COMPLETED");
    expect(map.get("b2")).toBe("IN_PROGRESS");
    expect(map.get("b3")).toBe("COMPLETED");
  });

  it("sorts by order before computing (input order independent)", () => {
    const shuffled: OrderedBlock[] = [
      { id: "b3", order: 3 },
      { id: "b1", order: 1 },
      { id: "b2", order: 2 },
    ];
    const map = computeBlockStatuses(shuffled, new Set(["b1"]));
    expect(map.get("b1")).toBe("COMPLETED");
    expect(map.get("b2")).toBe("IN_PROGRESS");
    expect(map.get("b3")).toBe("LOCKED");
  });
});

describe("computeSingleBlockStatus", () => {
  it("resolves a single block within its level", () => {
    expect(computeSingleBlockStatus("b2", blocks, new Set(["b1"]))).toBe(
      "IN_PROGRESS",
    );
    expect(computeSingleBlockStatus("b2", blocks, new Set())).toBe("LOCKED");
    expect(computeSingleBlockStatus("b1", blocks, new Set(["b1"]))).toBe(
      "COMPLETED",
    );
  });

  it("returns LOCKED for an unknown block id", () => {
    expect(computeSingleBlockStatus("ghost", blocks, new Set())).toBe("LOCKED");
  });
});

describe("isBlockComplete", () => {
  it("is true when every task is COMPLETED or SKIPPED", () => {
    expect(isBlockComplete(["COMPLETED", "COMPLETED"])).toBe(true);
    expect(isBlockComplete(["COMPLETED", "SKIPPED"])).toBe(true);
    expect(isBlockComplete(["SKIPPED", "SKIPPED"])).toBe(true);
  });

  it("is false when any task is NOT_STARTED", () => {
    expect(isBlockComplete(["COMPLETED", "NOT_STARTED"])).toBe(false);
  });

  it("is false for an empty block (nothing to complete)", () => {
    expect(isBlockComplete([])).toBe(false);
  });
});

describe("countCompletedTasks", () => {
  it("counts only COMPLETED (not SKIPPED)", () => {
    expect(
      countCompletedTasks(["COMPLETED", "SKIPPED", "COMPLETED", "NOT_STARTED"]),
    ).toBe(2);
  });
  it("is 0 for none completed", () => {
    expect(countCompletedTasks(["SKIPPED", "NOT_STARTED"])).toBe(0);
  });
});

describe("XP_PER_BLOCK", () => {
  it("matches the pinned reward table", () => {
    expect(XP_PER_BLOCK).toEqual({ NOVICE: 100, JUNIOR: 150, MIDDLE: 200 });
  });
});
