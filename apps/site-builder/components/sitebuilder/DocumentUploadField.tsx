// DocumentUploadField.tsx
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
};

export default function DocumentUploadField({
  label,
  value,
  onChange,
  folder = "sitebuilder/documents",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;

  const canUpload = useMemo(
    () => Boolean(cloudName && preset),
    [cloudName, preset]
  );

  async function handleFile(file: File) {
    if (!canUpload) {
      setMsg("Document uploads are not configured. Paste a public file URL instead.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("upload_preset", String(preset));
      formData.append("folder", folder);

      const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await resp.json().catch(() => null);

      if (!resp.ok || !json?.secure_url) {
        throw new Error("Upload failed");
      }

      onChange(json.secure_url);
      setMsg("Uploaded");
    } catch {
      setMsg("Upload failed");
    }

    setUploading(false);
  }

  return (
    <div className="space-y-2 text-sm font-medium">
      <div>{label}</div>

      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste a public document URL" />

      <label className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/70 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            handleFile(file);
            e.currentTarget.value = "";
          }}
        />

        {uploading ? "Uploading…" : "Upload document"}
      </label>

      {msg && <div role="status" className="text-xs font-normal text-muted-foreground">{msg}</div>}
    </div>
  );
}
