import { useCallback, useEffect, useState } from "react";
import { navigation } from "./data/modules";
import { getCurrentUser, logoutUser } from "./services/api";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import MaintenanceModule from "./components/MaintenanceModule";
import FailureReport from "./components/FailureReport";
import AveriasModule from "./components/AveriasModule";
import LoginPage from "./components/LoginPage";
import OcrComparison from "./components/OcrComparison";
import PropertiesModule from "./components/PropertiesModule";
import SocialAreasModule from "./components/SocialAreasModule";

const initialView = () => window.location.hash.slice(1) || "inicio";

export default function App() {
  const [view, setView] = useState(initialView);
  const [toast, setToast] = useState("");
  const [objects, setObjects] = useState("");
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const setUserHome = useCallback((sessionUser) => {
    const nextView = sessionUser.role === "SUPERVISOR"
      ? "averias"
      : sessionUser.role === "RESIDENTE"
        ? "areasSociales"
        : navigation[window.location.hash.slice(1)] ? window.location.hash.slice(1) : "inicio";
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
    if (user?.role === "SUPERVISOR" && nextView !== "averias") return;
    if (user?.role === "RESIDENTE" && nextView !== "areasSociales") return;
    if (!navigation[nextView]) return;
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

  if (checkingSession) return <main className="auth-loading">Comprobando sesión…</main>;
  if (!user) return <LoginPage onLogin={signIn} />;

  const currentView = user.role === "SUPERVISOR" ? "averias" : user.role === "RESIDENTE" ? "areasSociales" : view;

  return <div className="app-shell">
    <Sidebar view={currentView} onNavigate={navigate} user={user} onSignOut={signOut} />
    <main>
      
      <header className="topbar">
        <div>
          <small>ADMINISTRACIÓN DEL CONJUNTO</small>
          <h1>{navigation[currentView]?.title ?? "Inicio"}</h1>
        </div>

        {user.role === "ADMIN" && 
          <button className="bell" aria-label="Notificaciones">
          ♧
          </button>}
      </header>

      {currentView === "inicio" ? 
        <Dashboard onNavigate={navigate} />
        : currentView === "areasSociales" ? 
          <SocialAreasModule user={user} />
          : currentView === "ocr" ? 
            <OcrComparison />
          : currentView === "averias" ? 
            (user.role === "SUPERVISOR" ? 
              <AveriasModule /> : <FailureReport onToast={showToast} />
            )
            : currentView === "propiedades" ? 
              <PropertiesModule />
              : user.role === "ADMIN" ? 
                <MaintenanceModule 
                key={currentView} t
                ype={currentView} 
                onToast={showToast} 
                objects={objects} />
                : <AveriasModule />}
    </main>

    {toast && 
      <div className="toast">
        {toast}
      </div>
    }
  </div>
  ;}
