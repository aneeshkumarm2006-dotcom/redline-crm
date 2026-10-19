import "server-only";
import { EmailSetupError, appUrlProblem } from "./provider";

/** Only deployment configuration can supply the origin of email links. */
export function emailUrl(path: string) {
  const problem = appUrlProblem();
  if (problem) throw new EmailSetupError(problem);
  const base = new URL(process.env.APP_URL!.trim());
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid email link.");
  return new URL(path, base).href;
}
