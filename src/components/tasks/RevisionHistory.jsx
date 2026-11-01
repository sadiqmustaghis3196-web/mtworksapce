export default function RevisionHistory({ task, onUpdate, busy }) {
  return (
    <section className="revision-history" id="revision-task-history">
      <p className="field-help">
        Each revision keeps the original instructions, work updates and review
        result.
      </p>
      {task.revisions?.length ? (
        [...task.revisions].reverse().map((r, index) => (
          <article className="revision-round" key={r.id}>
            <header>
              <strong>Revision #{r.number}</strong>
              <span className="badge">{r.status}</span>
            </header>
            <p>{r.reason}</p>
            <small>
              {r.requestedBy} ·{" "}
              {new Date(r.requestedAt).toLocaleString("en-GB", {
                timeZone: "Asia/Karachi",
              })}{" "}
              PKT
            </small>
            {r.updates?.map((u) => (
              <div className="revision-update" key={u.id}>
                <strong>{u.authorName}</strong>
                <p>{u.content}</p>
                <small>
                  {new Date(u.createdAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Karachi",
                  })}{" "}
                  PKT
                </small>
              </div>
            ))}
            {index === 0 && !["Approved", "Superseded"].includes(r.status) && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (await onUpdate(new FormData(form).get("content")))
                    form.reset();
                }}
              >
                <label>
                  Revision work update
                  <textarea
                    name="content"
                    minLength={3}
                    maxLength={5000}
                    required
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  Post revision update
                </button>
              </form>
            )}
          </article>
        ))
      ) : (
        <p className="muted">
          No revisions requested yet. Use Request revision when changes are
          needed.
        </p>
      )}
    </section>
  );
}
