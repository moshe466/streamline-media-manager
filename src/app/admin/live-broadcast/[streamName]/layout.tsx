
import type { ReactNode } from "react";

// This layout is now handled by the parent /admin/live-broadcast/layout.tsx
// It just passes children through.
export default function BroadcastStreamLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
