import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, register } = useAuth();
  const [consultancyName, setConsultancyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    try {
      await register({
        consultancy_name: consultancyName,
        full_name: fullName,
        email,
        password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el registro.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <article className="auth-card">
        <p className="eyebrow">Registro</p>
        <h1>Crear consultoría</h1>
        <p className="auth-subtitle">
          Crea tu organización, usuario administrador y sesión inicial en un solo paso.
        </p>

        {error ? <p className="status error">{error}</p> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Nombre de consultoría</span>
            <input
              className="input-text"
              value={consultancyName}
              onChange={(event) => setConsultancyName(event.target.value)}
              required
            />
          </label>

          <label className="field-stack">
            <span>Nombre completo</span>
            <input
              className="input-text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>

          <label className="field-stack">
            <span>Email</span>
            <input
              className="input-text"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field-stack">
            <span>Password</span>
            <input
              className="input-text"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creando..." : "Crear cuenta"}
            </button>
          </div>
        </form>

        <p className="auth-footnote">
          ¿Ya tienes cuenta <Link to="/login">Iniciar sesión</Link>
        </p>
      </article>
    </section>
  );
}

export default RegisterPage;
