import { NotFoundException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";

const USER = {
  id: "user-1",
  email: "user@test.com",
  passwordHash: "hashed",
  status: "ACTIVE" as const,
  displayName: "Old Name",
  createdAt: new Date("2025-02-02T00:00:00.000Z"),
  updatedAt: new Date("2025-02-02T00:00:00.000Z"),
  isTestAccount: false,
  testAccountExpiresAt: null as Date | null,
};

describe("UsersService", () => {
  let prismaUser: { update: jest.Mock; findUnique: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prismaUser = { update: jest.fn(), findUnique: jest.fn() };
    const prisma = { user: prismaUser } as unknown as PrismaService;
    service = new UsersService(prisma);
  });

  it("updates displayName and returns the mapped public User", async () => {
    prismaUser.update.mockResolvedValue({ ...USER, displayName: "New Name" });

    const out = await service.updateProfile("user-1", {
      displayName: "New Name",
    });

    expect(prismaUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "New Name" },
    });
    expect(out).toEqual({
      id: "user-1",
      email: "user@test.com",
      displayName: "New Name",
      status: "ACTIVE",
      createdAt: "2025-02-02T00:00:00.000Z",
      isTestAccount: false,
      testAccountExpiresAt: null,
    });
    // No password/hash leaks into the public shape.
    expect(out).not.toHaveProperty("passwordHash");
  });

  it("passes undefined displayName through (no-op update still returns User)", async () => {
    prismaUser.update.mockResolvedValue({ ...USER });
    const out = await service.updateProfile("user-1", {});
    expect(prismaUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: undefined },
    });
    expect(out.displayName).toBe("Old Name");
  });

  it("getProfile maps an existing user", async () => {
    prismaUser.findUnique.mockResolvedValue({ ...USER });
    const out = await service.getProfile("user-1");
    expect(out.id).toBe("user-1");
    expect(out.createdAt).toBe("2025-02-02T00:00:00.000Z");
  });

  it("getProfile throws 404 when the user is missing", async () => {
    prismaUser.findUnique.mockResolvedValue(null);
    await expect(service.getProfile("nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
