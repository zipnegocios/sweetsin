import { describe, it, expect } from "vitest";
import { registerCustomer, listActiveStaff } from "./use-cases";
import type { User } from "./entities";
import type { UserRepository } from "./ports";

function fakeUserRepo(users: User[]): UserRepository & { created: Omit<User, "id">[] } {
  const created: Omit<User, "id">[] = [];
  return {
    created,
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async listActiveByRole(role) {
      return users.filter((u) => u.role === role && u.isActive);
    },
    async create(user) {
      created.push(user);
      return { ...user, id: `user-${created.length}` };
    },
  };
}

describe("registerCustomer", () => {
  it("creates a new customer user", async () => {
    const repo = fakeUserRepo([]);
    const user = await registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com" });

    expect(user.role).toBe("customer");
    expect(user.isActive).toBe(true);
    expect(repo.created).toHaveLength(1);
  });

  it("throws when the email is already registered", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Existing", email: "jane@example.com", role: "customer", pinHash: null, isActive: true },
    ]);

    await expect(registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com" })).rejects.toThrow(
      "User already exists with email: jane@example.com",
    );
  });
});

describe("listActiveStaff", () => {
  it("returns only active users with the given role", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Active Despachador", email: null, role: "despachador", pinHash: "x", isActive: true },
      { id: "u2", name: "Inactive Despachador", email: null, role: "despachador", pinHash: "x", isActive: false },
      { id: "u3", name: "Delivery", email: null, role: "delivery", pinHash: "x", isActive: true },
    ]);

    const result = await listActiveStaff(repo, "despachador");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });
});
