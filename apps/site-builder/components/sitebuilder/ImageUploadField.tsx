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
    <div className="iu-field">
      <div className="iu-label">{label}</div>

      <Input
        className="iu-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste image URL or upload below"
      />

      <div className="iu-actions">
        <label className={`iu-uploadBtn ${uploading ? "is-disabled" : ""}`}>
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
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

      {helpText ? <div className="iu-help">{helpText}</div> : null}
      {msg ? <div className="iu-msg">{msg}</div> : null}

      {value ? (
        <div className="iu-previewWrap">
          <img src={value} alt="" className="iu-preview" />
        </div>
      ) : null}


    </div>
  );
}
``
