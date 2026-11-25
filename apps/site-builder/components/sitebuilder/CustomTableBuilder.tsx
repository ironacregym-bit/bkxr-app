import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CustomTable = {
  id: string;
  title: string;
  intro?: string;
  columns: string[];
  rows: string[][];
};

type Props = {
  value: CustomTable[];
  onChange: (value: CustomTable[]) => void;
};

function makeId() {
  return `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseTables(value: CustomTable[]) {
  return Array.isArray(value) ? value : [];
}

function makeEmptyRow(columns: string[]) {
  return columns.map(() => "");
}

export default function CustomTableBuilder({ value, onChange }: Props) {
  const tables = normaliseTables(value);

  function updateTables(next: CustomTable[]) {
    onChange(next);
  }

  function addTable() {
    updateTables([
      ...tables,
      {
        id: makeId(),
        title: "Shop Open Days",
        intro: "",
        columns: ["Date", "Start", "End"],
        rows: [["Monday 13th July 2026", "08AM", "12PM"]],
      },
    ]);
  }

  function updateTable(id: string, patch: Partial<CustomTable>) {
    updateTables(tables.map((table) => (table.id === id ? { ...table, ...patch } : table)));
  }

  function removeTable(id: string) {
    updateTables(tables.filter((table) => table.id !== id));
  }

  function updateColumn(table: CustomTable, columnIndex: number, value: string) {
    const columns = table.columns.map((column, index) => (index === columnIndex ? value : column));
    updateTable(table.id, { columns });
  }

  function addColumn(table: CustomTable) {
    const columns = [...table.columns, `Column ${table.columns.length + 1}`];
    const rows = table.rows.map((row) => [...row, ""]);
    updateTable(table.id, { columns, rows });
  }

  function removeColumn(table: CustomTable, columnIndex: number) {
    if (table.columns.length <= 1) return;

    const columns = table.columns.filter((_, index) => index !== columnIndex);
    const rows = table.rows.map((row) => row.filter((_, index) => index !== columnIndex));

    updateTable(table.id, { columns, rows });
  }

  function addRow(table: CustomTable) {
    updateTable(table.id, {
      rows: [...table.rows, makeEmptyRow(table.columns)],
    });
  }

  function removeRow(table: CustomTable, rowIndex: number) {
    updateTable(table.id, {
      rows: table.rows.filter((_, index) => index !== rowIndex),
    });
  }

  function updateCell(table: CustomTable, rowIndex: number, columnIndex: number, value: string) {
    const rows = table.rows.map((row, rIndex) => {
      if (rIndex !== rowIndex) return row;

      return table.columns.map((_, cIndex) => (cIndex === columnIndex ? value : row[cIndex] || ""));
    });

    updateTable(table.id, { rows });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Information tables</div>
          <div className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add opening times, event dates, pop-up shop days, price lists, class times or anything else that needs rows and columns.
          </div>
        </div>

        <Button type="button" onClick={addTable}>
          Add table
        </Button>
      </div>

      {tables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No custom tables yet. Add one for shop open days, events or opening times.
        </div>
      ) : (
        <div className="space-y-4">
          {tables.map((table) => (
            <div key={table.id} className="space-y-5 rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold">Table</div>

                <Button type="button" variant="destructive" size="sm" onClick={() => removeTable(table.id)}>
                  Remove table
                </Button>
              </div>

              <div className="grid gap-2 text-sm font-medium">
                <div>Table title</div>
                <Input
                  value={table.title}
                  onChange={(e) => updateTable(table.id, { title: e.target.value })}
                  placeholder="Shop Open Days"
                />
              </div>

              <div className="grid gap-2 text-sm font-medium">
                <div>Intro text</div>
                <Textarea
                  value={table.intro || ""}
                  onChange={(e) => updateTable(table.id, { intro: e.target.value })}
                  rows={2}
                  placeholder="Optional text shown above this table."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">Columns</div>

                <Button type="button" variant="outline" size="sm" onClick={() => addColumn(table)}>
                  Add column
                </Button>
              </div>

              <div className="grid gap-2">
                {table.columns.map((column, columnIndex) => (
                  <div key={`${table.id}_column_${columnIndex}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Input
                      value={column}
                      onChange={(e) => updateColumn(table, columnIndex, e.target.value)}
                      placeholder={`Column ${columnIndex + 1}`}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={table.columns.length <= 1}
                      onClick={() => removeColumn(table, columnIndex)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">Rows</div>

                <Button type="button" variant="outline" size="sm" onClick={() => addRow(table)}>
                  Add row
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {table.columns.map((column, columnIndex) => (
                        <th key={`${table.id}_head_${columnIndex}`} className="px-3 py-2 text-left font-semibold">{column || `Column ${columnIndex + 1}`}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {table.rows.length === 0 ? (
                      <tr>
                        <td colSpan={table.columns.length + 1} className="px-3 py-4 text-center text-muted-foreground">
                          No rows yet.
                        </td>
                      </tr>
                    ) : (
                      table.rows.map((row, rowIndex) => (
                        <tr key={`${table.id}_row_${rowIndex}`} className="border-b border-border last:border-0">
                          {table.columns.map((_, columnIndex) => (
                            <td key={`${table.id}_cell_${rowIndex}_${columnIndex}`} className="p-2">
                              <Input
                                value={row[columnIndex] || ""}
                                onChange={(e) => updateCell(table, rowIndex, columnIndex, e.target.value)}
                                placeholder="Value"
                              />
                            </td>
                          ))}

                          <td className="px-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(table, rowIndex)}>
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}
