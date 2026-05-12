import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const BRAND_LOGO_SRC = "/logo.png";

const PRIMARY_LINKS = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/clientes", label: "Clientes", end: false },
  { to: "/auditorias", label: "Auditorías", end: false },
];

const UTILITY_LINKS = [
  { to: "/diagnosticos", label: "Diagnósticos (Legacy)", end: false, legacy: true },
  { to: "/ajustes", label: "Ajustes", end: false },
];

function renderLinks(links, { secondary = false } = {}) {
  return links.map((link) => (
    <NavLink
      key={link.to}
      to={link.to}
      end={link.end}
      className={({ isActive }) => {
        const classes = ["nav-link"];
        if (secondary) classes.push("nav-link-secondary");
        if (isActive) classes.push("active");
        if (link.legacy) classes.push("nav-link-legacy");
        return classes.join(" ");
      }}
    >
      {link.label}
    </NavLink>
  ));
}

function AppLayout({ children }) {
  const location = useLocation();
  const { user, consultancy, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="app-shell">
      <button
        type="button" className={`sidebar-backdrop ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen} tabIndex={sidebarOpen ? 0 : -1}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-block">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            ×
          </button>
          <div className="brand-identity">
            <div className="brand-logo-wrap" aria-hidden="true">
              <img className="brand-logo" src={BRAND_LOGO_SRC} alt="Consultor-ISO9001" />
            </div>
          </div>
          <p className="brand-kicker">SaaS B2B</p>
          <h1 className="brand-title">
            <span>Consultor-</span>
            <span>ISO9001</span>
          </h1>
          <p className="brand-subtitle">
            Plataforma SaaS B2B para auditorías internas ISO 9001 y seguimiento operativo.
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <div className="nav-section">
            <p className="nav-section-title">Principal</p>
            {renderLinks(PRIMARY_LINKS)}
          </div>

          <div className="nav-section">
            <p className="nav-section-title">Utilidad</p>
            {renderLinks(UTILITY_LINKS, { secondary: true })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <p>{consultancy?.name || "Consultoría"}</p>
          <small>{user?.full_name || user?.email || "Usuario autenticado"}</small>
          <button type="button" className="btn-ghost sidebar-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú principal"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-topbar-brand">
            <div className="mobile-topbar-logo-wrap" aria-hidden="true">
              <img className="mobile-topbar-logo" src={BRAND_LOGO_SRC} alt="Consultor-ISO9001" />
            </div>
            <div className="mobile-topbar-copy">
              <strong>Consultor-ISO9001</strong>
              <small>{consultancy?.name || "Consultoría"}</small>
            </div>
          </div>
        </header>
        <div className="content-shell">{children}</div>
      </main>
    </div>
  );
}

export default AppLayout;
