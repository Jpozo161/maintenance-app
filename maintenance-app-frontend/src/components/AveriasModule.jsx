import { useEffect, useState } from "react";
import { headers, toTableRows } from "../data/modules";
import { getAllAverias } from "../services/api";
import DataTable from "./DataTable";

export default function AveriasModule() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAllAverias()
      .then((data) => { if (active) setRows(toTableRows("averias", data)); })
      .catch((err) => { if (active) { setError(err.message); setRows([]); } });
    return () => { active = false; };
  }, []);

  return <section className="content">
    <div className="module-head">
      <div><p>CONSULTA</p><h2>Averías</h2><span>Consulta los reportes registrados en el conjunto.</span></div>
    </div>
    <section className="panel">
      {error && <p className="load-error" role="alert">No se pudieron cargar las averías: {error}</p>}
      {rows === null ? <p className="table-loading">Cargando averías…</p> : <DataTable columns={headers.novedades} rows={rows} />}
    </section>
  </section>;
}
