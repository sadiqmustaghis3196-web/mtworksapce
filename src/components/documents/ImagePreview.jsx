import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Expand } from "lucide-react";
export default function ImagePreview({ src, caption }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null),
    trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    dialog.showModal();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      dialog.close();
      trigger.current?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="document-image-thumb"
        aria-label={`Open image: ${caption || "Task reference"}`}
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={caption || "Task reference"} />
        <span>
          <Expand size={13} /> View full image
        </span>
      </button>
      {open &&
        createPortal(
          <dialog
            ref={ref}
            className="document-image-viewer"
            aria-label="Image preview"
            onCancel={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <header>
              <strong>{caption || "Task reference"}</strong>
              <button
                type="button"
                aria-label="Close image"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <img src={src} alt={caption || "Task reference"} />
          </dialog>,
          document.body,
        )}
    </>
  );
}
