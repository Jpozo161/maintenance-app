import { useEffect, useMemo, useRef, useState } from "react";

import { maintenanceLabel, maintenanceNumber } from "../data/modules";

// Selector de mantenimiento con buscador. Con cientos de mantenimientos un <select> es
// inmanejable, así que el botón abre un cuadro pequeño donde se filtra por el número del
// mantenimiento (su id, escrito como #12) o por actividad, descripción, propiedad y estado.
const MAX_RESULTS = 40;

const normalize = (value) => String(value ?? "").toLocaleLowerCase("es-DO");

const searchableFields = (item) =>
  [item.tipo, item.descripcion, item.nombre_residencial, item.estado_nombre, item.tecnico_nombre];

export default function MaintenancePicker({ maintenances, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const selected = maintenances.find((item) => String(item.id) === String(value)) ?? null;

  // Cerrar al hacer clic fuera o con Escape; el foco entra directo al buscador.
  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const clickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const keyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", clickOutside);
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("mousedown", clickOutside);
      document.removeEventListener("keydown", keyDown);
    };
  }, [open]);

  const results = useMemo(() => {
    const raw = query.trim().replace(/^#/, "");
    if (!raw) return maintenances;
    const text = normalize(raw);
    const byNumber = /^\d+$/.test(raw) ? (item) => String(item.id).startsWith(raw) : () => false;
    const byText = (item) => searchableFields(item).some((field) => normalize(field).includes(text));
    return maintenances
      .filter((item) => byNumber(item) || byText(item))
      .sort((a, b) => Number(byNumber(b)) - Number(byNumber(a)));
  }, [maintenances, query]);

  const visible = results.slice(0, MAX_RESULTS);

  const pick = (item) => {
    onChange(String(item.id));
    setQuery("");
    setOpen(false);
  };

  const toggle = () => {
    if (disabled) return;
    setQuery("");
    setOpen((isOpen) => !isOpen);
  };

  // Enter en el buscador elige el primer resultado en lugar de enviar el formulario.
  const searchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (visible.length) pick(visible[0]);
  };

  return <div className="maintenance-picker" ref={containerRef}>
    <button
      type="button"
      className="maintenance-picker-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      disabled={disabled}
      onClick={toggle}>
      <span>{selected ? maintenanceLabel(selected) : "Selecciona un mantenimiento"}</span>
      <span aria-hidden="true">⌕</span>
    </button>

    {open && <div className="maintenance-picker-popover" role="dialog" aria-label="Buscar mantenimiento">
      <label className="maintenance-picker-search">⌕
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Número de mantenimiento (#12), actividad o propiedad"
          aria-label="Buscar mantenimiento por número"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={searchKeyDown} />
      </label>

      <ul className="maintenance-picker-list">
        {visible.map((item) => <li key={item.id}>
          <button
            type="button"
            className={String(item.id) === String(value) ? "is-selected" : undefined}
            onClick={() => pick(item)}>
            <strong>{maintenanceNumber(item.id)}</strong>
            <span>{item.tipo || item.descripcion || "Mantenimiento"}</span>
            <small>{[item.nombre_residencial, item.estado_nombre].filter(Boolean).join(" · ") || "—"}</small>
          </button>
        </li>)}
        {!visible.length && <li className="maintenance-picker-empty">No hay mantenimientos con ese número.</li>}
      </ul>

      {results.length > visible.length
        && <p className="maintenance-picker-note">
          Mostrando {visible.length} de {results.length}. Escribe el número para encontrarlo.
        </p>}
    </div>}
  </div>;
}
