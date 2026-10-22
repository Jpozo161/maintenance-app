import { useEffect, useState } from "react";
import DataTable from "./DataTable";
import { endpoints, headers, asArray, toTableRows, formatDate, formatMoney } from "../data/modules";
import { api, deleteAveria, getAllAverias, updateAveriaStatus } from "../services/api";

const averiaStatuses = ["Reportada", "En proceso", "Completada", "Cancelada"];

export default function Dashboard({ onNavigate, role = "ADMIN" }) {

  const [data, setData] = useState({ 
    propietarios: [], 
    pagos: [], 
    mantenimientos: [], 
    averias: [],
    proximosMantenimientos: [],
    residenciales: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [savingAveriaId, setSavingAveriaId] = useState(null);
  const [averiaActionError, setAveriaActionError] = useState("");
  const [averiaActionNotice, setAveriaActionNotice] = useState("");
  const upcomingPageSize = 5;

  useEffect(() => {

    let active = true;

    const dashboardEndpoints = role === "TECNICO"
      ? { mantenimientos: endpoints.mantenimientos, proximosMantenimientos: endpoints.proximosMantenimientos }
      : endpoints;

    Promise.all(
      Object.keys(dashboardEndpoints).map(async (key) => 
        //esto es para devolver un valor tipo array
      [
        key, 
          asArray(await api(null, key, "GET"))
        ])
      )

      .then((entries) => { 
        if (active) setData((current) => ({ ...current, ...Object.fromEntries(entries) }));
      })
      .catch((err) => { 
        if (active) 
          setError(err.message);
      })
      .finally(() => { 
        if (active) 
          setLoading(false);
      });
        return () => { 
          active = false; 
        };
  }, [role]);
  

  const pagosTotal = (data.pagos ?? []).reduce((sum, payment) => sum + Number(payment.valor ?? payment.monto ?? 0), 0);
  const reloadAverias = async () => {
    const result = await getAllAverias();
    setData((current) => ({ ...current, averias: asArray(result) }));
  };
  const changeAveriaStatus = async (row, estado) => {
    setSavingAveriaId(row.id); setAveriaActionError(""); setAveriaActionNotice("");
    try {
      await updateAveriaStatus(row.id, estado);
      await reloadAverias();
      setAveriaActionNotice(`Estado actualizado a “${estado}”.`);
    } catch (err) { setAveriaActionError(`No se pudo cambiar el estado: ${err.message}`); }
    finally { setSavingAveriaId(null); }
  };
  const removeCompletedAveria = async (row) => {
    if (row.item.estado !== "Completada") return;
    if (!window.confirm("¿Eliminar esta avería completada de la lista? El registro y su historial se conservarán en la base de datos.")) return;
    setAveriaActionError(""); setAveriaActionNotice("");
    try {
      await deleteAveria(row.id);
      await reloadAverias();
      setAveriaActionNotice("Avería eliminada de la lista; su historial quedó conservado.");
    } catch (err) { setAveriaActionError(`No se pudo eliminar la avería: ${err.message}`); }
  };
  const renderAveriaCell = (row, columnIndex) => role === "ADMIN" && columnIndex === 4 ? (
    <select className="maintenance-status-select" aria-label={`Estado de avería ${row.id}`} value={row.item.estado ?? "Reportada"} disabled={savingAveriaId === row.id} onChange={(event) => changeAveriaStatus(row, event.target.value)}>
      {averiaStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
    </select>
  ) : undefined;
  const renderAveriaActions = (row, close) => row.item.estado === "Completada"
    ? <button type="button" role="menuitem" className="danger" onClick={() => { close(); removeCompletedAveria(row); }}>Eliminar</button>
    : <span className="row-action-hint">Eliminar disponible al completar</span>;
  const upcomingMaintenance = [...data.proximosMantenimientos].sort((a, b) => {
    const dateA = new Date(a.fecha_programada ?? a.fecha_programa ?? "").getTime();
    const dateB = new Date(b.fecha_programada ?? b.fecha_programa ?? "").getTime();
    return (Number.isNaN(dateA) ? Infinity : dateA) - (Number.isNaN(dateB) ? Infinity : dateB);
  });
  const upcomingPageCount = Math.max(1, Math.ceil(upcomingMaintenance.length / upcomingPageSize));
  const visibleUpcoming = upcomingMaintenance.slice((upcomingPage - 1) * upcomingPageSize, upcomingPage * upcomingPageSize);
  
  const cards = role === "TECNICO" ? [
    [data.mantenimientos.length, "Mantenimientos asignados", "mantenimientos", "Trabajos asignados a tu usuario"],
    [data.proximosMantenimientos.length, "Próximos asignados", "mantenimientos", "Actividades pendientes asignadas"],
  ] : [
    [data.propietarios.length, "Usuarios", "propietarios", "Registros en la base de datos"],
    [data.residenciales.length, "Unidades", "propietarios", "Residenciales registrados"],
    [formatMoney(pagosTotal), "Recaudo registrado", "pagos", `${data.pagos.length} pagos registrados`],
    [data.mantenimientos.length, "Mantenimientos", "mantenimientos", "Registros en la base de datos"],
  ];

  return (
    <section className="content dashboard-content">
      <div className="welcome">
        <div>
            <h2>Bienvenido, {role === "TECNICO" ? "Técnico" : "Administrador"}</h2>
            <p>Este es el resumen actualizado del conjunto residencial.</p>
        </div>
      </div>

      {error && 
        <p className="load-error" role="alert">
          No se pudo cargar toda la información desde la base de datos: {error}
          </p>
      }
      
      <div className="stats">
        {cards.map(([number, label, view, hint]) => 
        <button className="stat" key={label} onClick={() => onNavigate(view)}>
          <span>{loading ? "…" : number}</span>
          <strong>{label}</strong>
          <small>{hint}</small>
          </button>
        )}
        </div>

      <div className="panel-grid dashboard-grid">
        <section className="panel upcoming-panel">
          <div className="panel-title">
            <div>
              <h3>Próximos mantenimientos</h3>
              <p>Actividades programadas</p>
            </div>

            <button onClick={() => onNavigate("mantenimientos")}>
              Ver todos
            </button>
          </div>

          <div className="activity">
            {loading ? <p>Cargando…</p> : visibleUpcoming.map((m, i) => 
            <p key={m.id ?? i}>
              <b>{(m.fecha_programada ?? m.fecha_programa) ? formatDate(m.fecha_programada ?? m.fecha_programa) : "Por programar"}</b>

                <span>{m.descripcion ?? m.tipo ?? "Mantenimiento"}<small>
                  {m.tipo ?? "Actividad programada"} · {m.nombre_residencial ?? "Sin propiedad asignada"}</small>
                </span>
                
                <em>{m.estado_nombre ?? m.estado ?? "Programado"}</em>

            </p>
            )}

            {!loading && data.proximosMantenimientos.length === 0 && 
              <p>No hay mantenimientos próximos.</p>
            }
          </div>
          {!loading && upcomingMaintenance.length > upcomingPageSize && <div className="dashboard-pagination">
            <span>{upcomingMaintenance.length} mantenimientos · Página {upcomingPage} de {upcomingPageCount}</span>
            <div><button type="button" disabled={upcomingPage === 1} onClick={() => setUpcomingPage((page) => page - 1)}>Anterior</button>
            <button type="button" disabled={upcomingPage === upcomingPageCount} onClick={() => setUpcomingPage((page) => page + 1)}>Siguiente</button></div>
          </div>}
        </section>

        {role !== "TECNICO" && <section className="panel news-panel">

          <div className="panel-title">
            <div>
              <h3>Novedades</h3>
              <p>Reportes recientes registrados</p>
            </div>

            <button onClick={() => onNavigate("averias")}>
              Ver averías
            </button>

          </div>

          {averiaActionError && <p className="load-error" role="alert">{averiaActionError}</p>}
          {averiaActionNotice && <p className="social-notice" role="status">{averiaActionNotice}</p>}
          {loading ? 
            <p className="table-loading">Cargando novedades…</p> : 
            <DataTable 
              columns={headers.novedades} 
              rows={toTableRows("averias", 
              data.averias)} 
              pageSize={5}
              renderCell={role === "ADMIN" ? renderAveriaCell : undefined}
              renderActions={role === "ADMIN" ? renderAveriaActions : undefined} />
          }

        </section>}

      </div>
    </section>
  );
}
