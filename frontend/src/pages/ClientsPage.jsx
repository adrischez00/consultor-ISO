import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { createClient, fetchClients } from "../api/clientsApi";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

const INITIAL_FORM = {
  name: "",
  sector: "",
  employee_count: "",
  description: "",
};

const SORT_OPTIONS = [
  { value: "created_desc", label: "Alta más reciente" },
  { value: "name_asc", label: "Nombre A-Z" },
  { value: "name_desc", label: "Nombre Z-A" },
  { value: "created_asc", label: "Alta más antigua" },
];

function normalizeSearchValue(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [listSearch, setListSearch] = useState("");
  const [listSort, setListSort] = useState("created_desc");
  const [listExpanded, setListExpanded] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadClients() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchClients();
        if (active) {
          setClients(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar clientes.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadClients();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!listExpanded) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setListExpanded(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [listExpanded]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(listSearch);
    let nextClients = [...clients];

    if (normalizedSearch) {
      nextClients = nextClients.filter((client) => {
        const haystack = normalizeSearchValue(
          `${client.name || ""} ${client.sector || ""} ${client.description || ""}`
        );
        return haystack.includes(normalizedSearch);
      });
    }

    if (listSort === "name_asc") {
      nextClients.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"));
      return nextClients;
    }
    if (listSort === "name_desc") {
      nextClients.sort((a, b) => String(b.name || "").localeCompare(String(a.name || ""), "es"));
      return nextClients;
    }
    if (listSort === "created_asc") {
      nextClients.sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return aDate - bDate;
      });
      return nextClients;
    }

    nextClients.sort((a, b) => {
      const aDate = new Date(a.created_at || 0).getTime();
      const bDate = new Date(b.created_at || 0).getTime();
      return bDate - aDate;
    });
    return nextClients;
  }, [clients, listSearch, listSort]);

  const listSummary = useMemo(() => {
    if (clients.length === 0) return "Sin clientes";
    return `${filteredClients.length} de ${clients.length} clientes`;
  }, [clients.length, filteredClients.length]);

  function handleFieldChange(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleCreateClient(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    try {
      await createClient(form);
      const persistedClients = await fetchClients();
      setClients(Array.isArray(persistedClients) ? persistedClients : []);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  function renderClientsList({ expanded = false } = {}) {
    if (clients.length === 0) {
      return (
        <div className="empty-state-block">
          <p className="empty-state">No hay clientes registrados.</p>
          <div className="inline-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => nameInputRef.current?.focus()}
            >
              Crear primer cliente
            </button>
          </div>
        </div>
      );
    }

    if (filteredClients.length === 0) {
      return (
        <div className="empty-state-block">
          <p className="empty-state">No hay resultados para la búsqueda actual.</p>
          <button type="button" className="btn-ghost" onClick={() => setListSearch("")}>
            Limpiar búsqueda
          </button>
        </div>
      );
    }

    return (
      <div className={`stack-list ${expanded ? "clients-list-expanded" : "clients-list-scroll"}`}>
        {filteredClients.map((client) => (
          <article className="diagnostic-list-item" key={client.id}>
            <div className="diagnostic-list-main">
              <p className="diagnostic-list-id">{client.name}</p>
              <div className="diagnostic-list-meta">
                <StatusBadge value={client.status} label={client.status} />
                <span>Sector: {client.sector || "-"}</span>
                <span>Empleados: {client.employee_count ?? "-"}</span>
                <span>Alta: {formatDate(client.created_at)}</span>
              </div>
            </div>
            <div className="diagnostic-list-actions clients-item-actions">
              <Link className="btn-ghost link-btn" to={`/auditorias/nueva?client_id=${client.id}`}>
                Nueva auditoría
              </Link>
              <Link className="btn-secondary link-btn" to={`/clientes/${client.id}`}>
                Ver detalle
              </Link>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className="page clients-page">
      <PageHeader
        eyebrow="Cartera"
        title="Clientes"
        description="Gestiona empresas para asociar auditorías P03 y trazabilidad histórica."
      />

      {loading ? <p className="status">Cargando clientes...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      <div className="layout-grid two-columns clients-grid">
        <SectionCard
          className="clients-create-card"
          title="Nuevo cliente"
          description="Crea una empresa para asociar futuras auditorías y diagnósticos legacy."
        >
          <form className="form-grid clients-create-form" onSubmit={handleCreateClient}>
            <label className="field-stack">
              <span>Nombre *</span>
              <input
                ref={nameInputRef}
                className="input-text"
                name="name"
                value={form.name}
                onChange={handleFieldChange("name")}
                placeholder="Ej. ACME Manufactura S.L."
                required
              />
            </label>

            <label className="field-stack">
              <span>Sector</span>
              <input
                className="input-text"
                name="sector"
                value={form.sector}
                onChange={handleFieldChange("sector")}
                placeholder="Ej. Industrial"
              />
            </label>

            <label className="field-stack">
              <span>Empleados</span>
              <input
                className="input-text"
                type="number"
                min="0"
                name="employee_count"
                value={form.employee_count}
                onChange={handleFieldChange("employee_count")}
                placeholder="Ej. 120"
              />
            </label>

            <label className="field-stack">
              <span>Descripción</span>
              <textarea
                className="input-textarea"
                name="description"
                rows={3}
                value={form.description}
                onChange={handleFieldChange("description")}
                placeholder="Contexto operativo del cliente"
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Crear cliente"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          className="clients-list-card"
          title="Listado de clientes"
          description="Búsqueda, ordenación y acceso rápido a auditorías."
          actions={
            <div className="clients-list-toolbar">
              <input
                className="input-text clients-search-input"
                type="search"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Buscar por nombre o sector..."
              />
              <select
                className="input-select clients-sort-select"
                value={listSort}
                onChange={(event) => setListSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-ghost" onClick={() => setListExpanded(true)}>
                Ampliar
              </button>
            </div>
          }
        >
          <p className="clients-list-summary">{listSummary}</p>
          {renderClientsList()}
        </SectionCard>
      </div>

      {listExpanded ? (
        <div className="clients-modal-overlay" onClick={() => setListExpanded(false)}>
          <section
            className="clients-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Listado ampliado de clientes"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="clients-modal-header">
              <div>
                <h3>Listado ampliado de clientes</h3>
                <p>{listSummary}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setListExpanded(false)}>
                Cerrar
              </button>
            </header>

            <div className="clients-modal-toolbar">
              <input
                className="input-text clients-search-input"
                type="search"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Buscar por nombre o sector..."
              />
              <select
                className="input-select clients-sort-select"
                value={listSort}
                onChange={(event) => setListSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="clients-modal-content">{renderClientsList({ expanded: true })}</div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default ClientsPage;
