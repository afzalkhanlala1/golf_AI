import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { PageBody, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "Settings · Grip Intelligence",
};

export default async function SettingsPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  return (
    <PageBody>
      <PageHeader
        kicker="Settings"
        title="Units, language, and your numbers."
        accent="Everything the engine reads about you."
        lede="These feed the fitting engine and the way readings are displayed. Anything left blank is treated as not provided — the engine says so rather than assuming an average."
      />
      <div className="mt-9">
        <SettingsForm />
      </div>
    </PageBody>
  );
}
