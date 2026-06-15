import { PrismaService } from "./prisma.service";

/**
 * PrismaClient reads DATABASE_URL when constructed; jest doesn't load `.env`,
 * so provide a dummy value. `$connect`/`$disconnect` are spied so no real DB
 * connection is opened.
 */
describe("PrismaService", () => {
  const ORIGINAL_URL = process.env.DATABASE_URL;

  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
  });

  afterAll(() => {
    process.env.DATABASE_URL = ORIGINAL_URL;
  });

  it("connects to the database on module init", async () => {
    const service = new PrismaService();
    const connect = jest
      .spyOn(service, "$connect")
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("disconnects on module destroy", async () => {
    const service = new PrismaService();
    const disconnect = jest
      .spyOn(service, "$disconnect")
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
