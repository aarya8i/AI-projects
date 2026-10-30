import type { PlanResponse } from '../lib/types'

export function Results({ plan }: { plan: PlanResponse }) {
  return (
    <section className="results" aria-labelledby="forecast-place">
      <div className="card place">
        <h2 id="forecast-place">Forecast for: {plan.resolvedPlace}</h2>
        <p className="hint">Wrong place? Try a more specific name (e.g. a nearby town or park).</p>
      </div>

      <div className={`card verdict verdict-${plan.verdict.toLowerCase()}`}>
        <span className="badge">{plan.verdict}</span>
        <p>{plan.reason}</p>
      </div>

      <div className="card">
        <h3>Top weather risks</h3>
        <ol className="risks">
          {plan.risks.map((risk, i) => (
            <li key={i}>
              <strong>{risk.title}</strong>
              <p>{risk.detail}</p>
              <p>
                <span className="label">What to do:</span> {risk.mitigation}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h3>Gear checklist</h3>
        <ul className="checklist">
          {plan.checklist.map((entry) => (
            <li key={entry.item}>
              <label>
                <input type="checkbox" />
                <span>
                  {entry.item}
                  {entry.essential ? (
                    <span className="tag">Ten Essentials</span>
                  ) : (
                    entry.why && <span className="why"> {entry.why}</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
