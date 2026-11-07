import { useCallback, useEffect, useState } from "react";
import DataTable from "./DataTable";
import { createVisita, getApartamentos, getResidenciales, getVisitas } from "../services/api";

const documentTypes = [
  { value: "CEDULA", label: "Cédula" },
  { value: "PASAPORTE", label: "Pasaporte" },
];

// Fecha y hora actual de Bogotá en formato de input datetime-local ("YYYY-MM-DDTHH:MM").
const nowInBogota = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const emptyVisit = () => ({
  fecha_visita: nowInBogota(),
  nombre_visitante: "",
  tipo_documento: "CEDULA",
  numero_documento: "",
  residencial_id: "",
  apartamento_id: "",
  motivo: "",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

// fecha_visita llega como "YYYY-MM-DD HH:MM" en hora de Bogotá.
const formatDateTime = (value) => {
  const date = new Date(`${String(value ?? "").replace(" ", "T")}:00-05:00`);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
};

const documentLabel = (visit) =>
  `${documentTypes.find((type) => type.value === visit.tipo_documento)?.label ?? visit.tipo_documento} ${visit.numero_documento}`;

const asList = (data) => Array.isArray(data) ? data : data?.data ?? [];

const apartmentLabel = (apartment) => apartment.tipo ? `${apartment.tipo} ${apartment.nombre}` : apartment.nombre;

export default function VisitsModule({ user }) {
  const isAdmin = user?.role === "ADMIN";
  const isResident = user?.role === "RESIDENTE";
  const isFrontdesk = user?.role === "FRONTDESK";

  const [visits, setVisits] = useState([]);
  const [residenciales, setResidenciales] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [form, setForm] = useState(emptyVisit);
  const [loading, setLoading] = useState(true);
  const [loadingApartments, setLoadingApartments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadVisits = useCallback(async () => setVisits(asList(await getVisitas())), []);

  const loadApartments = useCallback(async (residencialId) => {
    setApartments([]);
    if (!isFrontdesk && !residencialId) return;
    setLoadingApartments(true);
    try {
      setApartments(asList(await getApartamentos(isFrontdesk ? undefined : residencialId)));
    } catch (err) {
      setError(`No se pudieron cargar los apartamentos: ${err.message}`);
    } finally { setLoadingApartments(false); }
  }, [isFrontdesk]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getVisitas(),
      isAdmin ? getResidenciales() : Promise.resolve([]),
    ])
      .then(([visitData, residentialData]) => {
        if (!active) return;
        setVisits(asList(visitData));
        setResidenciales(asList(residentialData));
      })
      .catch((err) => { if (active) setError(err.message || "No se pudieron cargar las visitas."); })
      .finally(() => { if (active) setLoading(false); });
    // Recepción solo trabaja con los apartamentos de su residencial.
    // oxlint-disable-next-line react/set-state-in-effect
    if (isFrontdesk) loadApartments();
    return () => { active = false; };
  }, [isAdmin, isFrontdesk, loadApartments]);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const changeResidencial = (event) => {
    const residencialId = event.target.value;
    setForm({ ...form, residencial_id: residencialId, apartamento_id: "" });
    loadApartments(residencialId);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await createVisita({
        nombre_visitante: form.nombre_visitante.trim(),
        tipo_documento: form.tipo_documento,
        numero_documento: form.numero_documento.trim(),
        motivo: form.motivo.trim(),
        fecha_visita: form.fecha_visita,
        ...(isResident ? {} : {
          apartamento_id: Number(form.apartamento_id),
          ...(isAdmin ? { residencial_id: Number(form.residencial_id) } : {}),
        }),
      });
      // Se conservan residencial y apartamento para registrar varias visitas seguidas.
      setForm({ ...emptyVisit(), residencial_id: form.residencial_id, apartamento_id: form.apartamento_id });
      setNotice("Visita registrada correctamente.");
      await loadVisits();
    } catch (err) {
      setError(`No se pudo registrar la visita: ${err.message}`);
    } finally { setSaving(false); }
  };

  const columns = isResident
    ? ["Fecha y hora", "Visitante", "Documento", "Motivo", "Apartamento", "Registrado por"]
    : ["Fecha y hora", "Visitante", "Documento", "Motivo", "Apartamento", "Registrado por", ...(isAdmin ? ["Residencial"] : [])];

  const rows = visits.map((visit) => ({
    id: visit.id,
    item: visit,
    cells: [
      formatDateTime(visit.fecha_visita),
      visit.nombre_visitante,
      documentLabel(visit),
      visit.motivo,
      visit.apartamento_nombre ? apartmentLabel({ nombre: visit.apartamento_nombre, tipo: visit.apartamento_tipo }) : "—",
      visit.registrado_por_nombre || "—",
      ...(isAdmin ? [visit.residencial_nombre || "—"] : []),
    ],
  }));

  const documentPlaceholder = form.tipo_documento === "PASAPORTE" ? "Ej.: AB123456" : "Ej.: 1023456789";

  return <section className="content">
    <div className="module-head">
      <div>
        <p>{isResident ? "MIS VISITAS" : "CONTROL DE ACCESO"}</p>
        <h2>Gestión de visitas</h2>
        <span>
          {isResident
            ? "Registra a quienes vienen a visitarte y consulta tu historial."
            : isFrontdesk
              ? `Registra las visitas de ${user?.residencial_nombre ?? "tu residencial"}.`
              : "Registra visitas y consulta el historial de todos los residenciales."}
        </span>
      </div>
    </div>

    <form className="panel report-form visit-form" onSubmit={submit}>
      <h3>Registrar visita</h3>
      <p className="form-note">
        {isResident ? "La visita quedará registrada a tu apartamento." : "Completa los datos del visitante y elige el apartamento que visita."}
      </p>

      {error && <p className="load-error" role="alert">{error}</p>}
      {notice && <p className="social-notice" role="status">{notice}</p>}

      <div className="dynamic-fields">
        <div className="visit-field-pair">
          <label htmlFor="visit-name"><span>Nombre del visitante</span>
            <input id="visit-name" name="nombre_visitante" value={form.nombre_visitante} onChange={change} required maxLength={200} placeholder="Ej.: María Pérez" />
          </label>

          {isAdmin && <label htmlFor="visit-residential"><span>Residencial</span>
            <select id="visit-residential" name="residencial_id" value={form.residencial_id} onChange={changeResidencial} required>
              <option value="" disabled>Selecciona un residencial</option>
              {residenciales.map((residencial) => <option key={residencial.id} value={residencial.id}>{residencial.nombre}</option>)}
            </select>
          </label>}

          {isFrontdesk && <label htmlFor="visit-residential"><span>Residencial</span>
            <input id="visit-residential" value={user?.residencial_nombre ?? "Residencial asignado"} readOnly />
          </label>}
        </div>

        <div className="visit-field-pair">
          <label htmlFor="visit-document-type"><span>Tipo de documento</span>
            <select id="visit-document-type" name="tipo_documento" value={form.tipo_documento} onChange={change} required>
              {documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>

          <label htmlFor="visit-document"><span>Número de documento</span>
            <input id="visit-document" name="numero_documento" value={form.numero_documento} onChange={change} required maxLength={50} placeholder={documentPlaceholder} />
          </label>
        </div>

        <label htmlFor="visit-date"><span>Fecha y hora de la visita</span>
          <input id="visit-date" name="fecha_visita" type="datetime-local" value={form.fecha_visita} onChange={change} required />
        </label>

        {!isResident && <label htmlFor="visit-apartment"><span>Apartamento que visita</span>
          <select
            id="visit-apartment"
            name="apartamento_id"
            value={form.apartamento_id}
            onChange={change}
            required
            disabled={loadingApartments || (isAdmin && !form.residencial_id)}>
            <option value="" disabled>
              {loadingApartments
                ? "Cargando apartamentos…"
                : isAdmin && !form.residencial_id
                  ? "Primero elige un residencial"
                  : apartments.length ? "Selecciona un apartamento" : "No hay apartamentos en este residencial"}
            </option>
            {apartments.map((apartment) => <option key={apartment.id} value={apartment.id}>{apartmentLabel(apartment)}</option>)}
          </select>
        </label>}

        <label className="visit-field-wide" htmlFor="visit-reason"><span>Motivo de la visita</span>
          <textarea id="visit-reason" name="motivo" value={form.motivo} onChange={change} required maxLength={255} rows={3} placeholder="Ej.: Visita familiar, entrega de paquete…" />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" onClick={() => setForm({ ...emptyVisit(), residencial_id: form.residencial_id })} disabled={saving}>Limpiar</button>
        <button type="submit" disabled={saving || (!isResident && !form.apartamento_id)}>{saving ? "Registrando…" : "Registrar visita"}</button>
      </div>
    </form>

    <section className="panel">
      <div className="panel-title">
        <div>
          <h3>{isResident ? "Mi historial de visitas" : "Historial de visitas"}</h3>
          <p>{isResident ? "Visitas de tu apartamento." : isFrontdesk ? "Visitas registradas en tu residencial." : "Visitas registradas en todos los residenciales."}</p>
        </div>
      </div>
      {loading ? <p className="table-loading">Cargando visitas…</p> : <DataTable columns={columns} rows={rows} />}
    </section>
  </section>;
}
