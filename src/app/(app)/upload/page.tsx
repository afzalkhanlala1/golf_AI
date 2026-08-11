import { redirect } from "next/navigation";
import { UploadForm } from "@/components/upload-form";
import { PageBody, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "Upload · Grip Intelligence",
};

export default async function UploadPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  return (
    <PageBody>
      <PageHeader
        kicker="Upload"
        title="Film slow. Upload once."
        accent="We read the rest."
        lede="Use your phone's native slow-motion camera, then send the file here. 120fps or higher gives the sharpest read on impact. We never record inside the browser."
      />
      <div className="mt-9 max-w-2xl">
        <UploadForm userId={userId} />
      </div>
    </PageBody>
  );
}
