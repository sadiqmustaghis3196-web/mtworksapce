import { useState } from "react";
import { Link } from "react-router-dom";
import { financeFlow } from "../../modules/financeFlow";
export default function FinanceFlow({ data }) {
  const [month, setMonth] = useState("");
  const flow = financeFlow(data, month),
    currency =
      data.records.settings.find((s) => s.name === "Currency")?.value || "PKR";
  const money = (n) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n / 100);
  return (
    <section className="finance-money-flow">
      <header>
        <div>
          <p className="eyebrow">MONEY IN / MONEY OUT</p>
          <h2>Recorded cash flow</h2>
        </div>
        <label>
          Filter month
          <input
            type="month"
            aria-label="Cash flow month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <Link className="secondary" to="/finance/cashbook">
          Cash & bank register →
        </Link>
      </header>
      <div className="money-flow-metrics">
        <div>
          <span>Money received</span>
          <strong>{money(flow.incoming)}</strong>
        </div>
        <div>
          <span>Money paid</span>
          <strong>{money(flow.outgoing)}</strong>
        </div>
        <div>
          <span>Net recorded movement</span>
          <strong>{money(flow.net)}</strong>
        </div>
      </div>
      <p className="field-help">
        Posted movements, recorded invoice receipts, expenses and payroll.
        Drafts and voided movements do not affect totals. Record invoice
        receipts in Payments; use Cash & bank for other receipts, client refunds
        and vendor payouts.
      </p>
      <h3>Client money position</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Received in period</th>
              <th>Paid in period</th>
              <th>Invoice balance outstanding</th>
            </tr>
          </thead>
          <tbody>
            {flow.clients.map((c) => (
              <tr key={c.id}>
                <td>{c.company}</td>
                <td>{money(c.received)}</td>
                <td>{money(c.paid)}</td>
                <td>{money(c.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>{flow.entries.length} recorded movements</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Counterparty</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {flow.entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.counterparty}</td>
                  <td>{e.direction}</td>
                  <td>{money(e.amount)}</td>
                  <td>{e.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
