export function getWorkspaceLabel(name?: string | null, email?: string | null) {
  const rawLabel = name?.trim() || email?.split("@")[0]?.trim();
  if (!rawLabel) {
    return "Workspace";
  }

  return `${rawLabel}'s Workspace`;
}
