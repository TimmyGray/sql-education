/** RabbitMQ queue carrying outbound email jobs (durable). */
export const MAIL_QUEUE = "mail.jobs";

/** Injection token for the nodemailer transport (mockable in tests). */
export const MAIL_TRANSPORT = "MAIL_TRANSPORT";

/** Injection token for the RabbitMQ producer (mockable in tests). */
export const MAIL_PRODUCER = "MAIL_PRODUCER";

/** Discriminated set of email jobs that travel over {@link MAIL_QUEUE}. */
export type MailJob =
  | { type: "welcome"; email: string }
  | { type: "activation-code"; email: string; code: string };

/**
 * Minimal nodemailer-transport surface {@link MailService} relies on. Declared
 * locally so a unit test can supply a `{ sendMail: jest.fn() }` fake without
 * importing nodemailer.
 */
export interface MailTransportLike {
  sendMail(options: {
    from?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<unknown>;
}

/**
 * Minimal producer surface used to enqueue a {@link MailJob}. The amqplib-backed
 * implementation publishes to {@link MAIL_QUEUE}; tests provide a fake.
 */
export interface MailProducerLike {
  enqueue(job: MailJob): Promise<void>;
}
