import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import {
  MAIL_PRODUCER,
  MAIL_TRANSPORT,
  MailTransportLike,
} from "./mail.constants";
import { MailService } from "./mail.service";
import { MailProducer } from "./mail.producer";

/**
 * Global mail module.
 *
 * Wires:
 *  - {@link MAIL_TRANSPORT}: a nodemailer SMTP transport built from config
 *    (SMTP_HOST/SMTP_PORT). Created lazily; no connection is opened until a
 *    message is sent.
 *  - {@link MailService}: welcome + activation-code senders/enqueuers.
 *  - {@link MailProducer}: RabbitMQ producer/consumer (also bound to
 *    {@link MAIL_PRODUCER} so MailService can enqueue jobs).
 *
 * `@Global` so AuthModule can inject `MailService` without re-importing.
 */
@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailTransportLike => {
        const host = config.get<string>("SMTP_HOST") ?? "localhost";
        const port = config.get<number>("SMTP_PORT") ?? 1025;
        const user = config.get<string>("SMTP_USER");
        const pass = config.get<string>("SMTP_PASS");
        const smtpLogger = new Logger("MailModule:SMTP");
        const transport = nodemailer.createTransport({
          host,
          port,
          requireTLS: port === 465 || port === 587, // Local/dev SMTP (e.g. MailHog) is plaintext on 1025; implicit TLS on 465, STARTTLS on 587.
          // secure: true uses implicit TLS (port 465); false lets STARTTLS
          // negotiate on 587. Plaintext dev transports (e.g. MailHog/1025) get neither.
          secure: port === 465,
          ...(user && pass ? { auth: { user, pass } } : {}),
          // Increase timeouts to accommodate Railway → Gmail network latency.
          // The default 5 s connection timeout is too short and causes
          // "Connection timeout" errors on port 587 in the sfo region.
          connectionTimeout: 10_000, // 10 s — time allowed for the initial TCP handshake
          socketTimeout: 15_000,     // 15 s — time allowed for each SMTP command/response
          // Connection pooling: reuse SMTP connections across jobs instead of
          // opening a new TCP+TLS session for every message.
          pool: true,
          maxConnections: 5,   // keep up to 5 concurrent SMTP connections open
          maxMessages: 100,    // recycle a connection after 100 messages to avoid stale sockets
          // Debug logging to trace exactly which SMTP command stalls (EHLO,
          // STARTTLS, AUTH, etc.) when the TCP connection succeeds but the
          // protocol handshake hangs.
          logger: {
            level(_level: string): void {},
            trace(...args: unknown[]): void {
              smtpLogger.verbose(args.join(" "));
            },
            debug(...args: unknown[]): void {
              smtpLogger.debug(args.join(" "));
            },
            info(...args: unknown[]): void {
              smtpLogger.log(args.join(" "));
            },
            warn(...args: unknown[]): void {
              smtpLogger.warn(args.join(" "));
            },
            error(...args: unknown[]): void {
              smtpLogger.error(args.join(" "));
            },
            fatal(...args: unknown[]): void {
              smtpLogger.error(`[FATAL] ${args.join(" ")}`);
            },
          },
          debug: true, // Emit raw SMTP command/response lines to the logger above.
        });
        new Logger("MailModule").log(
          `SMTP transport configured for ${host}:${port} (debug logging enabled)`,
        );
        return transport as unknown as MailTransportLike;
      },
    },
    MailProducer,
    // Bind the concrete producer to the interface token MailService injects.
    { provide: MAIL_PRODUCER, useExisting: MailProducer },
    MailService,
  ],
  exports: [MailService, MAIL_PRODUCER],
})
export class MailModule { }
