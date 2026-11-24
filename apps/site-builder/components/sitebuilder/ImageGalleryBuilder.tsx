import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadField from "./ImageUploadField";

type GalleryImage = {
  id: string;
  imageUrl: string;
  title?: string;
  caption?: string;
  alt?: string;
};

type GalleryValue = {
  title: string;
  intro?: string;
  images: GalleryImage[];
};

type Props = {
  value: GalleryValue;
  onChange: (value: GalleryValue) => void;
};

function makeId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseGallery(value: GalleryValue): GalleryValue {
  return {
    title: String(value?.title || "Gallery"),
    intro: String(value?.intro || ""),
    images: Array.isArray(value?.images) ? value.images : [],
  };
}

function fileNameToTitle(fileName: string) {
  return String(fileName || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ImageGalleryBuilder({ value, onChange }: Props) {
  const gallery = normaliseGallery(value);

  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;

  const canUpload = useMemo(() => Boolean(cloudName && preset), [cloudName, preset]);

  function update(next: Partial<GalleryValue>) {
    onChange({
      ...gallery,
      ...next,
      images: next.images || gallery.images,
    });
  }

  function addImage() {
    update({
      images: [
        ...gallery.images,
        {
          id: makeId(),
          imageUrl: "",
          title: "",
          caption: "",
          alt: "",
        },
      ],
    });
  }

  function updateImage(id: string, patch: Partial<GalleryImage>) {
    update({
      images: gallery.images.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function removeImage(id: string) {
    update({
      images: gallery.images.filter((item) => item.id !== id),
    });
  }

  function moveImage(id: string, direction: "up" | "down") {
    const index = gallery.images.findIndex((item) => item.id === id);
    if (index < 0) return;

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= gallery.images.length) return;

    const next = [...gallery.images];
    const current = next[index];

    next[index] = next[nextIndex];
    next[nextIndex] = current;

    update({ images: next });
  }

  async function uploadOne(file: File): Promise<GalleryImage | null> {
    if (!cloudName || !preset) return null;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", String(preset));
    formData.append("folder", "sitebuilder/gallery");

    const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.secure_url) {
      throw new Error(json?.error?.message || "Upload failed.");
    }

    const altText = fileNameToTitle(file.name);

    return {
      id: makeId(),
      imageUrl: String(json.secure_url),
      title: "",
      caption: "",
      alt: altText,
    };
  }

  async function handleMultiUpload(filesList: FileList | null) {
    const files = Array.from(filesList || []).filter((file) => file.type.startsWith("image/"));

    if (!files.length) return;

    if (!canUpload) {
      setMsg("Upload is not configured yet. Add Cloudinary env vars first.");
      return;
    }

    setUploading(true);
    setMsg(null);

    try {
      const uploaded = await Promise.all(files.map((file) => uploadOne(file)));
      const cleanUploaded = uploaded.filter(Boolean) as GalleryImage[];

      update({
        images: [...gallery.images, ...cleanUploaded],
      });

      setMsg(cleanUploaded.length === 1 ? "1 image uploaded." : `${cleanUploaded.length} images uploaded.`);
      setUploading(false);
    } catch (e: any) {
      setMsg(e?.message || "Upload failed.");
      setUploading(false);
    }
  }

  return (
    <div className="gb-wrap">
      <div className="gb-top">
        <div>
          <div className="gb-title">Image gallery</div>
          <div className="gb-sub">Upload multiple images and they’ll be added to this responsive gallery.</div>
        </div>

        <div className="gb-topActions">
          <label className={`gb-btn ${uploading ? "is-disabled" : ""}`}>
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => {
                handleMultiUpload(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            {uploading ? "Uploading…" : "Upload images"}
          </label>

          <Button type="button" className="gb-secondaryBtn" onClick={addImage} disabled={uploading}>
            Add blank image
          </Button>
        </div>
      </div>

      {msg ? <div className="gb-msg">{msg}</div> : null}

      <div className="gb-field">
        <div className="gb-label">Gallery title</div>
        <Input
          className="gb-input"
          value={gallery.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Gallery"
        />
      </div>

      <div className="gb-field">
        <div className="gb-label">Intro text</div>
        <Textarea
          className="gb-textarea"
          value={gallery.intro || ""}
          onChange={(e) => update({ intro: e.target.value })}
          rows={3}
          placeholder="Optional short intro above the gallery."
        />
      </div>

      {gallery.images.length === 0 ? (
        <div className="gb-empty">No gallery images yet. Upload images or add the first image manually.</div>
      ) : (
        <div className="gb-list">
          {gallery.images.map((item, index) => (
            <div key={item.id} className="gb-item">
              <div className="gb-itemHead">
                <div className="gb-itemTitle">Image {index + 1}</div>

                <div className="gb-itemActions">
                  <Button type="button" className="gb-mini" onClick={() => moveImage(item.id, "up")}>
                    Up
                  </Button>

                  <Button type="button" className="gb-mini" onClick={() => moveImage(item.id, "down")}>
                    Down
                  </Button>

                  <Button type="button" className="gb-danger" onClick={() => removeImage(item.id)}>
                    Remove
                  </Button>
                </div>
              </div>

              <ImageUploadField
                label="Image"
                value={item.imageUrl}
                onChange={(url) => updateImage(item.id, { imageUrl: url })}
                folder="sitebuilder/gallery"
                helpText="Upload a replacement image or paste a public image URL."
              />

              <div className="gb-two">
                <div className="gb-field">
                  <div className="gb-label">Image title</div>
                  <Input
                    className="gb-input"
                    value={item.title || ""}
                    onChange={(e) => updateImage(item.id, { title: e.target.value })}
                    placeholder="Optional title"
                  />
                </div>

                <div className="gb-field">
                  <div className="gb-label">Alt text</div>
                  <Input
                    className="gb-input"
                    value={item.alt || ""}
                    onChange={(e) => updateImage(item.id, { alt: e.target.value })}
                    placeholder="Short description for accessibility"
                  />
                </div>
              </div>

              <div className="gb-field">
                <div className="gb-label">Caption</div>
                <Textarea
                  className="gb-textarea"
                  value={item.caption || ""}
                  onChange={(e) => updateImage(item.id, { caption: e.target.value })}
                  rows={2}
                  placeholder="Optional caption"
                />
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}
