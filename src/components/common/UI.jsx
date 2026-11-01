import { useEffect, useRef, useId } from "react";
import { X, AlertCircle, LoaderCircle, Inbox } from "lucide-react";
export function State({ error, loading, children }) {
  return (
    <div
      className={`state ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error ? (
        <AlertCircle />
      ) : loading ? (
        <LoaderCircle className="spin" />
      ) : (
        <Inbox />
      )}
      <p>
        {error ||
          children ||
          (loading ? "Loading your workspace…" : "No records yet.")}
      </p>
    </div>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const titleId = useId();
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    const close = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    const dialog = ref.current;
    dialog.addEventListener("keydown", close);
    return () => {
      dialog.removeEventListener("keydown", close);
      dialog.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button className="icon" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function DataTable({ columns, rows, onRow }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                  {onRow && c === columns[0] && (
                    <button className="link" onClick={() => onRow(r)}>
                      Open
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <State>No matching records.</State>}
    </div>
  );
}
