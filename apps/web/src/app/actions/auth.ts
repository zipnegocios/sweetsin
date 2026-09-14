"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { DrizzleUserRepository } from "@workspace/db/repositories";

export interface SignInInput {
  email: string;
  password: string;
}

export async function signInAction(input: SignInInput): Promise<{ error: string } | { role: string }> {
  try {
    await signIn("credentials", { email: input.email, password: input.password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalid_credentials" };
    }
    throw error;
  }

  const user = await new DrizzleUserRepository().findByEmail(input.email);
  return { role: user?.role ?? "customer" };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
}
