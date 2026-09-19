import { describe, it, expect } from "vitest";
import { registerCustomer, listActiveStaff, authenticateUser, updateUserPreferredLocale } from "./use-cases";
import { hashPassword } from "./auth";
import type { User, UserRole } from "./entities";
import type { UserRepository } from "./ports";

function fakeUserRepo(initial: User[] = []): UserRepository & { created: Omit<User, "id">[] } {
  const users = [...initial];
  const created: Omit<User, "id">[] = [];
  return {
    created,
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async listActiveByRole(role: UserRole) {
      return users.filter((u) => u.role === role && u.isActive);
    },
    async create(user) {
      created.push(user);
      const inserted = { ...user, id: `user-${created.length}` };
      users.push(inserted);
      return inserted;
    },
    async update(id, data) {
      const user = users.find((u) => u.id === id);
      if (!user) throw new Error(`User not found: ${id}`);
      Object.assign(user, data);
      return user;
    },
  };
}

describe("registerCustomer", () => {
  it("creates a new customer user", async () => {
    const repo = fakeUserRepo([]);
    const user = await registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com", password: "hunter2", preferredLocale: "en" });

    expect(user.role).toBe("customer");
    expect(user.isActive).toBe(true);
    expect(repo.created).toHaveLength(1);
  });

  it("throws when the email is already registered", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Existing", email: "jane@example.com", role: "customer", pinHash: null, passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    await expect(
      registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com", password: "hunter2", preferredLocale: "en" }),
    ).rejects.toThrow("User already exists with email: jane@example.com");
  });

  it("hashes the password before persisting the new customer", async () => {
    const repo = fakeUserRepo([]);

    const user = await registerCustomer(repo, { name: "New Customer", email: "new@example.com", password: "hunter2", preferredLocale: "en" });

    expect(user.role).toBe("customer");
    expect(repo.created[0].passwordHash).not.toBe("hunter2");
    expect(repo.created[0].passwordHash).not.toBeNull();
  });
});

describe("listActiveStaff", () => {
  it("returns only active users with the given role", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Active Despachador", email: null, role: "despachador", pinHash: "x", passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
      { id: "u2", name: "Inactive Despachador", email: null, role: "despachador", pinHash: "x", passwordHash: null, isActive: false, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
      { id: "u3", name: "Delivery", email: null, role: "delivery", pinHash: "x", passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    const result = await listActiveStaff(repo, "despachador");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });
});

describe("authenticateUser", () => {
  it("returns the user when email and password match an active account", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    const user = await authenticateUser(repo, "jane@sweetsin.com.au", "s3cret!");

    expect(user?.id).toBe("u1");
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    expect(await authenticateUser(repo, "jane@sweetsin.com.au", "wrong")).toBeNull();
  });

  it("returns null for an inactive user even with the correct password", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: false, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    expect(await authenticateUser(repo, "jane@sweetsin.com.au", "s3cret!")).toBeNull();
  });

  it("returns null for a user with no password set (staff PIN accounts)", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Delivery Bot", email: null, role: "delivery", pinHash: "some-pin-hash", passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    expect(await authenticateUser(repo, "unused@example.com", "anything")).toBeNull();
  });

  it("returns null when no user exists with that email", async () => {
    const repo = fakeUserRepo([]);

    expect(await authenticateUser(repo, "nobody@example.com", "anything")).toBeNull();
  });
});

describe("updateUserPreferredLocale", () => {
  it("updates the user's preferred locale", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Doe", email: "jane@example.com", role: "customer", pinHash: null, passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    const updated = await updateUserPreferredLocale(repo, "u1", "es");

    expect(updated.preferredLocale).toBe("es");
  });

  it("throws when the user does not exist", async () => {
    const repo = fakeUserRepo([]);

    await expect(updateUserPreferredLocale(repo, "missing", "es")).rejects.toThrow("User not found: missing");
  });
});

// describe("authenticateStaffByPin", () => {
//   it("rechaza si el usuario no existe", async () => {
//     const repo = makeFakeUserRepo([]);
//     await expect(authenticateStaffByPin(repo, "nadie@sweetsin.com", "123456")).resolves.toBeNull();
//   });
// });
// completado en Task 3
