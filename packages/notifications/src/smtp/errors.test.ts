import { describe, it, expect } from "vitest";
import { SmtpNotConfiguredError } from "./errors";

describe("SmtpNotConfiguredError", () => {
  it("is an Error with an explicit message", () => {
    const error = new SmtpNotConfiguredError();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("SMTP is not configured yet");
  });
});
