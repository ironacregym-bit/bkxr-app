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
        className="mb-4 leading-7 opacity-80 last:mb-0"
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
        className="my-4 list-disc space-y-2 pl-6 leading-7 opacity-80"
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
        className="my-4 list-decimal space-y-2 pl-6 leading-7 opacity-80"
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
          className="mb-2 mt-5 text-base font-semibold"
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
          className="mb-3 mt-6 text-lg font-semibold"
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
          className="mb-4 mt-8 text-2xl font-semibold tracking-tight"
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
