export const viewsCopy = {
  label: "Saved views", save: "Save view", saveTitle: "Save this view", saveHint: "Keeps the current filters and grouping so you can return to them in one tap.",
  name: "View name", namePlaceholder: "e.g. North aging stock", saving: "Saving…", cancel: "Cancel", saved: (name: string) => `View “${name}” saved.`,
  remove: (name: string) => `Delete view ${name}`, removed: "View deleted.", replaceHint: "A view with the same name is replaced.",
  limit: (count: number) => `You can keep up to ${count} views per board. Delete one first.`,
  nothingToSave: "Apply a filter first, then save it as a view.", failed: "The view could not be saved. Try again.", notFound: "That view no longer exists.",
} as const;
