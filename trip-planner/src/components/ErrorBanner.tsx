import type { FriendlyError } from '../lib/api'

export function ErrorBanner({ error }: { error: FriendlyError }) {
  return (
    <div className="banner" role="alert">
      <strong>{error.title}</strong>
      {error.detail && <p>{error.detail}</p>}
    </div>
  )
}
