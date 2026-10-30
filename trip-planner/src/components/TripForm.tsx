import { useState, type FormEvent } from 'react'
import { addDays, todayInTimeZone } from '../lib/dates'
import { ACTIVITIES, EXPERIENCE_LEVELS, type TripInput } from '../lib/types'
import { maxEndDate, validateTripInput } from '../lib/validateInput'

interface Props {
  loading: boolean
  onSubmit: (trip: TripInput) => void
  onInvalid: (errors: string[]) => void
}

export function TripForm({ loading, onSubmit, onInvalid }: Props) {
  // The browser's local date sets the picker range; the server re-checks against the location's date.
  const today = todayInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const latest = maxEndDate(today)

  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDays(today, 1))
  const [activity, setActivity] = useState<string>(ACTIVITIES[0])
  const [groupSize, setGroupSize] = useState('2')
  const [experience, setExperience] = useState<string>(EXPERIENCE_LEVELS[0])

  function handleStartChange(value: string) {
    setStartDate(value)
    if (value && endDate < value) setEndDate(value)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateTripInput({
      location,
      startDate,
      endDate,
      activity,
      groupSize: Number(groupSize),
      experience,
    })
    if (result.ok) onSubmit(result.data)
    else onInvalid(result.errors)
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <div className="field field-wide">
        <label htmlFor="location">Location</label>
        <input
          id="location"
          type="text"
          placeholder="e.g. Yosemite Valley, CA"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="start">Start date</label>
        <input id="start" type="date" min={today} max={latest} value={startDate} onChange={(e) => handleStartChange(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="end">End date</label>
        <input id="end" type="date" min={startDate || today} max={latest} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
      </div>

      <div className="field">
        <label htmlFor="activity">Activity</label>
        <select id="activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
          {ACTIVITIES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="experience">Experience</label>
        <select id="experience" value={experience} onChange={(e) => setExperience(e.target.value)}>
          {EXPERIENCE_LEVELS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="group">Group size</label>
        <input id="group" type="number" min={1} max={20} step={1} value={groupSize} onChange={(e) => setGroupSize(e.target.value)} required />
      </div>

      <p className="hint field-wide">Forecasts cover the next 16 days, so trips must end by {latest}.</p>

      <button className="field-wide" type="submit" disabled={loading}>
        {loading ? 'Checking conditions…' : 'Check my trip'}
      </button>
    </form>
  )
}
