import { and, eq } from "drizzle-orm";
import type { User, UserRepository, UserRole } from "@workspace/domain/users";
import { db } from "../index";
import { usersTable } from "../schema";

export class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return row ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return row ?? null;
  }

  async listActiveByRole(role: UserRole): Promise<User[]> {
    return db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, role), eq(usersTable.isActive, true)));
  }

  async create(user: Omit<User, "id">): Promise<User> {
    const [inserted] = await db.insert(usersTable).values(user).returning();
    return inserted;
  }
}
