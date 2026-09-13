import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateUser } from "@workspace/domain/users";
import type { UserRole } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await authenticateUser(new DrizzleUserRepository(), email, password);
        if (!user) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Login recién ocurrido: `user` viene de authorize().
        token.role = (user as { role: typeof token.role }).role;
        return token;
      }

      // Request subsecuente: revalidar contra la DB para poder revocar
      // la sesión si el usuario fue desactivado, sin esperar a que
      // expire el JWT (mismo patrón que la revocación vía is_active ya
      // usada para las sesiones de mobile).
      if (!token.sub) return null;
      const dbUser = await new DrizzleUserRepository().findById(token.sub);
      if (!dbUser || !dbUser.isActive) return null;
      token.role = dbUser.role;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as UserRole;
      return session;
    },
  },
});
