import { useState } from "react";
export default function PermissionMatrix({
  value,
  options,
  onChange,
  readOnly = false,
}) {
  const [query, setQuery] = useState("");
  const groups = [...new Set(options.map((p) => p.split(".")[0]))];
  return (
    <div className="permission-matrix">
      <label>
        Find a permission
        <input
          aria-label="Find permissions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tasks, employees, delete…"
        />
      </label>
      <p className="field-help">
        Tick Read to open a module, then tick the actions this role may perform.
        Administrator levels have full operational access; only Super Admin
        manages roles and administrator accounts.
      </p>
      {groups
        .filter((g) =>
          options.some(
            (p) => p.startsWith(g + ".") && p.includes(query.toLowerCase()),
          ),
        )
        .map((group) => (
          <fieldset key={group}>
            <legend>{group.replaceAll("_", " ")}</legend>
            {[
              ...new Set(
                options.filter(
                  (p) =>
                    p.startsWith(group + ".") &&
                    p.includes(query.toLowerCase()),
                ),
              ),
            ].map((p) => (
              <label className="check" key={p}>
                <input
                  type="checkbox"
                  aria-label={p}
                  checked={value.includes(p)}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...new Set([...value, p])]
                        : value.filter((x) => x !== p),
                    )
                  }
                />
                <span>
                  {p.split(".").slice(1).join(" ").replaceAll("_", " ")}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
    </div>
  );
}
