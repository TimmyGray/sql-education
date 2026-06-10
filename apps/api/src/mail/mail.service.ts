import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MAIL_PRODUCER,
  MAIL_TRANSPORT,
  MailJob,
  MailProducerLike,
  MailTransportLike,
} from "./mail.constants";

/**
 * Sends transactional emails (welcome + activation code).
 *
 * Two entry points exist by design:
 *  - `enqueue*` methods publish a {@link MailJob} onto RabbitMQ; the worker
 *    later calls the matching `send*` method to actually deliver. AuthService
 *    uses these so the request path never blocks on SMTP.
 *  - `send*` methods talk to SMTP directly (used by the queue consumer, and
 *    available for direct sends/tests).
 *
 * Both the SMTP transport and the RMQ producer are injected behind small
 * interfaces so unit tests can fake them with no real I/O.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransportLike,
    @Inject(MAIL_PRODUCER) private readonly producer: MailProducerLike,
  ) {
    this.from =
      this.config.get<string>("MAIL_FROM") ?? "no-reply@sql-edu.local";
  }

  // --- Queue producers (called from the request path) ----------------------

  /** Enqueue a welcome email job for `email`. */
  async enqueueWelcomeEmail(email: string): Promise<void> {
    this.logger.debug(`Enqueuing welcome email for ${email}`);
    await this.producer.enqueue({ type: "welcome", email });
  }

  /** Enqueue an activation-code email job for `email`. */
  async enqueueActivationCodeEmail(email: string, code: string): Promise<void> {
    this.logger.debug(`Enqueuing activation-code email for ${email}`);
    await this.producer.enqueue({ type: "activation-code", email, code });
  }

  // --- Direct senders (called from the queue consumer) ---------------------

  /** Send the welcome email immediately over SMTP. */
  async sendWelcomeEmail(email: string): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: email,
      subject: "Welcome to SQL Education",
      text:
        "Welcome to SQL Education!\n\n" +
        "Your account has been created. Confirm your email with the " +
        "activation code we sent to start learning.",
      html:
        "<p>Welcome to <strong>SQL Education</strong>!</p>" +
        "<p>Your account has been created. Confirm your email with the " +
        "activation code we sent to start learning.</p>",
    });
    this.logger.log(`Welcome email sent to ${email}`);
  }

  /** Send the activation-code email immediately over SMTP. */
  async sendActivationCodeEmail(email: string, code: string): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: email,
      subject: "Your SQL Education activation code",
      text:
        `Your activation code is ${code}.\n\n` +
        "It expires in 15 minutes. Enter it on the activation page to " +
        "finish setting up your account.",
      html:
        `<p>Your activation code is <strong>${code}</strong>.</p>` +
        "<p>It expires in 15 minutes. Enter it on the activation page to " +
        "finish setting up your account.</p>",
    });
    this.logger.log(`Activation code email sent to ${email}`);
  }

  /** Dispatch a job pulled off the queue to the matching direct sender. */
  async handleJob(job: MailJob): Promise<void> {
    this.logger.debug(`handleJob: dispatching "${job.type}" for ${job.email}`);
    switch (job.type) {
      case "welcome":
        await this.sendWelcomeEmail(job.email);
        return;
      case "activation-code":
        await this.sendActivationCodeEmail(job.email, job.code);
        return;
      default: {
        // Exhaustiveness guard — unknown job types are logged, not thrown,
        // so a single bad message can't wedge the consumer.
        const unknown = job as { type?: string };
        this.logger.warn(`Unknown mail job type: ${String(unknown.type)}`);
      }
    }
  }
}
