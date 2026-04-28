import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import AuditCreatePage from "./pages/AuditCreatePage";
import AuditDetailPage from "./pages/AuditDetailPage";
import AuditsPage from "./pages/AuditsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ClientsPage from "./pages/ClientsPage";
import DiagnosticResultPage from "./pages/DiagnosticResultPage";
import DiagnosticsPage from "./pages/DiagnosticsPage";
import DiagnosticWizardPage from "./pages/DiagnosticWizardPage";
import DashboardPage from "./pages/DashboardPage";
import ManagementReviewsPage from "./pages/ManagementReviewsPage";
import KpisPage from "./pages/KpisPage";
import IsoSystemPage from "./pages/IsoSystemPage";
import RiskOpportunitiesPage from "./pages/RiskOpportunitiesPage";
import NonconformitiesPage from "./pages/NonconformitiesPage";
import CustomerSatisfactionPage from "./pages/CustomerSatisfactionPage";
import SuppliersPage from "./pages/SuppliersPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";

function PrivateApp() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/auditorias" element={<AuditsPage />} />
          <Route path="/auditorias/nueva" element={<AuditCreatePage />} />
          <Route path="/auditorias/:id" element={<AuditDetailPage />} />
          <Route path="/auditorias/:id/editar" element={<AuditDetailPage />} />
          <Route path="/revision-direccion" element={<ManagementReviewsPage />} />
          <Route path="/riesgos-oportunidades" element={<RiskOpportunitiesPage />} />
          <Route path="/satisfaccion-cliente" element={<CustomerSatisfactionPage />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/diagnostico" element={<Navigate to="/diagnosticos" replace />} />
          <Route path="/diagnosticos" element={<DiagnosticsPage />} />
          <Route path="/diagnosticos/:id" element={<DiagnosticWizardPage />} />
          <Route path="/diagnosticos/:id/resultado" element={<DiagnosticResultPage />} />
          <Route path="/tareas" element={<TasksPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />
          <Route path="/indicadores" element={<KpisPage />} />
          <Route path="/sistema-iso" element={<IsoSystemPage />} />
          <Route path="/no-conformidades" element={<NonconformitiesPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={<PrivateApp />} />
    </Routes>
  );
}

export default App;
