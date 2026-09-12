import type { UserRepository } from "./ports";
import type { User, UserRole } from "./entities";

export async function listActiveStaff(
  repo: UserRepository,
  role: Exclude<UserRole, "customer">,
): Promise<User[]> {
  return repo.listActiveByRole(role);
}

export async function registerCustomer(
  repo: UserRepository,
  input: { name: string; email: string },
): Promise<User> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);
  return repo.create({ name: input.name, email: input.email, role: "customer", pinHash: null, isActive: true });
}
