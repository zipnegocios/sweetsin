import { describe, it, expect } from "vitest";
import { authenticateUser, registerCustomer } from "@workspace/domain/users";
import { DrizzleUserRepository } from "./user-repository";

describe("DrizzleUserRepository + authenticateUser", () => {
  it("registers a customer with a hashed password and authenticates with the real password", async () => {
    const repo = new DrizzleUserRepository();
    const email = `auth-test-${Date.now()}@example.com`;

    await registerCustomer(repo, { name: "Auth Test Customer", email, password: "correcthorse" });

    const authenticated = await authenticateUser(repo, email, "correcthorse");
    expect(authenticated?.email).toBe(email);

    const rejected = await authenticateUser(repo, email, "wrongpassword");
    expect(rejected).toBeNull();
  });
});
