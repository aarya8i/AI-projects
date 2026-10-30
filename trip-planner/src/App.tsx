import { useState } from 'react'
import { ErrorBanner } from './components/ErrorBanner'
import { Results } from './components/Results'
import { TripForm } from './components/TripForm'
import { requestPlan, type FriendlyError } from './lib/api'
import type { PlanResponse, TripInput } from './lib/types'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [error, setError] = useState<FriendlyError | null>(null)

  async function handleSubmit(trip: TripInput) {
    setLoading(true)
    setError(null)
    setPlan(null)
    const result = await requestPlan(trip)
    if (result.ok) setPlan(result.data)
    else setError(result.error)
    setLoading(false)
  }

  function handleInvalid(errors: string[]) {
    setPlan(null)
    setError({ title: 'Please check your trip details.', detail: errors.join(' ') })
  }

  return (
    <main className="page">
      <header>
        <h1>Trip Readiness Planner</h1>
        <p className="subtitle">Check the forecast, get a go/no-go verdict, and build your gear list.</p>
      </header>

      <TripForm loading={loading} onSubmit={handleSubmit} onInvalid={handleInvalid} />

      <div aria-live="polite">
        {loading && <p className="loading">Checking the forecast and assessing your trip…</p>}
        {error && <ErrorBanner error={error} />}
        {plan && <Results plan={plan} />}
      </div>

      <footer className="disclaimer">
        This is a planning aid only. It is not a substitute for official conditions, ranger or land-agency
        guidance, and your own judgment. Weather can change quickly.
      </footer>
    </main>
  )
}
