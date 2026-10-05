import { AppShell } from "@/components/layout/AppShell";

// Scoped to (internal) only — no session check yet (Epic 1 has no login at
// all, by product decision). Everything under this route group gets the
// Sidebar; (public) routes (the registration form, Epic 2) will not.
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
