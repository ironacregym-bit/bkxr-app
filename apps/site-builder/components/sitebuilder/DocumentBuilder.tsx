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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Documents</div>

          <div className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Upload PDFs, Word documents, Excel files and
            other downloadable resources.
          </div>
        </div>

        <Button
          type="button"
          onClick={addDocument}
        >
          Add document
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No documents added yet.
        </div>
      ) : (
        <div className="space-y-4">
          {value.map((doc, index) => (
            <div
              key={doc.id}
              className="space-y-5 rounded-xl border border-border bg-muted/20 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold">
                  Document {index + 1}
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    removeDocument(doc.id)
                  }
                >
                  Remove
                </Button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid content-start gap-2 text-sm font-medium">
                  <div>
                    Document title
                  </div>

                  <Input
                    value={doc.title}
                    onChange={(e) =>
                      updateDocument(doc.id, {
                        title: e.target.value,
                      })
                    }
                    placeholder="Membership Form"
                  />
                </div>

                <div className="grid content-start gap-2 text-sm font-medium">
                  <div>
                    Description
                  </div>

                  <Textarea
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
