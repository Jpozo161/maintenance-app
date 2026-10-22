import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const cellsOf = (row) => Array.isArray(row) ? row : row?.cells ?? [];

export default function DataTable({ columns = [], rows = [], pageSize = 8, renderActions, renderCell }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnFilter, setColumnFilter] = useState("");
  const [openActions, setOpenActions] = useState(null);

  useEffect(() => {
    if (!openActions) return undefined;
    const close = () => setOpenActions(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openActions]);

  const filterOptions = [...new Set(rows.map((row) => 
    String(cellsOf(row).at(-1) ?? "").trim()).filter(Boolean)
  )];

  const filteredRows = rows.filter((row) => {
    const cells = cellsOf(row);
    const query = search.trim().toLocaleLowerCase("es-CO");
    const matchesSearch = cells.some((cell) => 
      String(cell ?? "").toLocaleLowerCase("es-CO").includes(query)
  );
    return matchesSearch && (!columnFilter || String(cells.at(-1) ?? "").trim() === columnFilter);
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const clearFilters = () => {
    setSearch("");
    setColumnFilter("");
    setPage(0);
  };

  return (
    <div className="data-table">

      <div className="table-tools">

        <label className="search">⌕
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Buscar..." aria-label="Buscar en la tabla" />
        </label>
        <button className="filter" type="button" aria-expanded={filterOpen} onClick={() => 
          setFilterOpen((open) => !open)}>☷ Filtrar</button>
      </div>

      {filterOpen && 
        <div className="table-filter">

        <label>{columns.at(-1) ? `Filtrar por ${columns.at(-1).toLowerCase()}` : "Filtrar"}
          <select value={columnFilter} onChange={(event) => 
            { setColumnFilter(event.target.value); setPage(0); 
              }}>
            <option value="">
              Todos
            </option>

            {filterOptions.map((value) => 
            <option key={value} value={value}>
              {value}
            </option>
          )}

          </select>

        </label>

          <button type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
        }

      <div className="table-wrap">

        <table>

          <thead>
            <tr>
              {columns.map((column) => 
              <th key={column}>{column}</th>
              )}
              {renderActions && 
              <th>
                Acciones
              </th>
              }
              </tr>
          </thead>

          <tbody>

            {visibleRows.length ? visibleRows.map((row, index) => {
              const cells = cellsOf(row);
              const key = row?.id ?? `${currentPage}-${index}`;
              const closeActions = () => setOpenActions(null);
              
              return <tr key={key}>
                {columns.map((_, col) => {
                  const customCell = renderCell?.(row, col, cells[col]);
                  const cellValue = cells[col];
                  const isEmail = typeof cellValue === "string"
                    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cellValue.trim());
                  const defaultCell = col === columns.length - 1
                    ? <span className="badge">{cellValue ?? "—"}</span>
                    : cellValue ?? "—";
                  const cellClassName = [col === 0 && "primary-cell", isEmail && "email-cell"]
                    .filter(Boolean)
                    .join(" ") || undefined;
                  return <td key={col} className={cellClassName}>{customCell ?? defaultCell}</td>;
                })}

                {renderActions && 
                <td className="row-actions-cell">
                  <div className="row-actions">
                    <button
                      className="row-actions-trigger"
                      type="button"
                      aria-label="Abrir acciones"
                      aria-haspopup="menu"
                      aria-expanded={openActions?.key === key}
                      title="Acciones"
                      onClick={(event) => {
                        if (openActions?.key === key) { 
                          setOpenActions(null); 
                          return; 
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        setOpenActions({ key, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      }}
                    >
                      ⋯
                    </button>
                    {openActions?.key === key && createPortal(
                      <div className="row-actions-menu" role="menu" style={{ top: openActions.top, right: Math.max(8, openActions.right) }}>
                        {renderActions(row, closeActions)}
                      </div>,
                      document.body
                    )}
                  </div>
                </td>
                }
              </tr>
              ;
            }) : 
            <tr>
              <td className="table-empty" colSpan={columns.length + (renderActions ? 1 : 0)}>
                No hay registros para mostrar.
              </td>
            </tr>
            }
          </tbody>

        </table>

      </div>

      <div className="pagination">

        <span>
          {filteredRows.length ? 
          `Mostrando ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filteredRows.length)} de ${filteredRows.length}` : "0 registros"}
        </span>

        <div>

          <button type="button" onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>
            Anterior
          </button>

          <span>
            Página {currentPage + 1} de {pageCount}
          </span>
          
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1}>
            Siguiente
          </button>

        </div>

      </div>
      
    </div>
  );
}
