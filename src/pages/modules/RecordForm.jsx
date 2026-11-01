import { useState, useRef, useId } from "react";
import {
  formDefaults,
  fieldHelp,
  formCalculation,
} from "../../modules/formSupport";
import { Modal } from "../../components/common/UI";
import { entities } from "../../modules/catalog";
export function displayName(entity, record) {
  return record?.[entities[entity]?.title] || record?.name || record?.id || "—";
}
export default function RecordForm({
  title,
  entity,
  fields,
  record = {},
  data,
  onClose,
  onSubmit,
  submitLabel = "Save record",
}) {
  const touched = useRef(new Set()),
    prefix = useId();
  const initial = formDefaults(entity, data, record);
  const [values, setValues] = useState(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          initial[f.key] ??
            (f.type === "permissions" || f.type === "multi-reference"
              ? []
              : f.type === "number"
                ? (f.min ?? 0)
                : ""),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key, value) => {
    touched.current.add(key);
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      if (
        entity === "payroll" &&
        key === "employeeId" &&
        !record.id &&
        !touched.current.has("gross")
      )
        next.gross =
          data.records.employees.find((e) => e.id === value)?.salary || "0.00";
      if (
        entity === "payments" &&
        key === "invoiceId" &&
        !record.id &&
        !touched.current.has("amount")
      ) {
        const invoice = data.records.invoices.find((i) => i.id === value);
        if (invoice)
          next.amount = (
            (invoice.totalCents - invoice.paidCents) /
            100
          ).toFixed(2);
      }
      if (
        key === "clientId" &&
        next.projectId &&
        data.projects.find((p) => p.id === next.projectId)?.clientId !== value
      )
        next.projectId = "";
      return next;
    });
  };
  const calculation = formCalculation(entity, values, data),
    currency =
      data.records.settings.find((s) => s.name === "Currency")?.value || "PKR";
  async function upload(field, file) {
    setError("");
    if (!file) {
      set(field.key, "");
      return;
    }
    if (file.size > 1048576) {
      setError("Each file must be 1 MB or smaller.");
      return;
    }
    const types = {
      pdf: "application/pdf",
      txt: "text/plain",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const type = types[file.name.split(".").pop().toLowerCase()];
    if (!type) {
      setError("Use a PDF, PNG, JPG, TXT or DOCX file.");
      return;
    }
    try {
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([file], { type }));
      });
      set(field.key, { name: file.name, type, size: file.size, data: encoded });
    } catch {
      setError("This file could not be read.");
    }
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} wide={fields.length > 6}>
      <form className="record-form" onSubmit={submit}>
        <div className="form-introduction">
          <span>{record.id ? "UPDATE RECORD" : "NEW RECORD"}</span>
          <p>
            {record.id
              ? "Changes are recorded in the workspace activity history."
              : "Complete the key details below. Related records keep your workflow connected."}
          </p>
        </div>
        <div className="record-form-grid">
          {fields.map((f) => {
            const value = values[f.key],
              multiple = ["permissions", "multi-reference"].includes(f.type),
              choices = f.ref
                ? (f.ref === "projects" ? data.projects : data.records[f.ref])
                    .filter(
                      (r) =>
                        f.key !== "projectId" ||
                        !values.clientId ||
                        r.clientId === values.clientId,
                    )
                    .map((r) => ({ value: r.id, label: displayName(f.ref, r) }))
                : f.options?.map((o) => ({ value: o, label: o }));
            return (
              <label
                key={f.key}
                className={
                  [
                    "textarea",
                    "permissions",
                    "file",
                    "multi-reference",
                  ].includes(f.type)
                    ? "full-field"
                    : ""
                }
              >
                {f.label}
                {f.required && (
                  <span className="required-star" aria-hidden="true">
                    {" "}
                    *
                  </span>
                )}
                {f.type === "textarea" ? (
                  <textarea
                    aria-label={f.label}
                    aria-describedby={
                      fieldHelp(entity, f.key)
                        ? `${prefix}-${f.key}-help`
                        : undefined
                    }
                    rows={3}
                    maxLength={5000}
                    value={value}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                  />
                ) : f.type === "permissions" ? (
                  <div className="permission-options">
                    {choices.map((o) => (
                      <label className="check" key={o.value}>
                        <input
                          aria-label={o.label}
                          type="checkbox"
                          checked={value.includes(o.value)}
                          onChange={(e) =>
                            set(
                              f.key,
                              e.target.checked
                                ? [...value, o.value]
                                : value.filter((v) => v !== o.value),
                            )
                          }
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : f.type === "file" ? (
                  <>
                    <input
                      aria-label={f.label}
                      aria-describedby={
                        fieldHelp(entity, f.key)
                          ? `${prefix}-${f.key}-help`
                          : undefined
                      }
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"
                      onChange={(e) => upload(f, e.target.files[0])}
                      required={f.required && !value?.name}
                    />
                    {value?.name && (
                      <span className="file-caption">
                        {value.name} · {Math.ceil(value.size / 1024)} KB
                      </span>
                    )}
                    <small className="field-help">
                      Stored in this browser only · maximum 1 MB
                    </small>
                  </>
                ) : choices ? (
                  <>
                    <select
                      aria-label={f.label}
                      aria-describedby={
                        fieldHelp(entity, f.key)
                          ? `${prefix}-${f.key}-help`
                          : undefined
                      }
                      multiple={multiple}
                      size={multiple ? 4 : undefined}
                      value={value}
                      onChange={(e) =>
                        set(
                          f.key,
                          multiple
                            ? Array.from(
                                e.target.selectedOptions,
                                (o) => o.value,
                              )
                            : e.target.value,
                        )
                      }
                      required={f.required}
                    >
                      {!multiple && (
                        <option value="">Select {f.label.toLowerCase()}</option>
                      )}
                      {choices.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {multiple && (
                      <small className="field-help">
                        Use Ctrl / Command to select multiple people.
                      </small>
                    )}
                  </>
                ) : (
                  <input
                    aria-label={f.label}
                    aria-describedby={
                      fieldHelp(entity, f.key)
                        ? `${prefix}-${f.key}-help`
                        : undefined
                    }
                    type={f.type === "money" ? "number" : f.type || "text"}
                    step={
                      f.type === "money"
                        ? "0.01"
                        : f.type === "number"
                          ? "1"
                          : undefined
                    }
                    min={f.type === "money" ? 0 : f.min}
                    max={f.max}
                    value={value}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                    maxLength={
                      f.type === "number" || f.type === "money"
                        ? undefined
                        : 5000
                    }
                  />
                )}
                {fieldHelp(entity, f.key) && (
                  <small className="field-help" id={`${prefix}-${f.key}-help`}>
                    {fieldHelp(entity, f.key)}
                  </small>
                )}
              </label>
            );
          })}
        </div>
        {calculation && (
          <div className="form-calculation">
            <div>
              <span>{calculation.label}</span>
              <small>{calculation.detail}</small>
            </div>
            <strong>
              {calculation.amount === null
                ? "Check values"
                : `${currency} ${Number(calculation.amount).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </strong>
          </div>
        )}
        {error && (
          <p className="error form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-buttons">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
