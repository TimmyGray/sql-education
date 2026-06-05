import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";
import { MailProducerLike, MailTransportLike } from "./mail.constants";

/**
 * MailService unit tests. Both the SMTP transport and the RMQ producer are
 * fakes — nothing connects to SMTP or RabbitMQ.
 */
describe("MailService", () => {
  let transport: jest.Mocked<MailTransportLike>;
  let producer: jest.Mocked<MailProducerLike>;
  let service: MailService;

  const config = {
    get: jest.fn((key: string) =>
      key === "MAIL_FROM" ? "from@sql-edu.test" : undefined,
    ),
  } as unknown as ConfigService;

  beforeEach(() => {
    transport = { sendMail: jest.fn().mockResolvedValue({ messageId: "1" }) };
    producer = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new MailService(config, transport, producer);
  });

  it("enqueueWelcomeEmail publishes a welcome job", async () => {
    await service.enqueueWelcomeEmail("u@test.com");
    expect(producer.enqueue).toHaveBeenCalledWith({
      type: "welcome",
      email: "u@test.com",
    });
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("enqueueActivationCodeEmail publishes an activation-code job", async () => {
    await service.enqueueActivationCodeEmail("u@test.com", "123456");
    expect(producer.enqueue).toHaveBeenCalledWith({
      type: "activation-code",
      email: "u@test.com",
      code: "123456",
    });
  });

  it("sendWelcomeEmail sends via SMTP from the configured address", async () => {
    await service.sendWelcomeEmail("u@test.com");
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    const arg = transport.sendMail.mock.calls[0][0];
    expect(arg.to).toBe("u@test.com");
    expect(arg.from).toBe("from@sql-edu.test");
    expect(arg.subject).toMatch(/welcome/i);
  });

  it("sendActivationCodeEmail includes the code in the body", async () => {
    await service.sendActivationCodeEmail("u@test.com", "987654");
    const arg = transport.sendMail.mock.calls[0][0];
    expect(arg.to).toBe("u@test.com");
    expect(arg.text).toContain("987654");
    expect(arg.html).toContain("987654");
  });

  it("handleJob routes a welcome job to sendWelcomeEmail", async () => {
    await service.handleJob({ type: "welcome", email: "w@test.com" });
    const arg = transport.sendMail.mock.calls[0][0];
    expect(arg.to).toBe("w@test.com");
    expect(arg.subject).toMatch(/welcome/i);
  });

  it("handleJob routes an activation-code job to the code sender", async () => {
    await service.handleJob({
      type: "activation-code",
      email: "c@test.com",
      code: "555000",
    });
    const arg = transport.sendMail.mock.calls[0][0];
    expect(arg.to).toBe("c@test.com");
    expect(arg.text).toContain("555000");
  });

  it("falls back to a default from-address when MAIL_FROM is unset", async () => {
    const noFrom = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const svc = new MailService(noFrom, transport, producer);
    await svc.sendWelcomeEmail("x@test.com");
    expect(transport.sendMail.mock.calls[0][0].from).toBe(
      "no-reply@sql-edu.local",
    );
  });
});
