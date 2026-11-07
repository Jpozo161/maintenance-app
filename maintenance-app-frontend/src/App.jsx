import { useCallback, useEffect, useState } from "react";
import { canView, homeView, navigation } from "./data/modules";
import { getCurrentUser, logoutUser } from "./services/api";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import MaintenanceModule from "./components/MaintenanceModule";
import FailureReport from "./components/FailureReport";
import AveriasModule from "./components/AveriasModule";
import LoginPage from "./components/LoginPage";
import DocumentsModule from "./components/DocumentsModule";
import PropertiesModule from "./components/PropertiesModule";
import SocialAreasModule from "./components/SocialAreasModule";
import VisitsModule from "./components/VisitsModule";

const initialView = () => window.location.hash.slice(1) || "inicio";

export default function App() {
  const [view, setView] = useState(initialView);
  const [toast, setToast] = useState("");
  const [objects, setObjects] = useState("");
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const setUserHome = useCallback((sessionUser) => {
    const requested = window.location.hash.slice(1);
    const nextView = canView(sessionUser.role, requested) ? requested : homeView(sessionUser.role);
    window.location.hash = nextView;
    setView(nextView);
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((session) => {
        if (!active) return;
        setUser(session.user);
        setUserHome(session.user);
      })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [setUserHome]);

  const navigate = (nextView) => {
    if (!canView(user?.role, nextView)) return;
    window.location.hash = nextView;
    setView(nextView);
    setObjects("");
  };

  const signIn = (sessionUser) => {
    setUser(sessionUser);
    setObjects("");
    setUserHome(sessionUser);
  };

  const signOut = async () => {
    try {
      await logoutUser();
      setUser(null);
      setObjects("");
      window.location.hash = "";
      setView("inicio");
    } catch (error) {
      setToast(`No se pudo cerrar la sesión: ${error.message}`);
      window.setTimeout(() => setToast(""), 2800);
    }
  };

  const showToast = (message, newObject) => {
    setToast(message);
    setObjects(newObject);
    window.setTimeout(() => setToast(""), 2800);
  };

  if (checkingSession) 
    return <main className="auth-loading">Comprobando sesión…</main>;
  if (!user) return <LoginPage onLogin={signIn} />;

  const currentView = canView(user.role, view) ? view : homeView(user.role);

  return <div className="app-shell">
    <Sidebar view={currentView} onNavigate={navigate} user={user} onSignOut={signOut} />
    <main>
      
      <header className="topbar">

        {user.role === "ADMIN" && 
          <button className="bell" type="button" aria-label="Ver próximos mantenimientos" title="Ver próximos mantenimientos" onClick={() => navigate("inicio")}>
          ♧
          </button>}
      </header>

      {currentView === "inicio" ? 
        <Dashboard onNavigate={navigate} role={user.role} />
        : currentView === "areasSociales" ? 
          <SocialAreasModule user={user} />
        : currentView === "visitas" ? 
          <VisitsModule user={user} />
          : currentView === "documentos" ? 
            <DocumentsModule />
          : currentView === "averias" ? 
            (user.role === "SUPERVISOR" ? 
              <AveriasModule /> : <FailureReport onToast={showToast} />
            )
            : currentView === "propiedades" ? 
              <PropertiesModule />
              : ["ADMIN", "TECNICO"].includes(user.role) ? 
                <MaintenanceModule 
                key={currentView} type={currentView}
                onToast={showToast} 
                objects={objects} readOnly={user.role === "TECNICO"} />
                : <AveriasModule />}
    </main>

    {toast && 
      <div className="toast">
        {toast}
      </div>
    }
  </div>
  ;}
