import { useEffect, useState } from "react";
import { api, getApartamentos, getResidenciales, getRoles } from "../services/api";

export default function Form({ showToast, type }) {

  const [form, setForm] = useState({});
  const [residenciales, setresidenciales] = useState([]);
  const [roles, setRoles] = useState([]);
  const [apartamentos, setApartamentos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedRole = roles.find((role) => String(role.id) === String(form.role));
  // Residentes y recepción (FRONTDESK) quedan asignados a un residencial.
  const isResidentRole = type === "propietarios"
    && ["RESIDENTE", "FRONTDESK"].includes(String(selectedRole?.nombre ?? "").trim().toUpperCase());
  // El apartamento se asigna a residentes y a pagos; depende del residencial elegido.
  const usesApartamento = type === "pagos"
    || (type === "propietarios" && String(selectedRole?.nombre ?? "").trim().toUpperCase() === "RESIDENTE");


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

  useEffect(() => {
    if (!usesApartamento || !form.residencial_id) return undefined;
    let active = true;
    getApartamentos(form.residencial_id)
      .then((result) => { if (active) setApartamentos(Array.isArray(result) ? result : result?.data ?? []); })
      .catch((error) => console.error("No se pudieron cargar los apartamentos", error));
    return () => { active = false; };
  }, [usesApartamento, form.residencial_id]);

  //_____________________________________________________

  // Al cambiar de residencial se limpia el apartamento, porque pertenece al residencial anterior.
  const change = event => {
    const { name, value } = event.target;
    if (name === "residencial_id") setApartamentos([]);
    setForm({ ...form, [name]: value, ...(name === "residencial_id" ? { apartamento_id: "" } : {}) });
  };

  
  
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const apartamento_id = usesApartamento && form.residencial_id ? form.apartamento_id || null : null;
      const payload = type === "propietarios"
        ? { ...form, residencial_id: isResidentRole ? form.residencial_id || null : null, apartamento_id }
        : type === "pagos"
          ? { nombre: form.nombre, monto: form.monto, fecha_creacion: form.fecha_creacion, numero_factura: form.numero_factura || null, apartamento_id }
          : form;
      await api(payload, type);
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
        { name: "nombre", label: "Propietario" },
        { name: "monto", label: "Monto", type: "number" },
        { name: "fecha_creacion", label: "Fecha", type: "date" },
        { name: "numero_factura", label: "Número de factura (opcional)", optional: true, placeholder: "Ej.: FAC-0001" },
        { name: "residencial", label: "Residencial" },
        { name: "apartamento", label: "Apartamento (opcional)" },
      ]
    },

    propietarios: {
      Title: "Registrar usuario",
      Subtitle: "Crear usuario",
      Fields: [
        { name: "nombre", label: "Nombre" },
        { name: "email", label: "Email" },
        { name: "contrasena", label: "Password" },
        { name: "residencial", label: "Unidad" },
        { name: "apartamento", label: "Apartamento (opcional)" }
      ]
    },

    mantenimientos: {
      Title: "Registrar mantenimiento",
      Subtitle: "Programar actividad",
      Fields: [
        { name: "tipo", label: "Actividad" },
        { name: "descripcion", label: "Descripción" },
        { name: "residencial", label: "Propiedad / Residencial" },
        { name: "fecha_programada", label: "Fecha límite" }
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
            {nameConfig.Fields
              .filter((field) => field.name !== "residencial" || type !== "propietarios" || isResidentRole)
              .filter((field) => field.name !== "apartamento" || usesApartamento)
              .map((field) => (
              <label key={field.name} htmlFor={`field-${field.name}`}>

                <span>{field.label}</span>
                {field.name === "residencial" ? (
                  <select id={`field-${field.name}`} 
                    name="residencial_id"
                    required={type === "mantenimientos" || (type === "propietarios" && isResidentRole)}
                    onChange={change} 
                    value={form.residencial_id || ""}>

                    <option value="">
                      Seleccione una unidad
                      </option>
                    {residenciales.map((unidad) => 
                    <option key={unidad.id} 
                    value={unidad.id}>

                    {unidad.nombre}</option>)}
                  </select>
                ) : field.name === "apartamento" ? (
                  <select id={`field-${field.name}`}
                    name="apartamento_id"
                    onChange={change}
                    value={form.apartamento_id || ""}
                    disabled={!form.residencial_id}>
                    <option value="">{form.residencial_id ? (apartamentos.length ? "Sin apartamento" : "Este residencial no tiene apartamentos") : "Primero selecciona el residencial"}</option>
                    {apartamentos.map((apartamento) => <option key={apartamento.id} value={apartamento.id}>{apartamento.nombre} · {apartamento.tipo}</option>)}
                  </select>
                ) : (

                  <input id={`field-${field.name}`} 
                    required={!field.optional} name={field.name} type={field.type || (field.name === "contrasena" ? "password" : field.name === "fecha_programada" ? "date" : "text")} 
                    min={field.name === "monto" ? "0" : undefined}
                    step={field.name === "monto" ? "1" : undefined}
                    onChange={change} 
                    value={form[field.name] || ""} 
                    placeholder={field.placeholder} />
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
