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
      failedPinAttempts: 0,
      pinLockedUntil: null,
    });

    const updated = await repo.update(created.id, { preferredLocale: "es" });

    expect(updated.preferredLocale).toBe("es");
  });
});

describe("recordFailedPinAttempt / resetPinAttempts", () => {
  it("incrementa el contador y setea el lock", async () => {
    const repo = new DrizzleUserRepository();
    const user = await repo.create({
      name: "Test Staff",
      email: `staff-${Date.now()}@sweetsin.test`,
      role: "despachador",
      pinHash: "hash",
      passwordHash: null,
      isActive: true,
      preferredLocale: "es",
      failedPinAttempts: 0,
      pinLockedUntil: null,
    });

    const lockedUntil = new Date(Date.now() + 60_000);
    await repo.recordFailedPinAttempt(user.id, lockedUntil);

    const found = await repo.findById(user.id);
    expect(found?.failedPinAttempts).toBe(1);
    expect(found?.pinLockedUntil?.getTime()).toBeCloseTo(lockedUntil.getTime(), -2);

    await repo.resetPinAttempts(user.id);
    const reset = await repo.findById(user.id);
    expect(reset?.failedPinAttempts).toBe(0);
    expect(reset?.pinLockedUntil).toBeNull();
  });
});
