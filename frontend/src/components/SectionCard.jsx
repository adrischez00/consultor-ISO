function SectionCard({ id = undefined, className = "", title, description, actions = null, children }) {
  const classes = ["section-card"];
  if (className) classes.push(className);
  return (
    <section id={id} className={classes.join(" ")}>
      <header className="section-card-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="section-card-actions">{actions}</div> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}

export default SectionCard;
