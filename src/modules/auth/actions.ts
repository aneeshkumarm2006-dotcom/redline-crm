"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authCopy } from "./copy";
import { loginSchema, type LoginState } from "./schema";
import { login, logout, LoginRateLimitError } from "./service";
import { safeReturnTo } from "./routes";

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: authCopy.invalidCredentials };
  try {
    if (!await login(parsed.data)) return { error: authCopy.invalidCredentials };
  } catch (error) {
    return { error: error instanceof LoginRateLimitError ? authCopy.throttled : authCopy.unavailable };
  }
  revalidatePath("/", "layout");
  redirect(safeReturnTo(formData.get("returnTo")));
}
export async function logoutAction(): Promise<LoginState> {
  try { await logout(); }
  catch { return { error: authCopy.signOutFailed }; }
  revalidatePath("/", "layout");
  redirect("/login");
}
