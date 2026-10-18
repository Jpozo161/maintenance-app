import { useState } from "react";
import { loginUser } from "../services/api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await loginUser({ email: email.trim(), password });
      onLogin(session.user);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="login-screen">
    <section className="login-card">
      <div className="login-brand-mark">▣</div>
      <p className="login-eyebrow">CONJUNTO RESIDENCIAL</p>
      <h1>Iniciar sesión</h1>
      <p className="login-description">Ingresa con tu cuenta de administrador o supervisor.</p>
      <form onSubmit={submit}>
        <label htmlFor="login-email">Correo electrónico</label>
        <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
        <label htmlFor="login-password">Contraseña</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </section>
  </main>;
}
