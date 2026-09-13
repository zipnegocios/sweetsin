import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@workspace/domain/users";

// Config edge-safe: sin providers ni callbacks que toquen la DB (pg usa el
// módulo `crypto` de Node, no soportado en el Edge Runtime donde corre el
// middleware). El provider Credentials y la revalidación de is_active vía
// DB viven en auth.ts, que solo se usa en Route Handlers/Server
// Components/Server Actions (runtime Node.js).
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: typeof token.role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as UserRole;
      return session;
    },
  },
};
