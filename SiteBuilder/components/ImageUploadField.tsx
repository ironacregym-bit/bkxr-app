// File: SiteBuilder/components/ImageUploadField.tsx
import { useMemo, useState } from "react";

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

      <input
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

      <style jsx>{`
        .iu-field {
          margin-top: 12px;
        }

        .iu-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .iu-input {
          width: 100%;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          padding: 0 12px;
          outline: none;
        }

        .iu-input:focus {
          border-color: rgba(31, 224, 165, 0.55);
          box-shadow: 0 0 0 3px rgba(31, 224, 165, 0.12);
        }

        .iu-actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .iu-uploadBtn {
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.18);
          color: rgba(255, 255, 255, 0.92);
          font-weight: 600;
          cursor: pointer;
          padding: 10px 12px;
          display: inline-flex;
          align-items: center;
        }

        .iu-uploadBtn.is-disabled {
          opacity: 0.7;
          cursor: default;
        }

        .iu-help {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          line-height: 1.35;
        }

        .iu-msg {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 13px;
        }

        .iu-previewWrap {
          margin-top: 10px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(7, 10, 15, 0.45);
        }

        .iu-preview {
          display: block;
          width: 100%;
          max-height: 220px;
          object-fit: cover;
        }
      `}</style>
    </div>
  );
}
``
