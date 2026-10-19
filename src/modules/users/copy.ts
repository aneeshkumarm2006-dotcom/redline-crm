export const staffCopy = {
  add: "Add salesperson", addHint: "They sign in with their email and the temporary password shown next. Share it with them privately.",
  edit: "Edit salesperson", editHint: "Changes apply on their next page load. Deactivated staff are signed out and can’t sign in.",
  fields: {
    name: "Full name", email: "Email", phone: "Phone (optional)", dealership: "Location", monthlyTarget: "Monthly target (units, optional)",
    hiredAt: "Hire date (optional)", active: "Active", activeHint: "Untick to deactivate. Their leads stay assigned until you reassign them.",
  },
  chooseLocation: "Choose a location…", inactiveLocation: "inactive", save: "Save", create: "Create account", saving: "Saving…", close: "Close", done: "Done",
  saved: "Salesperson updated.", created: "Account created.",
  passwordTitle: "Temporary password", passwordHint: "Shown once. Copy it now; it can’t be viewed again.",
  copy: "Copy", copied: "Copied.", copyFailed: "Copy failed. Select the password and copy it manually.",
  invalidForm: "Check the highlighted fields.", networkError: "Unable to save. Check your connection and try again.",
  errors: {
    duplicateEmail: "That email is already used by another account.",
    inactiveLocation: "Choose an active location.",
    notFound: "Salesperson not found.",
    ownerOnly: "Owner access is required. Sign in again if your session expired.",
    failed: "Unable to save the salesperson. Please try again.",
  },
} as const;
