import { RedisService } from "./redis.service";
import { RedisClientLike } from "./redis.constants";

/**
 * RedisService unit tests. The ioredis client is a plain jest fake — no socket
 * is ever opened.
 */
describe("RedisService", () => {
  let client: jest.Mocked<RedisClientLike>;
  let service: RedisService;

  beforeEach(() => {
    client = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      ttl: jest.fn().mockResolvedValue(-2),
      quit: jest.fn().mockResolvedValue("OK"),
    };
    service = new RedisService(client);
  });

  it("setWithTtl issues SET key value EX ttl", async () => {
    await service.setWithTtl("k", "v", 900);
    expect(client.set).toHaveBeenCalledWith("k", "v", "EX", 900);
  });

  it("get delegates to the client", async () => {
    client.get.mockResolvedValue("hello");
    await expect(service.get("k")).resolves.toBe("hello");
    expect(client.get).toHaveBeenCalledWith("k");
  });

  it("del returns 0 (and skips the client) when no keys given", async () => {
    await expect(service.del()).resolves.toBe(0);
    expect(client.del).not.toHaveBeenCalled();
  });

  it("del forwards multiple keys", async () => {
    client.del.mockResolvedValue(2);
    await expect(service.del("a", "b")).resolves.toBe(2);
    expect(client.del).toHaveBeenCalledWith("a", "b");
  });

  it("incr returns the new counter value", async () => {
    client.incr.mockResolvedValue(3);
    await expect(service.incr("c")).resolves.toBe(3);
  });

  it("exists is true when the client returns a positive count", async () => {
    client.exists.mockResolvedValue(1);
    await expect(service.exists("k")).resolves.toBe(true);
    client.exists.mockResolvedValue(0);
    await expect(service.exists("k")).resolves.toBe(false);
  });

  it("ttl delegates to the client", async () => {
    client.ttl.mockResolvedValue(120);
    await expect(service.ttl("k")).resolves.toBe(120);
  });
});
