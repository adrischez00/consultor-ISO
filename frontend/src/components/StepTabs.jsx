import StatusBadge from "./StatusBadge";

function StepTabs({
  items,
  activeIndex,
  onChange,
  ariaLabel = "Navegación por secciones",
  className = "",
}) {
  const rootClassName = className ? `step-tabs ${className}` : "step-tabs";

  return (
    <div className={rootClassName} role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={item.key}
            type="button"
            className={isActive ? "step-tab active" : "step-tab"}
            onClick={() => onChange(index)}
            role="tab"
            aria-selected={isActive}
          >
            <span className="step-tab-title">{item.label}</span>
            <span className="step-tab-meta">
              <StatusBadge value={item.status} />
              <span>{item.progressText}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default StepTabs;
