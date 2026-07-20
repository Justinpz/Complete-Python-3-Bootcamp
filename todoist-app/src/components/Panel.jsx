// LEVELED UI primitives, ported to CSS: glass panel with an accent strip,
// uppercase Teko section titles, and the skewed hot-fill button.

export function Panel({ accent, className = '', children, ...rest }) {
  return (
    <section
      className={`panel ${className}`}
      style={accent ? { '--panel-accent': accent } : undefined}
      {...rest}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, right, className = '' }) {
  return (
    <div className={`section-title ${className}`}>
      <h2>{children}</h2>
      {right ? <div className="section-title-right">{right}</div> : null}
    </div>
  );
}

export function SkewButton({ kind = 'primary', className = '', children, ...rest }) {
  return (
    <button type="button" className={`skew-btn skew-${kind} ${className}`} {...rest}>
      <span>{children}</span>
    </button>
  );
}

export function IconButton({ label, className = '', children, ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
