import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto";

describe("UsersController", () => {
  it("updateMe delegates to UsersService.updateProfile", async () => {
    const users = {
      updateProfile: jest.fn().mockResolvedValue({ id: "u1", displayName: "New" }),
    };
    const controller = new UsersController(users as unknown as UsersService);
    const dto = { displayName: "New" } as UpdateProfileDto;

    await expect(controller.updateMe("u1", dto)).resolves.toEqual({
      id: "u1",
      displayName: "New",
    });
    expect(users.updateProfile).toHaveBeenCalledWith("u1", dto);
  });
});
