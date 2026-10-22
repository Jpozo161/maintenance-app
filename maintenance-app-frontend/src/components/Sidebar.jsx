import { navigation } from "../data/modules";

export default function Sidebar({ view, onNavigate, user, onSignOut }) {
  const isAdmin = user?.role === "ADMIN";
  const visibleNavigation = Object.entries(navigation).filter(([id]) => isAdmin || (user?.role === "RESIDENTE" ? id === "areasSociales" : user?.role === "TECNICO" ? ["inicio", "mantenimientos"].includes(id) : id === "averias"));
  const initials = (user?.name || user?.email || "U").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

  return <aside className="sidebar">
    <div className="brand">
      <span>▣</span>
      <div><strong>Conjunto</strong><small>Residencial</small></div>
    </div>
    <nav aria-label="Navegación principal">
      {visibleNavigation.map(([id, item]) => <button key={id} className={view === id ? "active" : ""} onClick={() => onNavigate(id)}>
        <i>{item.icon}</i>{item.title}
      </button>)}
    </nav>
    <div className="sidebar-footer">
      <span className="avatar">{initials}</span>
      <div className="sidebar-account"><strong>{user?.name ?? user?.email}</strong><small>{isAdmin ? "Administrador" : user?.role === "RESIDENTE" ? "Residente" : user?.role === "TECNICO" ? "Técnico" : "Supervisor"}</small></div>
      <button className="signout-button" type="button" onClick={onSignOut}>Cerrar sesión</button>
    </div>
  </aside>;
}
