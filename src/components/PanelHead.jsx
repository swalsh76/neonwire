// Panel title bar: outlined index numeral, wide-caps title, Japanese sub-label, count, then actions.
export default function PanelHead({ idx, title, jp, count, children }) {
  return (
    <header className="ph">
      <span className="ph-idx">{idx}</span>
      <span className="ph-title">
        {title}
        {jp && <i>{jp}</i>}
        {count !== undefined && <b>[{count}]</b>}
      </span>
      {children}
    </header>
  );
}
