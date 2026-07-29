import DocumentUploadField from "./DocumentUploadField";

type SiteDocument = {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName?: string;
};

type Props = {
  value: SiteDocument[];
  onChange: (value: SiteDocument[]) => void;
};

function makeId() {
  return `doc_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function DocumentBuilder({
  value,
  onChange,
}: Props) {
  function addDocument() {
    onChange([
      ...value,
      {
        id: makeId(),
        title: "",
        description: "",
        fileUrl: "",
      },
    ]);
  }

  function updateDocument(
    id: string,
    patch: Partial<SiteDocument>
  ) {
    onChange(
      value.map((item) =>
        item.id === id
          ? { ...item, ...patch }
          : item
      )
    );
  }

  function removeDocument(id: string) {
    onChange(value.filter((x) => x.id !== id));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3>Documents</h3>

        <button
          type="button"
          onClick={addDocument}
        >
          Add document
        </button>
      </div>

      {value.map((doc) => (
        <div
          key={doc.id}
          style={{
            padding: 16,
            marginBottom: 16,
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 12,
          }}
        >
          <input
            value={doc.title}
            placeholder="Document title"
            onChange={(e) =>
              updateDocument(doc.id, {
                title: e.target.value,
              })
            }
          />

          <textarea
            value={doc.description || ""}
            placeholder="Description"
            onChange={(e) =>
              updateDocument(doc.id, {
                description: e.target.value,
              })
            }
          />

          <DocumentUploadField
            label="Document"
            value={doc.fileUrl}
            onChange={(url) =>
              updateDocument(doc.id, {
                fileUrl: url,
              })
            }
          />

          <button
            type="button"
            onClick={() =>
              removeDocument(doc.id)
            }
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
