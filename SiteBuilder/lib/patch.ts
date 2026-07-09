// File: SiteBuilder/lib/patch.ts

function safeStr(v: any, max = 4000) {
  const s = String(v || "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function safeUrl(v: any, max = 600) {
  const s = safeStr(v, max);
  if (!s) return "";
  if (s.startsWith("#")) return s;
  if (s.startsWith("/")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

function safeHex(v: any) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return s;
  return "";
}

function safeThemeMode(v: any): "dark" | "light" {
  return String(v || "").trim().toLowerCase() === "light" ? "light" : "dark";
}

function safeId(v: any, fallbackPrefix = "item") {
  const s = String(v || "").trim();

  if (/^[a-zA-Z0-9_-]{3,80}$/.test(s)) {
    return s;
  }

  return `${fallbackPrefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeMapKey(v: any, fallback: string) {
  const s = String(v || "").trim();

  if (/^[a-zA-Z0-9_-]{1,80}$/.test(s)) {
    return s;
  }

  return fallback;
}

function sanitizeGallery(input: any) {
  const imagesRaw = Array.isArray(input?.images) ? input.images : [];

  const images = imagesRaw
    .slice(0, 60)
    .map((item: any, index: number) => ({
      id: safeId(item?.id, `img_${index}`),
      imageUrl: safeUrl(item?.imageUrl, 600),
      title: safeStr(item?.title, 80),
      caption: safeStr(item?.caption, 240),
      alt: safeStr(item?.alt, 140),
    }))
    .filter((item: any) => item.imageUrl);

  return {
    title: safeStr(input?.title, 80) || "Gallery",
    intro: safeStr(input?.intro, 500),
    images,
  };
}

/**
 * Firestore-safe custom tables.
 *
 * Important:
 * Firestore rejects nested arrays such as string[][].
 *
 * So we do NOT save:
 * customTables: [
 *   {
 *     columns: ["Date", "Start", "End"],
 *     rows: [["Monday", "08AM", "12PM"]]
 *   }
 * ]
 *
 * Instead, we save:
 * customTables: {
 *   order: ["tbl_abc"],
 *   items: {
 *     tbl_abc: {
 *       columnOrder: ["col_0", "col_1", "col_2"],
 *       columns: {
 *         col_0: "Date",
 *         col_1: "Start",
 *         col_2: "End"
 *       },
 *       rowOrder: ["row_0"],
 *       rows: {
 *         row_0: {
 *           id: "row_0",
 *           cells: {
 *             col_0: "Monday",
 *             col_1: "08AM",
 *             col_2: "12PM"
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 */
function sanitizeCustomTables(input: any) {
  const tablesRaw = Array.isArray(input)
    ? input
    : Array.isArray(input?.items)
      ? input.items
      : input && typeof input === "object" && input.items && typeof input.items === "object"
        ? Object.values(input.items)
        : [];

  const order: string[] = [];
  const items: Record<string, any> = {};

  tablesRaw.slice(0, 12).forEach((table: any, tableIndex: number) => {
    const tableId = safeMapKey(safeId(table?.id, `tbl_${tableIndex}`), `tbl_${tableIndex}`);

    const rawColumns = Array.isArray(table?.columns)
      ? table.columns
      : table?.columns && typeof table.columns === "object"
        ? Array.isArray(table?.columnOrder)
          ? table.columnOrder.map((key: string) => table.columns[key])
          : Object.values(table.columns)
        : [];

    const columnOrder: string[] = [];
    const columns: Record<string, string> = {};

    rawColumns.slice(0, 8).forEach((column: any, columnIndex: number) => {
      const value = safeStr(column, 40);
      if (!value) return;

      const columnId = `col_${columnIndex}`;
      columnOrder.push(columnId);
      columns[columnId] = value;
    });

    if (columnOrder.length === 0) {
      columnOrder.push("col_0");
      columns.col_0 = "Column 1";
    }

    const rawRows = Array.isArray(table?.rows)
      ? table.rows
      : table?.rows && typeof table.rows === "object"
        ? Array.isArray(table?.rowOrder)
          ? table.rowOrder.map((key: string) => table.rows[key])
          : Object.values(table.rows)
        : [];

    const rowOrder: string[] = [];
    const rows: Record<string, any> = {};

    rawRows.slice(0, 80).forEach((row: any, rowIndex: number) => {
      const rowId = `row_${rowIndex}`;
      const cells: Record<string, string> = {};

      if (Array.isArray(row)) {
        columnOrder.forEach((columnId, columnIndex) => {
          cells[columnId] = safeStr(row[columnIndex], 120);
        });
      } else if (row?.cells && typeof row.cells === "object") {
        columnOrder.forEach((columnId) => {
          cells[columnId] = safeStr(row.cells[columnId], 120);
        });
      } else if (row && typeof row === "object") {
        columnOrder.forEach((columnId) => {
          cells[columnId] = safeStr(row[columnId], 120);
        });
      } else {
        columnOrder.forEach((columnId) => {
          cells[columnId] = "";
        });
      }

      const hasContent = Object.values(cells).some((value) => safeStr(value));
      if (!hasContent) return;

      rowOrder.push(rowId);
      rows[rowId] = {
        id: rowId,
        cells,
      };
    });

    const title = safeStr(table?.title, 90);
    const intro = safeStr(table?.intro, 500);

    if (!title && rowOrder.length === 0) return;

    order.push(tableId);

    items[tableId] = {
      id: tableId,
      title,
      intro,
      columnOrder,
      columns,
      rowOrder,
      rows,
    };
  });

  return {
    order,
    items,
  };
}

export function sanitizeSitePatch(patch: any) {
  const out: any = {};

  out.published = Boolean(patch?.published);

  out.brand = {
    name: safeStr(patch?.brand?.name, 80),
    logoUrl: safeUrl(patch?.brand?.logoUrl, 600) || null,
    faviconUrl: safeUrl(patch?.brand?.faviconUrl, 600) || null,
  };

  out.theme = {
    accent: safeHex(patch?.theme?.accent) || "#1fe0a5",
    mode: safeThemeMode(patch?.theme?.mode),
  };

  out.seo = {
    title: safeStr(patch?.seo?.title, 90),
    description: safeStr(patch?.seo?.description, 200),
    image: safeUrl(patch?.seo?.image, 600) || null,
  };

  out.hero = {
    headline: safeStr(patch?.hero?.headline, 120),
    subheadline: safeStr(patch?.hero?.subheadline, 400),
    imageUrl: safeUrl(patch?.hero?.imageUrl, 600) || null,
    ctaText: safeStr(patch?.hero?.ctaText, 50),
    ctaHref: safeUrl(patch?.hero?.ctaHref, 600) || "#contact",
  };

  out.sections = {
    about: safeStr(patch?.sections?.about, 6000),
    services: safeStr(patch?.sections?.services, 6000),
    faq: safeStr(patch?.sections?.faq, 6000),
    contact: safeStr(patch?.sections?.contact, 3000),
  };

  out.mediaGallery = sanitizeGallery(patch?.mediaGallery);
  out.customTables = sanitizeCustomTables(patch?.customTables);

  return out;
}
