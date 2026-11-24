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
    <div className="tb-wrap">
      <div className="tb-top">
        <div>
          <div className="tb-title">Information tables</div>
          <div className="tb-sub">
            Add opening times, event dates, pop-up shop days, price lists, class times or anything else that needs rows and columns.
          </div>
        </div>

        <Button type="button" className="tb-btn" onClick={addTable}>
          Add table
        </Button>
      </div>

      {tables.length === 0 ? (
        <div className="tb-empty">No custom tables yet. Add one for shop open days, events or opening times.</div>
      ) : (
        <div className="tb-list">
          {tables.map((table) => (
            <div key={table.id} className="tb-card">
              <div className="tb-cardHead">
                <div className="tb-cardTitle">Table</div>

                <Button type="button" className="tb-danger" onClick={() => removeTable(table.id)}>
                  Remove table
                </Button>
              </div>

              <div className="tb-field">
                <div className="tb-label">Table title</div>
                <Input
                  className="tb-input"
                  value={table.title}
                  onChange={(e) => updateTable(table.id, { title: e.target.value })}
                  placeholder="Shop Open Days"
                />
              </div>

              <div className="tb-field">
                <div className="tb-label">Intro text</div>
                <Textarea
                  className="tb-textarea"
                  value={table.intro || ""}
                  onChange={(e) => updateTable(table.id, { intro: e.target.value })}
                  rows={2}
                  placeholder="Optional text shown above this table."
                />
              </div>

              <div className="tb-columnsHead">
                <div className="tb-label">Columns</div>

                <Button type="button" className="tb-mini" onClick={() => addColumn(table)}>
                  Add column
                </Button>
              </div>

              <div className="tb-columns">
                {table.columns.map((column, columnIndex) => (
                  <div key={`${table.id}_column_${columnIndex}`} className="tb-columnEditor">
                    <Input
                      className="tb-input"
                      value={column}
                      onChange={(e) => updateColumn(table, columnIndex, e.target.value)}
                      placeholder={`Column ${columnIndex + 1}`}
                    />

                    <Button
                      type="button"
                      className="tb-smallDanger"
                      disabled={table.columns.length <= 1}
                      onClick={() => removeColumn(table, columnIndex)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="tb-rowsHead">
                <div className="tb-label">Rows</div>

                <Button type="button" className="tb-mini" onClick={() => addRow(table)}>
                  Add row
                </Button>
              </div>

              <div className="tb-scroll">
                <table className="tb-table">
                  <thead>
                    <tr>
                      {table.columns.map((column, columnIndex) => (
                        <th key={`${table.id}_head_${columnIndex}`}>{column || `Column ${columnIndex + 1}`}</th>
                      ))}
                      <th className="tb-actionCol">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {table.rows.length === 0 ? (
                      <tr>
                        <td colSpan={table.columns.length + 1} className="tb-mutedCell">
                          No rows yet.
                        </td>
                      </tr>
                    ) : (
                      table.rows.map((row, rowIndex) => (
                        <tr key={`${table.id}_row_${rowIndex}`}>
                          {table.columns.map((_, columnIndex) => (
                            <td key={`${table.id}_cell_${rowIndex}_${columnIndex}`}>
                              <Input
                                className="tb-cellInput"
                                value={row[columnIndex] || ""}
                                onChange={(e) => updateCell(table, rowIndex, columnIndex, e.target.value)}
                                placeholder="Value"
                              />
                            </td>
                          ))}

                          <td className="tb-actionCol">
                            <Button type="button" className="tb-rowRemove" onClick={() => removeRow(table, rowIndex)}>
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
