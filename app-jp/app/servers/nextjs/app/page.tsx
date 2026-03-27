import { redirect } from "next/navigation";

// In SaaS mode all authenticated users land on /dashboard (enforced by middleware).
// This page is kept as a server-side fallback redirect so the open-source
// API-key setup wizard (Home.tsx) is never shown to managed-platform users.
export default function RootPage() {
  redirect("/dashboard");
}
