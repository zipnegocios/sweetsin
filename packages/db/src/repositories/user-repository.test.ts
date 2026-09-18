import { describe, it, expect } from "vitest";
import { authenticateUser, registerCustomer } from "@workspace/domain/users";
import { DrizzleUserRepository } from "./user-repository";

describe("DrizzleUserRepository + authenticateUser", () => {
  it("registers a customer with a hashed password and authenticates with the real password", async () => {
    const repo = new DrizzleUserRepository();
    const email = `auth-test-${Date.now()}@example.com`;

    await registerCustomer(repo, { name: "Auth Test Customer", email, password: "correcthorse", preferredLocale: "en" });

    const authenticated = await authenticateUser(repo, email, "correcthorse");
    expect(authenticated?.email).toBe(email);

    const rejected = await authenticateUser(repo, email, "wrongpassword");
    expect(rejected).toBeNull();
  });
});

describe("update", () => {
  it("updates the preferred locale and returns the updated user", async () => {
    const repo = new DrizzleUserRepository();
    const created = await repo.create({
      name: "Locale Test User",
      email: `locale-test-${Date.now()}@example.com`,
      role: "customer",
      pinHash: null,
      passwordHash: "irrelevant",
      isActive: true,
      preferredLocale: "en",
    });

    const updated = await repo.update(created.id, { preferredLocale: "es" });

    expect(updated.preferredLocale).toBe("es");
  });
});
