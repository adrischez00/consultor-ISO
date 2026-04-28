import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { normalizeUuidOrNull } from "../utils/uuid";

const DiagnosticContext = createContext(null);
const DIAGNOSTIC_ID_STORAGE_KEY = "consultor_iso9001.diagnostic_id";
const ACTIVE_DIAGNOSTIC_ID_STORAGE_KEY = "consultor_iso9001.active_diagnostic_id";
const DIAGNOSTIC_REGISTRY_STORAGE_KEY = "consultor_iso9001.diagnostic_registry";

function getInitialDiagnosticId() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue =
    window.localStorage.getItem(ACTIVE_DIAGNOSTIC_ID_STORAGE_KEY) ??
    window.localStorage.getItem(DIAGNOSTIC_ID_STORAGE_KEY);
  return normalizeUuidOrNull(storedValue);
}

function getInitialDiagnosticRegistry() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(DIAGNOSTIC_REGISTRY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized = parsed
      .map((item) => normalizeUuidOrNull(item))
      .filter(Boolean);
    return Array.from(new Set(normalized));
  } catch {
    return [];
  }
}

export function DiagnosticProvider({ children }) {
  const [diagnosticId, setDiagnosticIdState] = useState(getInitialDiagnosticId);
  const [diagnosticRegistry, setDiagnosticRegistry] = useState(getInitialDiagnosticRegistry);

  const registerDiagnosticId = useCallback((value) => {
    const normalized = normalizeUuidOrNull(value);
    if (!normalized) {
      return;
    }

    setDiagnosticRegistry((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      return [normalized, ...prev];
    });
  }, []);

  const removeDiagnosticId = useCallback((value) => {
    const normalized = normalizeUuidOrNull(value);
    if (!normalized) {
      return;
    }

    setDiagnosticRegistry((prev) => prev.filter((id) => id !== normalized));
  }, []);

  const setDiagnosticId = useCallback((value) => {
    if (value == null) {
      setDiagnosticIdState(null);
      return;
    }

    const normalized = normalizeUuidOrNull(value);
    if (!normalized) {
      setDiagnosticIdState(null);
      return;
    }

    setDiagnosticIdState(normalized);
    registerDiagnosticId(normalized);
  }, [registerDiagnosticId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!diagnosticId) {
      window.localStorage.removeItem(ACTIVE_DIAGNOSTIC_ID_STORAGE_KEY);
      window.localStorage.removeItem(DIAGNOSTIC_ID_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_DIAGNOSTIC_ID_STORAGE_KEY, diagnosticId);
    // Backward compatibility key.
    window.localStorage.setItem(DIAGNOSTIC_ID_STORAGE_KEY, diagnosticId);
  }, [diagnosticId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      DIAGNOSTIC_REGISTRY_STORAGE_KEY,
      JSON.stringify(diagnosticRegistry)
    );
  }, [diagnosticRegistry]);

  const value = useMemo(
    () => ({
      diagnosticId,
      activeDiagnosticId: diagnosticId,
      setDiagnosticId,
      setActiveDiagnosticId: setDiagnosticId,
      diagnosticRegistry,
      registerDiagnosticId,
      removeDiagnosticId,
    }),
    [diagnosticId, setDiagnosticId, diagnosticRegistry, registerDiagnosticId, removeDiagnosticId]
  );

  return <DiagnosticContext.Provider value={value}>{children}</DiagnosticContext.Provider>;
}

export function useDiagnostic() {
  const context = useContext(DiagnosticContext);
  if (!context) {
    throw new Error("useDiagnostic debe usarse dentro de DiagnosticProvider");
  }
  return context;
}
