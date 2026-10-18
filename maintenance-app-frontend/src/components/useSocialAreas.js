import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAreaReservation,
  createAreaSocial,
  getAreaAvailability,
  getAreaReservations,
  getAreasSociales,
  getResidenciales,
  reviewAreaReservation,
  updateAreaSocial,
} from "../services/api";
import { areaColumns, emptyArea, timeValue, todayInBogota } from "./socialAreasUtils";

export default function useSocialAreas(isAdmin) {
  const [areas, setAreas] = useState([]);
  const [residenciales, setResidenciales] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [date, setDate] = useState(todayInBogota);
  const [availability, setAvailability] = useState({ key: "", slots: [] });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [weekAvailability, setWeekAvailability] = useState({});
  const [areaForm, setAreaForm] = useState(emptyArea);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentAvailabilityKey = selectedArea + "|" + date;
  const activeAreas = useMemo(() => areas.filter((area) => Boolean(area.activa)), [areas]);
  const slots = availability.key === currentAvailabilityKey ? availability.slots : [];
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const [year, month, day] = todayInBogota().split("-").map(Number);
    const current = new Date(year, month - 1, day + index, 12);
    const value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    return { value, date: current };
  }), []);

  const refresh = useCallback(async () => {
    const [areaData, bookingData, residentialData] = await Promise.all([
      getAreasSociales(),
      getAreaReservations(),
      isAdmin ? getResidenciales() : Promise.resolve([]),
    ]);
    const loadedAreas = Array.isArray(areaData) ? areaData : [];
    setAreas(loadedAreas);
    setBookings(Array.isArray(bookingData) ? bookingData : []);
    setResidenciales(Array.isArray(residentialData) ? residentialData : []);
    setSelectedArea((current) => current || String(loadedAreas.find((area) => area.activa)?.id || ""));
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    // `refresh` writes state after its API requests resolve.
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
      .catch((err) => { if (active) setError(err.message || "No se pudieron cargar las áreas sociales."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!selectedArea || !date) return undefined;
    let active = true;
    getAreaAvailability(selectedArea, date)
      .then((result) => {
        if (active) setAvailability({ key: currentAvailabilityKey, slots: Array.isArray(result.slots) ? result.slots : [] });
      })
      .catch((err) => { if (active) setError(err.message || "No se pudo consultar la disponibilidad."); });
    return () => { active = false; };
  }, [selectedArea, date, currentAvailabilityKey]);

  useEffect(() => {
    if (!selectedArea) return undefined;
    let active = true;
    Promise.all(weekDays.map(async ({ value }) => {
      try {
        const result = await getAreaAvailability(selectedArea, value);
        const daySlots = Array.isArray(result.slots) ? result.slots : [];
        return [value, { full: daySlots.length > 0 && daySlots.every((slot) => !slot.disponible) }];
      } catch { return [value, { full: false }]; }
    })).then((entries) => { if (active) setWeekAvailability(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [selectedArea, weekDays]);

  const saveArea = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = {
        ...areaForm,
        residencial_id: Number(areaForm.residencial_id),
        intervalo_minutos: Number(areaForm.intervalo_minutos),
        activa: Boolean(areaForm.activa),
      };
      if (editingId) {
        await updateAreaSocial(editingId, payload);
        setNotice("Área social actualizada.");
      } else {
        await createAreaSocial(payload);
        setNotice("Área social registrada.");
      }
      setEditingId(null);
      setAreaForm(emptyArea());
      await refresh();
    } catch (err) {
      setError("No se pudo guardar el área: " + err.message);
    } finally { setSaving(false); }
  };

  const editArea = (area) => {
    setEditingId(area.id);
    setAreaForm({
      residencial_id: String(area.residencial_id),
      nombre: area.nombre || "",
      descripcion: area.descripcion || "",
      hora_apertura: timeValue(area.hora_apertura),
      hora_cierre: timeValue(area.hora_cierre),
      intervalo_minutos: Number(area.intervalo_minutos) || 60,
      activa: Boolean(area.activa),
    });
  };

  const toggleArea = async (area) => {
    setError(""); setNotice("");
    try {
      await updateAreaSocial(area.id, {
        residencial_id: area.residencial_id,
        nombre: area.nombre,
        descripcion: area.descripcion || "",
        hora_apertura: timeValue(area.hora_apertura),
        hora_cierre: timeValue(area.hora_cierre),
        intervalo_minutos: Number(area.intervalo_minutos),
        activa: !area.activa,
      });
      setNotice(area.activa ? "Área deshabilitada." : "Área habilitada.");
      await refresh();
    } catch (err) { setError("No se pudo cambiar el estado del área: " + err.message); }
  };

  const requestBooking = async (slot) => {
    setSaving(true); setError(""); setNotice("");
    try {
      await createAreaReservation({
        area_id: Number(selectedArea),
        fecha: date,
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
      });
      setSelectedSlot(null);
      setNotice("Solicitud enviada. Quedará pendiente hasta que el administrador la revise.");
      await refresh();
      const result = await getAreaAvailability(selectedArea, date);
      setAvailability({ key: currentAvailabilityKey, slots: Array.isArray(result.slots) ? result.slots : [] });
    } catch (err) { setError("No se pudo solicitar la reserva: " + err.message); }
    finally { setSaving(false); }
  };

  const submitSelectedBooking = () => selectedSlot && requestBooking(selectedSlot);

  const reviewBooking = async (booking, state) => {
    setError(""); setNotice("");
    try {
      await reviewAreaReservation(booking.id, state);
      setNotice(state === "APROBADA" ? "Reserva aprobada." : "Solicitud rechazada.");
      await refresh();
      if (String(selectedArea) === String(booking.area_id)) {
        const result = await getAreaAvailability(selectedArea, date);
        setAvailability({ key: currentAvailabilityKey, slots: Array.isArray(result.slots) ? result.slots : [] });
      }
    } catch (err) { setError("No se pudo revisar la solicitud: " + err.message); }
  };

  const areaRows = areas.map((area) => ({
    id: area.id,
    item: area,
    cells: [area.nombre, area.residencial_nombre || "—", `${timeValue(area.hora_apertura)}–${timeValue(area.hora_cierre)}`, `${Number(area.intervalo_minutos)} min`, area.activa ? "Habilitada" : "Deshabilitada"],
  }));
  const bookingRows = bookings.map((booking) => ({
    id: booking.id,
    item: booking,
    cells: [booking.fecha, `${timeValue(booking.hora_inicio)}–${timeValue(booking.hora_fin)}`, booking.area_nombre || "—", isAdmin ? booking.usuario_nombre || "—" : booking.residencial_nombre || "Mi residencial", booking.estado],
  }));

  return {
    areas, residenciales, activeAreas, bookings, selectedArea, setSelectedArea,
    selectedAreaData: activeAreas.find((area) => String(area.id) === String(selectedArea)),
    date, setDate, weekDays, weekAvailability, slots, selectedSlot, setSelectedSlot,
    areaForm, setAreaForm, editingId, setEditingId, loading, saving, error, notice,
    setError, setNotice, areaColumns, areaRows, bookingRows, saveArea, editArea, toggleArea,
    requestBooking, submitSelectedBooking, reviewBooking,
  };
}
