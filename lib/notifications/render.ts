
export function renderTemplateStrings(
  tpl: { title_template?: string; body_template?: string; url_template?: string; data_template?: any },
  ctx: any
) {
  const render = (s?: string) =>
    (s || "").replace(/{{\s*([^}\s]+)\s*}}/g, (_m, path) => {
      const v = getPath(ctx, String(path));
      return v == null ? "" : String(v);
    });

  const renderData = (obj: any): any => {
    if (obj == null) return obj;
    if (typeof obj === "string") return render(obj);
    if (Array.isArray(obj)) return obj.map((x) => renderData(x));
    if (typeof obj === "object") {
      const out: any = {};
      for (const k of Object.keys(obj)) out[k] = renderData(obj[k]);
      return out;
    }
    return obj;
  };

  return {
    title: render(tpl.title_template),
    body: render(tpl.body_template),
    url: render(tpl.url_template),
    data: renderData(tpl.data_template),
  };
}

function getPath(obj: any, path: string) {
  return path.split(".").reduce((acc: any, key: string) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}
