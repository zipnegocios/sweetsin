import nodemailer from "nodemailer";
import type { NotificationPort } from "@workspace/domain/notifications";
import type { Locale } from "@workspace/domain/shared";
import { SmtpNotConfiguredError } from "./errors";
import { renderOrderConfirmation, renderEventQuoteReceipt } from "./templates";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

function readConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !password || !from) {
    throw new SmtpNotConfiguredError();
  }

  return { host, port: Number(port), user, password, from };
}

export class SmtpNotificationAdapter implements NotificationPort {
  async sendOrderConfirmation(
    order: { customerEmail: string; totalCents: number; id: string },
    locale: Locale,
  ): Promise<void> {
    const config = readConfig();
    const { subject, text } = renderOrderConfirmation(order, locale);
    await this.send(config, order.customerEmail, subject, text);
  }

  async sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void> {
    const config = readConfig();
    const { subject, text } = renderEventQuoteReceipt(booking, locale);
    await this.send(config, booking.clientEmail, subject, text);
  }

  private async send(config: SmtpConfig, to: string, subject: string, text: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.password },
    });
    await transporter.sendMail({ from: config.from, to, subject, text });
  }
}
