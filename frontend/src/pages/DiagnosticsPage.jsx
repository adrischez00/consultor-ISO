import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import DiagnosticListItem from "../components/DiagnosticListItem";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { createDiagnostic, fetchDiagnostics } from "../api/diagnosticsApi";
import { fetchClients } from "../api/clientsApi";
import { useDiagnostic } from "../context/DiagnosticContext";
import { normalizeUuidOrNull } from "../utils/uuid";

const LAST_SELECTED_CLIENT_STORAGE_KEY = "consultor_iso9001.last_selected_client_id";

function DiagnosticsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeDiagnosticId, setDiagnosticId } = useDiagnostic();
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [error, setError] = useState("");
  const [clientsError, setClientsError] = useState("");
  const hasBootstrappedClientSelection = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadDiagnostics() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchDiagnostics({ limit: 100, offset: 0 });
        if (active) {
          setDiagnostics(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar diagnósticos.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDiagnostics();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadClients() {
      setClientsLoading(true);
      setClientsError("");
      try {
        const data = await fetchClients();
        if (active) {
          setClients(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          setClientsError(err instanceof Error ? err.message : "No se pudieron cargar clientes.");
        }
      } finally {
        if (active) {
          setClientsLoading(false);
        }
      }
    }

    loadClients();
    return () => {
      active = false;
    };
  }, []);

  const clientsById = useMemo(() => {
    const entries = clients
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item]);
    return Object.fromEntries(entries);
  }, [clients]);

  useEffect(() => {
    if (clientsLoading || hasBootstrappedClientSelection.current) {
      return;
    }

    let nextSelectedClientId = "";
    const fromQuery = normalizeUuidOrNull(searchParams.get("client_id"));
    const fromStorage =
      typeof window === "undefined" ? null : normalizeUuidOrNull(window.localStorage.getItem(LAST_SELECTED_CLIENT_STORAGE_KEY));

    if (fromQuery && clientsById[fromQuery]) {
      nextSelectedClientId = fromQuery;
    } else if (fromStorage && clientsById[fromStorage]) {
      nextSelectedClientId = fromStorage;
    }

    setSelectedClientId(nextSelectedClientId);
    hasBootstrappedClientSelection.current = true;

    if (fromQuery) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("client_id");
      setSearchParams(nextParams, { replace: true });
    }
  }, [clientsById, clientsLoading, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedClientId || clientsLoading) {
      return;
    }

    if (!clientsById[selectedClientId]) {
      setSelectedClientId("");
    }
  }, [clientsById, clientsLoading, selectedClientId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!selectedClientId) {
      window.localStorage.removeItem(LAST_SELECTED_CLIENT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(LAST_SELECTED_CLIENT_STORAGE_KEY, selectedClientId);
  }, [selectedClientId]);

  const inProgressDiagnostics = useMemo(
    () =>
      diagnostics
        .filter((item) => item.status === "in_progress")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [diagnostics]
  );

  const activeInProgressDiagnostic = useMemo(() => {
    if (!activeDiagnosticId) {
      return null;
    }

    return diagnostics.find(
      (item) => item.id === activeDiagnosticId && item.status === "in_progress"
    );
  }, [diagnostics, activeDiagnosticId]);

  const continueDiagnosticId =
    activeInProgressDiagnostic.id || inProgressDiagnostics[0].id || null;

  useEffect(() => {
    if (!continueDiagnosticId || activeDiagnosticId === continueDiagnosticId) {
      return;
    }
    setDiagnosticId(continueDiagnosticId);
  }, [continueDiagnosticId, activeDiagnosticId, setDiagnosticId]);

  async function handleCreateDiagnostic() {
    if (creating) return;

    setCreating(true);
    setError("");
    try {
      const payload = selectedClientId ? { client_id: selectedClientId } : null;
      const created = await createDiagnostic(payload);
      setDiagnosticId(created.id);
      navigate(`/diagnosticos/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el diagnóstico.");
    } finally {
      setCreating(false);
    }
  }

  function handleContinueDiagnostic() {
    if (!continueDiagnosticId) {
      return;
    }
    setDiagnosticId(continueDiagnosticId);
    navigate(`/diagnosticos/${continueDiagnosticId}`);
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="Legacy"
        title="Diagnósticos (Legacy)"
        description="Módulo histórico mantenido como herramienta secundaria interna."
        actions={
          <div className="inline-actions">
            <label className="field-inline">
              <span>Cliente</span>
              <select
                className="input-select"
                value={selectedClientId}
                disabled={clientsLoading || creating}
                onChange={(event) => setSelectedClientId(event.target.value)}
              >
                <option value="">Sin cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateDiagnostic}
              disabled={creating}
            >
              {creating ? "Creando..." : "Nuevo diagnóstico"}
            </button>
            {continueDiagnosticId ? (
              <button type="button" className="btn-secondary" onClick={handleContinueDiagnostic}>
                Continuar diagnóstico
              </button>
            ) : null}
          </div>
        }
      />

      {loading ? <p className="status">Cargando diagnósticos...</p> : null}
{error ? <p className="status error">{error}</p> : null}
{clientsError ? <p className="status error">{clientsError}</p> : null}

      {!loading && !error ? (
        <SectionCard title="Listado de diagnósticos" description="Ordenados por fecha de creación.">
          {diagnostics.length === 0 ? (
            <div className="empty-state-block">
              <p className="empty-state">Aún no hay diagnósticos. Crea uno para iniciar el flujo.</p>
              <div className="inline-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateDiagnostic}
                  disabled={creating}
                >
                  {creating ? "Creando..." : "Nuevo diagnóstico"}
                </button>
                <Link className="btn-ghost link-btn" to="/clientes">
                  Crear cliente primero
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack-list">
              {diagnostics.map((diagnostic) => (
                <DiagnosticListItem
                  key={diagnostic.id}
                  diagnostic={diagnostic}
                  clientName={diagnostic.client_id ? clientsById[diagnostic.client_id]?.name ?? null : null}
                />
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </section>
  );
}

export default DiagnosticsPage;
