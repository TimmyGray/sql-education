jest.mock("amqplib");
import * as amqp from "amqplib";
import { ConfigService } from "@nestjs/config";
import { MailProducer } from "./mail.producer";
import { MailService } from "./mail.service";
import { MAIL_QUEUE, MailJob } from "./mail.constants";

describe("MailProducer", () => {
  let mail: { handleJob: jest.Mock };
  let channel: {
    assertQueue: jest.Mock;
    sendToQueue: jest.Mock;
    prefetch: jest.Mock;
    consume: jest.Mock;
    ack: jest.Mock;
    nack: jest.Mock;
    close: jest.Mock;
  };
  let connection: { createChannel: jest.Mock; close: jest.Mock };
  let consumeCb: ((msg: unknown) => void) | null;

  // AMQP_URL unset → falls back to the default broker URL.
  const config = {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;

  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const make = () =>
    new MailProducer(config, mail as unknown as MailService);

  beforeEach(() => {
    consumeCb = null;
    channel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn().mockReturnValue(true),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((_q: string, cb: typeof consumeCb) => {
        consumeCb = cb;
        return Promise.resolve(undefined);
      }),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    mail = { handleJob: jest.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => jest.clearAllMocks());

  it("connects, asserts the durable queue and starts a consumer on init", async () => {
    const producer = make();
    await producer.onModuleInit();

    expect(amqp.connect).toHaveBeenCalledWith(
      "amqp://guest:guest@localhost:5672",
    );
    expect(channel.assertQueue).toHaveBeenCalledWith(MAIL_QUEUE, {
      durable: true,
    });
    expect(channel.prefetch).toHaveBeenCalledWith(5);
    expect(channel.consume).toHaveBeenCalledWith(MAIL_QUEUE, expect.any(Function));
  });

  it("uses AMQP_URL from config when present", async () => {
    const cfg = {
      get: jest.fn((key: string) =>
        key === "AMQP_URL" ? "amqp://broker:5672" : undefined,
      ),
    } as unknown as ConfigService;

    await new MailProducer(cfg, mail as unknown as MailService).onModuleInit();

    expect(amqp.connect).toHaveBeenCalledWith("amqp://broker:5672");
  });

  it("enqueue publishes a persistent JSON job when the channel is available", async () => {
    const producer = make();
    await producer.onModuleInit();
    const job: MailJob = { type: "welcome", email: "a@test.com" };

    await producer.enqueue(job);

    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, payload, opts] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe(MAIL_QUEUE);
    expect(JSON.parse((payload as Buffer).toString())).toEqual(job);
    expect(opts).toMatchObject({
      persistent: true,
      contentType: "application/json",
    });
    expect(mail.handleJob).not.toHaveBeenCalled();
  });

  it("enqueue falls back to inline delivery when the broker buffer is full", async () => {
    channel.sendToQueue.mockReturnValue(false);
    const producer = make();
    await producer.onModuleInit();
    const job: MailJob = {
      type: "activation-code",
      email: "a@test.com",
      code: "123456",
    };

    await producer.enqueue(job);

    expect(mail.handleJob).toHaveBeenCalledWith(job);
  });

  it("enqueue sends inline when the broker is unavailable (no channel)", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));
    const producer = make();
    await producer.onModuleInit(); // connect fails → channel stays null
    const job: MailJob = { type: "welcome", email: "a@test.com" };

    await producer.enqueue(job);

    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(mail.handleJob).toHaveBeenCalledWith(job);
  });

  it("consumed messages are handled and acked", async () => {
    const producer = make();
    await producer.onModuleInit();
    const job: MailJob = { type: "welcome", email: "x@test.com" };
    const msg = { content: Buffer.from(JSON.stringify(job)) };

    consumeCb?.(msg);
    await flush();

    expect(mail.handleJob).toHaveBeenCalledWith(job);
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it("ignores a null consumer message", async () => {
    const producer = make();
    await producer.onModuleInit();

    consumeCb?.(null);
    await flush();

    expect(mail.handleJob).not.toHaveBeenCalled();
  });

  it("nacks (without requeue) a message that fails to process", async () => {
    mail.handleJob.mockRejectedValue(new Error("smtp down"));
    const producer = make();
    await producer.onModuleInit();
    const msg = {
      content: Buffer.from(
        JSON.stringify({ type: "welcome", email: "x@test.com" }),
      ),
    };

    consumeCb?.(msg);
    await flush();

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it("closes the channel and connection on destroy", async () => {
    const producer = make();
    await producer.onModuleInit();

    await producer.onModuleDestroy();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it("swallows errors thrown while closing on destroy", async () => {
    const producer = make();
    await producer.onModuleInit();
    channel.close.mockRejectedValue(new Error("already closed"));

    await expect(producer.onModuleDestroy()).resolves.toBeUndefined();
  });
});
