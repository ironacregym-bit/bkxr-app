import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
        fileName: "",
      },
    ]);
  }

  function updateDocument(
    id: string,
    patch: Partial<SiteDocument>
  ) {
    onChange(
      value.map((doc) =>
        doc.id === id ? { ...doc, ...patch } : doc
      )
    );
  }

  function removeDocument(id: string) {
    onChange(value.filter((doc) => doc.id !== id));
  }

  return (
    <div className="db-wrap">
      <div className="db-top">
        <div>
          <div className="db-title">Documents</div>

          <div className="db-sub">
            Upload PDFs, Word documents, Excel files and
            other downloadable resources.
          </div>
        </div>

        <Button
          type="button"
          className="db-btn"
          onClick={addDocument}
        >
          Add document
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="db-empty">
          No documents added yet.
        </div>
      ) : (
        <div className="db-list">
          {value.map((doc, index) => (
            <div
              key={doc.id}
              className="db-card"
            >
              <div className="db-cardHead">
                <div className="db-cardTitle">
                  Document {index + 1}
                </div>

                <Button
                  type="button"
                  className="db-danger"
                  onClick={() =>
                    removeDocument(doc.id)
                  }
                >
                  Remove
                </Button>
              </div>

              <div className="db-two">
                <div className="db-field">
                  <div className="db-label">
                    Document title
                  </div>

                  <Input
                    className="db-input"
                    value={doc.title}
                    onChange={(e) =>
                      updateDocument(doc.id, {
                        title: e.target.value,
                      })
                    }
                    placeholder="Membership Form"
                  />
                </div>

                <div className="db-field">
                  <div className="db-label">
                    Description
                  </div>

                  <Textarea
                    className="db-textarea"
                    rows={3}
                    value={doc.description || ""}
                    onChange={(e) =>
                      updateDocument(doc.id, {
                        description:
                          e.target.value,
                      })
                    }
                    placeholder="Optional description shown on the public site."
                  />
                </div>
              </div>

              <DocumentUploadField
                label="Document"
                value={doc.fileUrl}
                onChange={(url) =>
                  updateDocument(doc.id, {
                    fileUrl: url,
                  })
                }
              />
            </div>
          ))}
        </div>
      )}


    </div>
  );
}
