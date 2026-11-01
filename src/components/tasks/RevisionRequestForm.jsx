import { useState } from "react";
import { Modal } from "../common/UI";
export default function RevisionRequestForm({ task, onClose, onSave, busy }) {
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  return (
    <Modal title={`Request revision · Task #${task.id}`} onClose={onClose}>
      <p className="muted">
        Describe the client feedback or requested changes. The same task moves
        to Revision & Updates and keeps its document, assignees and history.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const reason = String(
            new FormData(e.currentTarget).get("reason") || "",
          ).trim();
          if (reason.length < 5) {
            setError(
              "Describe the requested revision in at least 5 characters.",
            );
            return;
          }
          setSubmitting(true);
          setError("");
          try {
            const result = await onSave(task, 6, reason);
            if (result?.error) setError(result.error);
          } catch (e) {
            setError(e.message);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label>
          Revision instructions
          <textarea
            name="reason"
            required
            minLength={5}
            maxLength={2000}
            rows={5}
          />
        </label>
        <button className="primary" disabled={busy || submitting}>
          Request revision
        </button>
      </form>
    </Modal>
  );
}
