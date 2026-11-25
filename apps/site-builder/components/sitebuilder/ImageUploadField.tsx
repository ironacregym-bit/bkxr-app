import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  helpText?: string;
};

export default function ImageUploadField(props: Props) {
  const { label, value, onChange, folder = "sitebuilder", helpText } = props;

  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;

  const canUpload = useMemo(() => Boolean(cloudName && preset), [cloudName, preset]);

  async function handleFile(file: File) {
    if (!canUpload) {
      setMsg("Upload is not configured yet. Add Cloudinary env vars or paste an image URL manually.");
      return;
    }

    setUploading(true);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", String(preset));
      formData.append("folder", folder);

      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      const json = await resp.json();

      if (!resp.ok || !json?.secure_url) {
        setMsg(json?.error?.message || "Upload failed.");
        setUploading(false);
        return;
      }

      onChange(String(json.secure_url));
      setMsg("Uploaded.");
      setUploading(false);
    } catch {
      setMsg("Upload failed.");
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 text-sm font-medium">
      <div>{label}</div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste image URL or upload below"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/70 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              handleFile(file);
              e.currentTarget.value = "";
            }}
          />
          {uploading ? "Uploading…" : "Upload image"}
        </label>
      </div>

      {helpText ? <div className="text-xs font-normal leading-relaxed text-muted-foreground">{helpText}</div> : null}
      {msg ? <div role="status" className="text-xs font-normal text-muted-foreground">{msg}</div> : null}

      {value ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <img src={value} alt="" className="max-h-64 w-full object-contain" />
        </div>
      ) : null}


    </div>
  );
}
``
