import { and, eq } from "drizzle-orm";
import type { User, UserRepository, UserRole } from "@workspace/domain/users";
import type { Locale } from "@workspace/domain/shared";
import { db } from "../index";
import { usersTable } from "../schema";

export class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return row ? { ...row, preferredLocale: row.preferredLocale as Locale } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return row ? { ...row, preferredLocale: row.preferredLocale as Locale } : null;
  }

  async listActiveByRole(role: UserRole): Promise<User[]> {
    const rows = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, role), eq(usersTable.isActive, true)));
    return rows.map((row) => ({ ...row, preferredLocale: row.preferredLocale as Locale }));
  }

  async create(user: Omit<User, "id">): Promise<User> {
    const [inserted] = await db.insert(usersTable).values(user).returning();
    return { ...inserted, preferredLocale: inserted.preferredLocale as Locale };
  }

  async update(id: string, data: Partial<Pick<User, "preferredLocale">>): Promise<User> {
    const [updated] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning();
    if (!updated) throw new Error(`User not found: ${id}`);
    return { ...updated, preferredLocale: updated.preferredLocale as Locale };
  }
}
