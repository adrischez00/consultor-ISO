import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { useDiagnostic } from "../context/DiagnosticContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function SettingsPage() {
  const { diagnosticId, diagnosticRegistry } = useDiagnostic();

  return (
    <section className="page settings-page">
      <PageHeader
        eyebrow="Sistema"
        title="Ajustes"
        description="Estado técnico básico del frontend para operación y soporte."
      />

      <SectionCard
        className="settings-tech-card"
        title="Estado técnico"
        description="Variables y estado local relevantes."
      >
        <ul className="kv-list">
          <li>
            <span>API URL</span>
            <strong>{API_URL}</strong>
          </li>
          <li>
            <span>Diagnóstico activo</span>
            <strong>{diagnosticId || "-"}</strong>
          </li>
          <li>
            <span>Diagnósticos en caché local</span>
            <strong>{diagnosticRegistry.length}</strong>
          </li>
          <li>
            <span>Stack UI</span>
            <strong>React + Vite + React Router</strong>
          </li>
        </ul>
      </SectionCard>
    </section>
  );
}

export default SettingsPage;
