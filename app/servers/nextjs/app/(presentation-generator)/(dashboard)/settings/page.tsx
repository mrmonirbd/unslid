import { redirect } from "next/navigation";

// The root /settings route redirects to the Account settings sub-page.
// AI model configuration is managed exclusively by platform admins.
export default function SettingsRootPage() {
  redirect("/settings/account");
}
