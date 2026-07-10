// File: lib/sitebuilder/renderRichText.tsx

import React from "react";

function safeLine(line: string) {
  return String(line || "").trim();
}

export function renderRichText(content?: string): React.ReactNode {
  const text = String(content || "").replace(/\r\n/g, "\n").trim();

  if (!text) return null;

  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];

  let paragraph: string[] = [];
  let bulletList: string[] = [];
  let numberList: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;

    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className="sb-richParagraph"
      >
        {paragraph.join(" ")}
      </p>
    );

    paragraph = [];
  };

  const flushBullets = () => {
    if (!bulletList.length) return;

    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="sb-richList"
      >
        {bulletList.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );

    bulletList = [];
  };

  const flushNumbers = () => {
    if (!numberList.length) return;

    blocks.push(
      <ol
        key={`ol-${blocks.length}`}
        className="sb-richList sb-richNumbered"
      >
        {numberList.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );

    numberList = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushNumbers();
  };

  for (const rawLine of lines) {
    const line = safeLine(rawLine);

    if (!line) {
      flushAll();
      continue;
    }

    if (line.startsWith("### ")) {
      flushAll();

      blocks.push(
        <h4
          key={`h4-${blocks.length}`}
          className="sb-richH4"
        >
          {line.replace(/^###\s+/, "")}
        </h4>
      );

      continue;
    }

    if (line.startsWith("## ")) {
      flushAll();

      blocks.push(
        <h3
          key={`h3-${blocks.length}`}
          className="sb-richH3"
        >
          {line.replace(/^##\s+/, "")}
        </h3>
      );

      continue;
    }

    if (line.startsWith("# ")) {
      flushAll();

      blocks.push(
        <h2
          key={`h2-${blocks.length}`}
          className="sb-richH2"
        >
          {line.replace(/^#\s+/, "")}
        </h2>
      );

      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      flushNumbers();

      bulletList.push(line.replace(/^-\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      flushBullets();

      numberList.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    paragraph.push(line);
  }

  flushAll();

  return <>{blocks}</>;
}
