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

        <button
          type="button"
          className="db-btn"
          onClick={addDocument}
        >
          Add document
        </button>
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

                <button
                  type="button"
                  className="db-danger"
                  onClick={() =>
                    removeDocument(doc.id)
                  }
                >
                  Remove
                </button>
              </div>

              <div className="db-two">
                <div className="db-field">
                  <div className="db-label">
                    Document title
                  </div>

                  <input
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

                  <textarea
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

      <style jsx>{`
        .db-wrap {
          margin-top: 12px;
        }

        .db-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .db-title {
          font-weight: 650;
          font-size: 16px;
        }

        .db-sub {
          margin-top: 6px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          line-height: 1.35;
        }

        .db-btn {
          min-height: 40px;
          border-radius: 12px;
          border: none;
          background: #1fe0a5;
          color: #061018;
          font-weight: 650;
          cursor: pointer;
          padding: 9px 12px;
        }

        .db-empty {
          margin-top: 12px;
          border-radius: 14px;
          border: 1px dashed rgba(255,255,255,.14);
          padding: 14px;
          color: rgba(255,255,255,.58);
        }

        .db-list {
          margin-top: 12px;
          display: grid;
          gap: 12px;
        }

        .db-card {
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(7,10,15,.45);
          padding: 16px;
        }

        .db-cardHead {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .db-cardTitle {
          font-weight: 650;
        }

        .db-danger {
          min-height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(255,107,107,.35);
          background: rgba(0,0,0,.2);
          color: #ff8585;
          font-weight: 650;
          cursor: pointer;
          padding: 9px 12px;
        }

        .db-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }

        .db-field {
          margin-top: 8px;
        }

        .db-label {
          color: rgba(255,255,255,.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .db-input,
        .db-textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(7,10,15,.85);
          color: #fff;
          outline: none;
        }

        .db-input {
          min-height: 44px;
          padding: 0 12px;
        }

        .db-textarea {
          padding: 10px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .db-input:focus,
        .db-textarea:focus {
          border-color: rgba(31,224,165,.55);
          box-shadow: 0 0 0 3px rgba(31,224,165,.12);
        }

        @media (max-width: 720px) {
          .db-two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
