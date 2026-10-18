import { useEffect, useState } from "react";
import DataTable from "./DataTable";
import { endpoints, headers, asArray, toTableRows, formatDate } from "../data/modules";
import { api } from "../services/api";

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function Dashboard({ onNavigate }) {

  const [data, setData] = useState({ 
    propietarios: [], 
    pagos: [], 
    mantenimientos: [], 
    averias: [],
    proximosMantenimientos: [] 
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {

    let active = true;

    Promise.all(
      Object.entries(endpoints).map(async ([key]) => 
        //esto es para devolver un valor tipo array
      [
        key, 
          asArray(await api(null, key, "GET"))
        ])
      )

      .then((entries) => { 
        if (active) 
          setData(Object.fromEntries(entries)); 
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
  }, []);
  

  const pagosTotal = data.pagos.reduce((sum, payment) => sum + Number(payment.valor ?? payment.monto ?? 0), 0);
  
  const cards = [
    [data.propietarios.length, "Usuarios", "propietarios", "Registros en la base de datos"],
    ["—", "Unidades", "propietarios", "Información de unidades"],
    [currency.format(pagosTotal), "Recaudo registrado", "pagos", `${data.pagos.length} pagos registrados`],
    [data.mantenimientos.length, "Mantenimientos", "mantenimientos", "Registros en la base de datos"],
  ];

  return (
    <section className="content dashboard-content">
      <div className="welcome">
        <div>
            <h2>Buenos días, Administrador</h2>
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
        <section className="panel">
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
            {loading ? <p>Cargando…</p> : data.proximosMantenimientos.slice(0, 4).map((m, i) => 
            <p key={m.id ?? i}>
              <b>{(m.fecha_programada ?? m.fecha_programa) ? formatDate(m.fecha_programada ?? m.fecha_programa) : "Por programar"}</b>

                <span>{m.descripcion ?? m.tipo ?? "Mantenimiento"}<small>
                  {m.tipo ?? "Actividad programada"}</small>
                </span>
                
                <em>{m.estado ?? m.estado_id ?? "Programado"}</em>

            </p>
            )}

            {!loading && data.proximosMantenimientos.length === 0 && 
              <p>No hay mantenimientos próximos.</p>
            }
          </div>

    </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Pagos recientes</h3>
              <p>
                Últimos movimientos registrados
              </p>
            </div>

            <button onClick={() => onNavigate("pagos")}>Ver pagos</button>
          </div>

          <div className="activity">{loading ? 
            <p>Cargando…</p> : data.pagos.slice(-4).reverse().map((p, i) => <p key={p.id ?? i}>
              <b className="round">{
              String(p.nombre ?? p.propietario ?? "P").split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
              </b>

              <span>
                {p.nombre ?? p.propietario ?? "Propietario"}
                <small>
                  {(p.fecha_creacion ?? p.fecha) ? formatDate(p.fecha_creacion ?? p.fecha) : "Fecha no disponible"}
                </small>

              </span>

              <strong>
                {currency.format(Number(p.valor ?? p.monto ?? 0))}
              </strong>
            </p>
          )}

            {!loading && data.pagos.length === 0 && 
            <p>No hay pagos registrados.</p>}
          </div>

        </section>

        <section className="panel news-panel">

          <div className="panel-title">
            <div>
              <h3>Novedades</h3>
              <p>Reportes recientes registrados</p>
            </div>

            <button onClick={() => onNavigate("averias")}>
              Ver averías
            </button>

          </div>

          {loading ? 
            <p className="table-loading">Cargando novedades…</p> : 
            <DataTable 
              columns={headers.novedades} 
              rows={toTableRows("averias", 
              data.averias)} 
              pageSize={5} />
          }

        </section>

      </div>
    </section>
  );
}
