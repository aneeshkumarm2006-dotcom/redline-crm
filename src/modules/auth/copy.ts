// Module-owned UI copy; components contain presentation only.
export const authCopy = {
  title: "Staff sign in", subtitle: "Sign in with your dealership account.",
  email: "Email address", password: "Password", signIn: "Sign in", signingIn: "Signing in…",
  privateAccess: "Staff access only. Contact your owner if you need an account.",
  invalidCredentials: "Email or password is incorrect.",
  unavailable: "Sign in is temporarily unavailable. Please try again.",
  throttled: "Too many sign-in attempts. Please try again in 15 minutes.",
  loading: "Loading…", signOut: "Sign out", signingOut: "Signing out…",
  signOutFailed: "Could not sign out. Please try again.",
  workspace: "Your workspace", welcome: "You’re signed in and ready to work.",
  team: "Team",
  back: "Back to workspace", active: "Active", inactive: "Inactive",
  deniedTitle: "Owner access required", deniedDescription: "Your account does not have access to this page.",
  roles: { owner: "Owner", salesperson: "Salesperson" },
} as const;
