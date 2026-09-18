export class SmtpNotConfiguredError extends Error {
  constructor() {
    super("SMTP is not configured yet");
    this.name = "SmtpNotConfiguredError";
  }
}
