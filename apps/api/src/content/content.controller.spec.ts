import { ContentController } from "./content.controller";
import { ContentService } from "./content.service";

describe("ContentController", () => {
  let content: jest.Mocked<
    Pick<ContentService, "getDashboard" | "getBlockContent">
  >;
  let controller: ContentController;

  beforeEach(() => {
    content = {
      getDashboard: jest.fn().mockResolvedValue({ totalXp: 0, levels: [] }),
      getBlockContent: jest.fn().mockResolvedValue({ id: "b1" }),
    } as unknown as typeof content;
    controller = new ContentController(content as unknown as ContentService);
  });

  it("getDashboard delegates with the current userId", async () => {
    await expect(controller.getDashboard("u1")).resolves.toEqual({
      totalXp: 0,
      levels: [],
    });
    expect(content.getDashboard).toHaveBeenCalledWith("u1");
  });

  it("getBlock delegates with userId and blockId", async () => {
    await expect(controller.getBlock("u1", "b1")).resolves.toEqual({ id: "b1" });
    expect(content.getBlockContent).toHaveBeenCalledWith("u1", "b1");
  });
});
