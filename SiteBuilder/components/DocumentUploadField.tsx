// DocumentUploadField.tsx
import { useMemo, useState } from "react";

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
    if (!canUpload) return;

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

      const json = await resp.json();

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
    <div>
      <div>{label}</div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            handleFile(file);
          }}
        />

        {uploading ? "Uploading..." : "Upload document"}
      </label>

      {msg && <div>{msg}</div>}
    </div>
  );
}
