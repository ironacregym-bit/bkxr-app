
// lib/template.ts
export function getByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
}

export function renderString(template: string, context: Record<string, any>) {
  if (!template || typeof template !== "string") return template;
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
    const val = getByPath(context, String(expr).trim());
    return val == null ? "" : String(val);
  });
}

export function renderObjectStrings<T = anyexport function renderObjectStrings<T = any>(obj: T, context: Record<string, any>): T {
  if (obj == null) return obj as T;
  if (typeof obj === "string") return renderString(obj, context) as unknown as T;
  if (Array.isArray(obj)) return obj.map((v) => renderObjectStrings(v, context)) as unknown as T;
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as any)) out[k] = renderObjectStrings(v, context);
    return out as T;
  }
  return obj;
}
