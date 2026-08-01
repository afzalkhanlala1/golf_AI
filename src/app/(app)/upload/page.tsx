import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
        Upload
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]">
        Film slow. Upload once.
      </h1>
      <p className="mt-3 max-w-xl text-[color:var(--ink-muted)]">
        Use your phone&apos;s native slow-motion camera, then send the file here. We never record inside the browser.
      </p>
      <div className="mt-10">
        <UploadForm />
      </div>
    </main>
  );
}
