import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import {
  MAIL_QUEUE,
  MailJob,
  MailProducerLike,
} from "./mail.constants";
import { MailService } from "./mail.service";

/**
 * amqplib-backed RabbitMQ producer + consumer for {@link MAIL_QUEUE}.
 *
 * Responsibilities:
 *  - `enqueue()` publishes a {@link MailJob} (satisfies {@link MailProducerLike}).
 *  - On module init it also starts a consumer that pulls jobs and hands them to
 *    {@link MailService.handleJob} for actual SMTP delivery.
 *
 * Connection is best-effort and lazy: if RabbitMQ is unavailable, errors are
 * logged and `enqueue()` falls back to sending inline via MailService so the
 * welcome/code emails are still delivered and the request path never fails.
 * Tests never construct this class — AuthService is given a fake producer, and
 * the Mail unit tests exercise MailService directly.
 */
@Injectable()
export class MailProducer
  implements MailProducerLike, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MailProducer.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MailService))
    private readonly mail: MailService,
  ) {
    this.url =
      this.config.get<string>("AMQP_URL") ??
      "amqp://guest:guest@localhost:5672";
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
    await this.startConsumer();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      this.logger.warn(
        `Error closing RabbitMQ connection: ${(err as Error).message}`,
      );
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }

  /** Establish the connection + channel and assert the durable queue. */
  private async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue(MAIL_QUEUE, { durable: true });
      this.logger.log(`Connected to AMQP broker, queue "${MAIL_QUEUE}" ready.`);
    } catch (err) {
      this.logger.error(
        `Failed to connect to AMQP broker (${(err as Error).message}); ` +
          "falling back to inline mail delivery.",
      );
      this.connection = null;
      this.channel = null;
    }
  }

  /** Publish a job, or send inline if the channel is unavailable. */
  async enqueue(job: MailJob): Promise<void> {
    if (this.channel) {
      const payload = Buffer.from(JSON.stringify(job));
      const ok = this.channel.sendToQueue(MAIL_QUEUE, payload, {
        persistent: true,
        contentType: "application/json",
      });
      if (ok) return;
      this.logger.warn("RabbitMQ buffer full; sending mail job inline.");
    }
    // Fallback: deliver directly so emails are never silently dropped.
    await this.mail.handleJob(job);
  }

  /** Consume jobs off the queue and deliver them via MailService. */
  private async startConsumer(): Promise<void> {
    if (!this.channel) return;
    await this.channel.prefetch(5);
    await this.channel.consume(MAIL_QUEUE, (msg) => {
      if (!msg) return;
      void this.processMessage(msg);
    });
    this.logger.log(`Consuming mail jobs from "${MAIL_QUEUE}".`);
  }

  private async processMessage(msg: amqp.ConsumeMessage): Promise<void> {
    try {
      const job = JSON.parse(msg.content.toString()) as MailJob;
      await this.mail.handleJob(job);
      this.channel?.ack(msg);
    } catch (err) {
      this.logger.error(
        `Failed to process mail job: ${(err as Error).message}`,
      );
      // Don't requeue a poison message — drop it to keep the consumer healthy.
      this.channel?.nack(msg, false, false);
    }
  }
}
