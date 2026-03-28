"use client";

import { createContext, useContext } from "react";

type WorkspaceIdentityValue = {
  email?: string | null;
  name?: string | null;
};

const WorkspaceIdentityContext = createContext<WorkspaceIdentityValue>({});

export function WorkspaceIdentityProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceIdentityValue;
}) {
  return (
    <WorkspaceIdentityContext.Provider value={value}>
      {children}
    </WorkspaceIdentityContext.Provider>
  );
}

export function useWorkspaceIdentity() {
  return useContext(WorkspaceIdentityContext);
}
