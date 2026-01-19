
// lib/notifications/render.ts
type RenderArgs = {
  title_template?: string;
  body_template?: string;
  url_template?: string;
  data_template?: Record<string, any> | null;
};

function getByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : ""), obj);
}

export function renderTemplateStrings(tpl: RenderArgs, context: Record<string, any>) {
  const ctx = mergeContext(context, tpl.data_template);
  const title = renderOne(tpl.title_template || "", ctx);
  const body = renderOne(tpl.body_template || "", ctx);
  const url = (tpl.url_template ? renderOne(tpl.url_template, ctx) : "") || undefined;
  return { title, body, url, data: ctx };
}

function renderOne(s: string, ctx: Record<string, any>) {
  return (s || "").replace(/{{\s*([^}]+)\s*}}/g, (_, p) => {
    const v = getByPath(ctx, p.trim());
    return v == null ? "" : String(v);
  });
}

function mergeContext(context?: any, data_template?: any) {
  const base = typeof context === "object" && context ? { ...context } : {};
  if (data_template && typeof data_template === "object") return { ...base, ...data_template };
  return base;
}
