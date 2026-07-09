// File: SiteBuilder/components/CustomTableBuilder.tsx

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
          <div className="tb-title">Custom tables</div>
          <div className="tb-sub">
            Add opening times, event dates, pop-up shop days, price lists, class times or anything else that needs rows and columns.
          </div>
        </div>

        <button type="button" className="tb-btn" onClick={addTable}>
          Add table
        </button>
      </div>

      {tables.length === 0 ? (
        <div className="tb-empty">No custom tables yet. Add one for shop open days, events or opening times.</div>
      ) : (
        <div className="tb-list">
          {tables.map((table) => (
            <div key={table.id} className="tb-card">
              <div className="tb-cardHead">
                <div className="tb-cardTitle">Table</div>

                <button type="button" className="tb-danger" onClick={() => removeTable(table.id)}>
                  Remove table
                </button>
              </div>

              <div className="tb-field">
                <div className="tb-label">Table title</div>
                <input
                  className="tb-input"
                  value={table.title}
                  onChange={(e) => updateTable(table.id, { title: e.target.value })}
                  placeholder="Shop Open Days"
                />
              </div>

              <div className="tb-field">
                <div className="tb-label">Intro text</div>
                <textarea
                  className="tb-textarea"
                  value={table.intro || ""}
                  onChange={(e) => updateTable(table.id, { intro: e.target.value })}
                  rows={2}
                  placeholder="Optional text shown above this table."
                />
              </div>

              <div className="tb-columnsHead">
                <div className="tb-label">Columns</div>

                <button type="button" className="tb-mini" onClick={() => addColumn(table)}>
                  Add column
                </button>
              </div>

              <div className="tb-columns">
                {table.columns.map((column, columnIndex) => (
                  <div key={`${table.id}_column_${columnIndex}`} className="tb-columnEditor">
                    <input
                      className="tb-input"
                      value={column}
                      onChange={(e) => updateColumn(table, columnIndex, e.target.value)}
                      placeholder={`Column ${columnIndex + 1}`}
                    />

                    <button
                      type="button"
                      className="tb-smallDanger"
                      disabled={table.columns.length <= 1}
                      onClick={() => removeColumn(table, columnIndex)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="tb-rowsHead">
                <div className="tb-label">Rows</div>

                <button type="button" className="tb-mini" onClick={() => addRow(table)}>
                  Add row
                </button>
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
                              <input
                                className="tb-cellInput"
                                value={row[columnIndex] || ""}
                                onChange={(e) => updateCell(table, rowIndex, columnIndex, e.target.value)}
                                placeholder="Value"
                              />
                            </td>
                          ))}

                          <td className="tb-actionCol">
                            <button type="button" className="tb-rowRemove" onClick={() => removeRow(table, rowIndex)}>
                              Remove
                            </button>
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

      <style jsx>{`
        .tb-wrap {
          margin-top: 12px;
        }

        .tb-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .tb-title {
          font-weight: 650;
          font-size: 16px;
        }

        .tb-sub {
          margin-top: 6px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          line-height: 1.35;
        }

        .tb-btn,
        .tb-mini,
        .tb-danger,
        .tb-smallDanger,
        .tb-rowRemove {
          min-height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.2);
          color: rgba(255, 255, 255, 0.92);
          font-weight: 650;
          cursor: pointer;
          padding: 9px 12px;
          white-space: nowrap;
        }

        .tb-btn {
          background: #1fe0a5;
          color: #061018;
          border: none;
        }

        .tb-danger,
        .tb-smallDanger,
        .tb-rowRemove {
          border-color: rgba(255, 107, 107, 0.35);
          color: #ff8585;
        }

        .tb-smallDanger:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .tb-empty {
          margin-top: 12px;
          border-radius: 14px;
          border: 1px dashed rgba(255, 255, 255, 0.14);
          padding: 14px;
          color: rgba(255, 255, 255, 0.58);
        }

        .tb-list {
          margin-top: 12px;
          display: grid;
          gap: 12px;
        }

        .tb-card {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(7, 10, 15, 0.45);
          padding: 12px;
        }

        .tb-cardHead,
        .tb-columnsHead,
        .tb-rowsHead {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .tb-cardTitle {
          font-weight: 650;
        }

        .tb-field {
          margin-top: 12px;
        }

        .tb-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .tb-input,
        .tb-textarea,
        .tb-cellInput {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          outline: none;
        }

        .tb-input {
          min-height: 44px;
          padding: 0 12px;
        }

        .tb-textarea {
          padding: 10px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .tb-cellInput {
          min-height: 40px;
          padding: 0 10px;
          min-width: 140px;
        }

        .tb-input:focus,
        .tb-textarea:focus,
        .tb-cellInput:focus {
          border-color: rgba(31, 224, 165, 0.55);
          box-shadow: 0 0 0 3px rgba(31, 224, 165, 0.12);
        }

        .tb-columnsHead,
        .tb-rowsHead {
          margin-top: 14px;
        }

        .tb-columns {
          margin-top: 8px;
          display: grid;
          gap: 8px;
        }

        .tb-columnEditor {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .tb-scroll {
          margin-top: 8px;
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .tb-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 560px;
        }

        .tb-table th,
        .tb-table td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px;
          text-align: left;
          vertical-align: middle;
        }

        .tb-table th {
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          font-weight: 650;
          background: rgba(255, 255, 255, 0.03);
        }

        .tb-actionCol {
          width: 1%;
          white-space: nowrap;
        }

        .tb-mutedCell {
          color: rgba(255, 255, 255, 0.52);
          font-size: 13px;
        }

        @media (max-width: 720px) {
          .tb-columnEditor {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
