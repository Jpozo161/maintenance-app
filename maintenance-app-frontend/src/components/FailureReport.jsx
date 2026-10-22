import { useState, useEffect } from "react";
import { getResidenciales, addNewAveria } from "../services/api";

const initialForm = { 
  title: "", 
  residencial_id: "", 
  categoria: "", 
  descripcion: "" 
};

export default function FailureReport({ onToast }) {

  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await getResidenciales();
        const residenciales = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

        if (active) 
          setData(residenciales);

      } catch (err) {
        if (active) {
          setError(`No se pudieron cargar los residenciales: ${err.message}`);
          setData([]);
        }
      }
    };

    load();
    return () => { active = false; };
  }, []);
 
const addingAveria = async () => {
  setError("");
  try {
    await addNewAveria({
      residencial_id: form.residencial_id,
      descripcion: `Asunto: ${form.title.trim()}\n${form.descripcion.trim()}`,
      categoria: form.categoria
    });
    onToast("Avería reportada correctamente");
    setForm(initialForm);
  } catch (err) {
    setError(`No se pudo reportar la avería: ${err.message}`);
  }
}
  
  const [form, setForm] = useState(initialForm);

  const change = event => setForm(
    { ...form, 
      [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    await addingAveria();
  };
  
  return (
  <section className="content">

    <div className="module-head">
      
      <div>
        <p>MANTENIMIENTO</p>
        <h2>Reportar avería</h2>
        <span>Registra daños o fallas para que el equipo de mantenimiento pueda atenderlos.</span>
      </div>

    </div>

    {error && <p className="load-error" role="alert">{error}</p>}

    <div className="report-layout">
      <form className="panel report-form" onSubmit={submit}>
        <h3>Información de la avería</h3>
        <p className="form-note">Completa los datos para crear el reporte.</p>
        <label>
          Asunto
          <input required name="title" value={form.title} onChange={change} placeholder="Ej.: Fuga de agua en baño" />
        </label>

        <div className="form-row">
          <label>
            Residencial
            <select required name="residencial_id" value={form.residencial_id} onChange={change}>
              <option value="" disabled>
                Selecciona un residencial
              </option>

              {data.map((x) => (
                <option key={x.id || x.nombre} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>

          <label>
            Categoría
          <select required name="categoria" value={form.categoria} onChange={change}>
            <option value="" disabled>Selecciona una categoría</option>
            <option>Plomería</option>
            <option>Electricidad</option>
            <option>Infraestructura</option>
            <option>Seguridad</option>
            <option>Otro</option>
          </select>
          </label>
          
        </div>

        <label>
          Descripción
          <textarea required name="descripcion" value={form.descripcion} onChange={change} 
            placeholder="Describe la avería, cuándo ocurrió y cualquier detalle relevante." rows="5" />
        </label>

        <div className="form-actions">
          <button type="button" onClick={() => setForm(initialForm)}>
            Cancelar
          </button>

          <button type="submit">
            Enviar reporte
          </button>

        </div>
      </form>

      <aside className="report-help">
        <span>⚠</span>
        <h3>¿Es una emergencia?</h3>
        <p>Si existe riesgo para personas o instalaciones, comunícate inmediatamente con la portería.</p>
        <strong>Portería: (601) 555 0101</strong>

        <hr />
        <h4>Seguimiento</h4>
        <p>Podrás consultar el estado de tu reporte en la sección de Novedades.</p>
      </aside>
  </div>
</section>);
}
