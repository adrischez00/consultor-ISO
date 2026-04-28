function PageHeader({ eyebrow, title, description, actions = null }) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="page-title">{title}</h2>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
