import type { User, UserRole } from "./entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listActiveByRole(role: UserRole): Promise<User[]>;
  create(user: Omit<User, "id">): Promise<User>;
}
