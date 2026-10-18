import { useEffect, useState } from "react";
import { api, getResidenciales, getRoles } from "../services/api";

const socket = new WebSocket("ws://localhost:8080");

socket.onopen = () => {
  console.log("WebSocket conectado");
};

export default function Form({ showToast, type }) {

  const [form, setForm] = useState({});
  const [residenciales, setresidenciales] = useState([]);
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  //___________________________UseEffect

  //Llamo a la api para ponerle la informacion al Acordeon del reporte
  useEffect(() => {
     const getUnidades = async () => {

    try {

      const resultado = await getResidenciales();

      setresidenciales(resultado);

    } catch (error) {

      console.log(error);

    }

  };

  getUnidades();
  if (type === "propietarios") {
    getRoles().then((result) => setRoles(Array.isArray(result) ? result : result?.data ?? []))
      .catch((error) => console.error("No se pudieron cargar los roles", error));
  }

}, [type]);

  //_____________________________________________________

  const change = event =>
    setForm({ ...form, [event.target.name]: event.target.value });

  
  
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(form, type);
      showToast(type === "propietarios" ? "Usuario registrado correctamente" : "Registro guardado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  };


  const nameConfig = {
    usuario: {
      Title: "Registrar mantenimiento",
      Subtitle: "Reportar avería",
      Fields: [
        { name: "residencial", label: "Residencial" },
        { name: "role", label: "Role" },
        { name: "nombre", label: "Nombre" },
        { name: "email", label: "Email" },
        { name: "password", label: "Contrsena" }
      ]
    },

    pagos: {
      Title: "Registrar Pagos",
      Subtitle: "Reportar Pagos",
      Fields: [
        { name: "Propietario", label: "Propietario" },
        { name: "Monto", label: "Monto" },
        { name: "Fecha", label: "Fecha" },

      ]
    },

    propietarios: {
      Title: "Registrar usuario",
      Subtitle: "Crear usuario",
      Fields: [
        { name: "nombre", label: "Nombre" },
        { name: "email", label: "Email" },
        { name: "contrasena", label: "Password" },
        { name: "residencial", label: "unidadad" }
      ]
    },

    mantenimientos: {
      Title: "Reportar Mantenimiento",
      Subtitle: "Avisar de Mantenimiento",
      Fields: [
        { name: "residencial", label: "Residencial" },
        { name: "role", label: "Role" },
        { name: "nombre", label: "Nombre" }
      ]
    }
  }[type];


  return (
    <section className="content">

      <div className="module-head">

        <div>
          <p>
            {nameConfig.Title}
          </p>

          <h2>{nameConfig.Subtitle}</h2>

          <span>
            Registra daños o fallas para que el equipo de mantenimiento pueda atenderlos.
          </span>
        </div>

      </div>


      <div className="report-layout">

        <form className="panel report-form" onSubmit={submit}>

          <h3>{}</h3>

          <p className="form-note">
            Completa los datos
          </p>


          {error && <p className="load-error" role="alert">{error}</p>}
          <div className="dynamic-fields">
            {nameConfig.Fields.map((field) => (
              <label key={field.name} htmlFor={`field-${field.name}`}>

                <span>{field.label}</span>
                {field.name === "residencial" ? (
                  <select id={`field-${field.name}`} 
                    name="residencial_id"
                    required={type === "propietarios" && roles.some((role) => String(role.id) === String(form.role) && role.nombre.toUpperCase() === "RESIDENTE")}
                    onChange={change} 
                    value={form.residencial_id || ""}>

                    <option value="">Seleccione una unidad</option>
                    {residenciales.map((unidad) => 
                    <option key={unidad.id} 
                    value={unidad.id}>

                    {unidad.nombre}</option>)}
                  </select>
                ) : (

                  <input id={`field-${field.name}`} 
                    required name={field.name} type={field.name === "contrasena" ? "password" : "text"} 
                    onChange={change} 
                    value={form[field.name] || ""} 
                    placeholder="Ej.: Fuga de agua en baño" />
                )}
                  </label>
              ))}
          </div>


          {
            type === "pagos" ? (
              ""
            ) : type === "mantenimientos" ? (
              ""
            ) : (

              <label htmlFor="field-role">

                Tipo de rol

                <select
                  id="field-role"
                  name="role"
                  value={form.role ?? ""}
                  onChange={change}
                  required
                >
                  <option value="" disabled>Selecciona un rol</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}
                </select>

              </label>

            )
          }


          <div className="form-actions">

            <button
              type="button"
              onClick={() => showToast("Reporte cancelado")}
            >
              Cancelar
            </button>


            <button
              type="submit"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Enviar"}
            </button>

          </div>

        </form>


        <aside className="report-help">

          <span>⚠</span>

          <h3>
            ¿Es una emergencia?
          </h3>

          <p>
            Si existe riesgo para personas o instalaciones,
            comunícate inmediatamente con la portería.
          </p>

          <strong>
            Portería: (601) 555 0101
          </strong>

          <hr />

          <h4>
            Seguimiento
          </h4>

          <p>
            Podrás consultar el estado de tu reporte
            en la sección de Novedades.
          </p>

        </aside>

      </div>

    </section>
  );
}
