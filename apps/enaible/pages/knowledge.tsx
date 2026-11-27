import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeDocument } from "@/lib/knowledge-schemas";

export default function KnowledgePage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; excerpt: string }[] | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/knowledge");
      if (response.status === 401) {
        await router.replace("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load knowledge");
      setDocuments(result.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load knowledge");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save document");
      setTitle("");
      setText("");
      setResults(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save document");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this knowledge document?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete document");
      setResults(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete document");
    } finally {
      setSaving(false);
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not search documents");
      setResults(result.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search documents");
    } finally {
      setSaving(false);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt") || file.size > 80000) {
      setError("Choose a plain-text .txt file of no more than 80 KB.");
      return;
    }
    try {
      const contents = await file.text();
      if (contents.includes("\0") || contents.length > 20000) {
        throw new Error("The file must contain at most 20,000 characters of plain text.");
      }
      setTitle(file.name.replace(/\.txt$/i, ""));
      setText(contents);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/" className="text-sm text-primary">Back to dashboard</Link>
      <h1 className="text-3xl font-semibold">Organisation knowledge</h1>
      <p className="text-sm text-muted-foreground">Add text for your active organisation. Do not upload secrets or sensitive personal information.</p>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Add a document</CardTitle><CardDescription>Paste text or select a .txt file. Maximum 20,000 characters per document and 100 documents per organisation.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-4">
            <label className="block text-sm">Plain-text file <input type="file" accept=".txt,text/plain" onChange={(e) => void readFile(e.target.files?.[0])} className="mt-2 block w-full" /></label>
            <label className="block text-sm">Title<Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></label>
            <label className="block text-sm">Content<textarea className="mt-2 min-h-48 w-full rounded-md border border-input bg-background p-3" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} required /></label>
            <Button disabled={saving} type="submit">Save document</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Search knowledge</CardTitle><CardDescription>Simple keyword search; this does not generate or verify answers.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={search} className="flex gap-2">
            <Input aria-label="Search query" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={500} required />
            <Button disabled={saving} type="submit">Search</Button>
          </form>
          {results && results.length === 0 && <p className="text-sm text-muted-foreground">No matching documents.</p>}
          {results?.map((result) => <div key={result.id} className="space-y-1 border-b border-border pb-3"><h2 className="font-medium">{result.title}</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.excerpt}</p></div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
          {documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-4 border-b border-border pb-3"><span>{document.title}</span><Button variant="outline" type="button" disabled={saving} onClick={() => void remove(document.id)}>Delete</Button></div>)}
        </CardContent>
      </Card>
    </main>
  );
}
