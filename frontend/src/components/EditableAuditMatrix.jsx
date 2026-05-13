import { useState } from "react";

// ── Status / type badge rendering ─────────────────────────────────────────────

function StatusBadgeMatrix({ value, config }) {
  const cfg = config[value] || { label: value || "—", colorClass: "mat-badge-default" };
  return (
    <span className={`mat-badge ${cfg.colorClass}`}>{cfg.label}</span>
  );
}

// ── Field renderer inside expanded row ────────────────────────────────────────

function ExpandField({ field, row, onUpdate, disabled }) {
  if (field.showIf && !field.showIf(row)) return null;

  const value = row[field.key] ?? "";

  return (
    <div className={`mat-expand-field${field.wide ? " mat-expand-field-wide" : ""}`}>
      <label className="mat-expand-label">{field.label}</label>
      {field.type === "select" ? (
        <select
          className="mat-expand-select"
          value={value}
          disabled={disabled}
          onChange={(e) => onUpdate({ [field.key]: e.target.value })}
        >
          {!value && <option value="">— Seleccionar —</option>}
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          className="mat-expand-textarea"
          value={value}
          placeholder={field.placeholder || ""}
          rows={2}
          disabled={disabled}
          onChange={(e) => onUpdate({ [field.key]: e.target.value })}
        />
      ) : (
        <input
          type={field.type === "date" ? "date" : "text"}
          className="mat-expand-input"
          value={value}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          onChange={(e) => onUpdate({ [field.key]: e.target.value })}
        />
      )}
    </div>
  );
}

// ── Single row ────────────────────────────────────────────────────────────────

function MatrixRow({ row, index, schema, isExpanded, onToggle, onUpdate, onRemove, disabled }) {
  const primaryVal = row[schema.primaryField] || "";
  const statusVal = row[schema.statusField];
  const statusCfg = schema.statusConfig || {};

  return (
    <div className={`mat-row${isExpanded ? " mat-row-open" : ""}`}>
      {/* Compact header */}
      <div className="mat-row-head">
        <div className="mat-row-primary" title={primaryVal}>
          <span className="mat-row-primary-text">
            {primaryVal || <span className="mat-row-empty-text">Sin descripción</span>}
          </span>
        </div>

        <div className="mat-row-meta">
          {schema.typeField && row[schema.typeField] && (
            <StatusBadgeMatrix
              value={row[schema.typeField]}
              config={schema.typeConfig || {}}
            />
          )}
          <StatusBadgeMatrix value={statusVal} config={statusCfg} />
          {schema.compactCols.map((col) => {
            const val = row[col.key];
            if (!val) return null;
            return (
              <span key={col.key} className="mat-row-meta-item" title={col.label}>
                {col.type === "date" ? val.slice(0, 7) : val}
              </span>
            );
          })}
        </div>

        <div className="mat-row-actions">
          <button
            type="button"
            className="mat-btn-expand"
            onClick={() => onToggle(index)}
            disabled={disabled}
            aria-expanded={isExpanded}
            title={isExpanded ? "Cerrar" : "Editar"}
          >
            {isExpanded ? "▲" : "▼"}
          </button>
          {!disabled && (
            <button
              type="button"
              className="mat-btn-remove"
              onClick={() => onRemove(index)}
              title="Eliminar"
              aria-label="Eliminar fila"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="mat-row-body">
          {schema.expandFields.map((field) => (
            <ExpandField
              key={field.key}
              field={field}
              row={row}
              onUpdate={(patch) => onUpdate(index, patch)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EditableAuditMatrix({
  value,
  onChange,
  schema,
  addLabel,
  emptyText,
  disabled,
}) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const rows = Array.isArray(value) ? value : [];

  function addRow() {
    if (disabled) return;
    const newRow = {
      ...schema.defaultRow(),
      _mid: String(Date.now()) + String(Math.random()).slice(2, 7),
    };
    onChange([...rows, newRow]);
    setExpandedIndex(rows.length);
  }

  function removeRow(index) {
    if (disabled) return;
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  }

  function updateRow(index, patch) {
    if (disabled) return;
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function toggleRow(index) {
    setExpandedIndex(expandedIndex === index ? null : index);
  }

  return (
    <div className="audit-matrix">
      {rows.length === 0 ? (
        <p className="mat-empty">{emptyText || "Sin registros. Añade uno para comenzar."}</p>
      ) : (
        <div className="mat-rows">
          {rows.map((row, index) => (
            <MatrixRow
              key={row._mid || index}
              row={row}
              index={index}
              schema={schema}
              isExpanded={expandedIndex === index}
              onToggle={toggleRow}
              onUpdate={updateRow}
              onRemove={removeRow}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {!disabled && (
        <button type="button" className="mat-add-btn" onClick={addRow}>
          + {addLabel || "Añadir fila"}
        </button>
      )}
    </div>
  );
}
