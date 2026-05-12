import { useEffect } from "react";

function ConfirmDeleteModal({
  open,
  loading = false,
  title = "Confirmar eliminación",
  description = "Esta acción no se puede deshacer.",
  entityLabel = "",
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="confirm-modal-overlay"
      onClick={() => {
        if (!loading) onClose?.();
      }}
    >
      <div
        className="confirm-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="confirm-modal-header">
          <span className="confirm-modal-icon" aria-hidden="true">
            🗑️
          </span>
          <div className="confirm-modal-copy">
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </header>

        {entityLabel ? <p className="confirm-modal-entity">{entityLabel}</p> : null}

        <div className="confirm-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Eliminando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
