// File: SiteBuilder/components/ImageGalleryBuilder.tsx
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

export default function ImageGalleryBuilder({ value, onChange }: Props) {
  const gallery = normaliseGallery(value);

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

  return (
    <div className="gb-wrap">
      <div className="gb-top">
        <div>
          <div className="gb-title">Image gallery</div>
          <div className="gb-sub">Upload images and they’ll be saved as a responsive gallery for the public site.</div>
        </div>

        <button type="button" className="gb-btn" onClick={addImage}>
          Add image
        </button>
      </div>

      <div className="gb-field">
        <div className="gb-label">Gallery title</div>
        <input
          className="gb-input"
          value={gallery.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Gallery"
        />
      </div>

      <div className="gb-field">
        <div className="gb-label">Intro text</div>
        <textarea
          className="gb-textarea"
          value={gallery.intro || ""}
          onChange={(e) => update({ intro: e.target.value })}
          rows={3}
          placeholder="Optional short intro above the gallery."
        />
      </div>

      {gallery.images.length === 0 ? (
        <div className="gb-empty">No gallery images yet. Add the first image.</div>
      ) : (
        <div className="gb-list">
          {gallery.images.map((item, index) => (
            <div key={item.id} className="gb-item">
              <div className="gb-itemHead">
                <div className="gb-itemTitle">Image {index + 1}</div>

                <div className="gb-itemActions">
                  <button type="button" className="gb-mini" onClick={() => moveImage(item.id, "up")}>
                    Up
                  </button>
                  <button type="button" className="gb-mini" onClick={() => moveImage(item.id, "down")}>
                    Down
                  </button>
                  <button type="button" className="gb-danger" onClick={() => removeImage(item.id)}>
                    Remove
                  </button>
                </div>
              </div>

              <ImageUploadField
                label="Image"
                value={item.imageUrl}
                onChange={(url) => updateImage(item.id, { imageUrl: url })}
                folder="sitebuilder/gallery"
                helpText="Upload a gallery image or paste a public image URL."
              />

              <div className="gb-two">
                <div className="gb-field">
                  <div className="gb-label">Image title</div>
                  <input
                    className="gb-input"
                    value={item.title || ""}
                    onChange={(e) => updateImage(item.id, { title: e.target.value })}
                    placeholder="Optional title"
                  />
                </div>

                <div className="gb-field">
                  <div className="gb-label">Alt text</div>
                  <input
                    className="gb-input"
                    value={item.alt || ""}
                    onChange={(e) => updateImage(item.id, { alt: e.target.value })}
                    placeholder="Short description for accessibility"
                  />
                </div>
              </div>

              <div className="gb-field">
                <div className="gb-label">Caption</div>
                <textarea
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

      <style jsx>{`
        .gb-wrap {
          margin-top: 12px;
        }

        .gb-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .gb-title {
          font-weight: 650;
          font-size: 16px;
        }

        .gb-sub {
          margin-top: 6px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          line-height: 1.35;
        }

        .gb-btn,
        .gb-mini,
        .gb-danger {
          min-height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.2);
          color: rgba(255, 255, 255, 0.92);
          font-weight: 650;
          cursor: pointer;
          padding: 9px 12px;
        }

        .gb-btn {
          background: #1fe0a5;
          color: #061018;
          border: none;
        }

        .gb-danger {
          border-color: rgba(255, 107, 107, 0.35);
          color: #ff8585;
        }

        .gb-field {
          margin-top: 12px;
        }

        .gb-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .gb-input,
        .gb-textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          outline: none;
        }

        .gb-input {
          min-height: 44px;
          padding: 0 12px;
        }

        .gb-textarea {
          padding: 10px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .gb-input:focus,
        .gb-textarea:focus {
          border-color: rgba(31, 224, 165, 0.55);
          box-shadow: 0 0 0 3px rgba(31, 224, 165, 0.12);
        }

        .gb-empty {
          margin-top: 12px;
          border-radius: 14px;
          border: 1px dashed rgba(255, 255, 255, 0.14);
          padding: 14px;
          color: rgba(255, 255, 255, 0.58);
        }

        .gb-list {
          margin-top: 12px;
          display: grid;
          gap: 12px;
        }

        .gb-item {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(7, 10, 15, 0.45);
          padding: 12px;
        }

        .gb-itemHead {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .gb-itemTitle {
          font-weight: 650;
        }

        .gb-itemActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .gb-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 720px) {
          .gb-two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
