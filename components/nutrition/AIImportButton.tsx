"use client";

import { useState } from "react";
import { fileToBase64 } from "../../lib/fileToBase64";

export default function AIImportButton({
  onImported,
}: {
  onImported: (result: any) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    setLoading(true);

    try {
      const imageBase64 = await fileToBase64(file);

      const res = await fetch(
        "/api/nutrition/import-screenshot",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error || "Import failed"
        );
      }

      onImported(json);
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed to analyse screenshot"
      );
    } finally {
      setLoading(false);

      e.target.value = "";
    }
  }

  return (
    <label className="ia-btn ia-btn-outline">
      {loading
        ? "Analysing..."
        : "📷 AI Import"}

      <input
        hidden
        type="file"
        accept="image/*"
        onChange={handleFile}
      />
    </label>
  );
}
