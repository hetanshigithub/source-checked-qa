import { useId } from 'react'
import { percentPair } from '../../lib/format'

interface Props {
  value: number
  threshold: number
}

export function ConfidenceMeter({ value, threshold }: Props) {
  const labelId = useId()
  const clamped = Math.min(1, Math.max(0, value))
  const above = clamped >= threshold
  const [shownValue, shownThreshold] = percentPair(clamped, threshold)
  const valueText = `${shownValue}, ${above ? 'above' : 'below'} the ${shownThreshold} line`

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span id={labelId} className="text-sm font-semibold">
          Match confidence
        </span>
        <span className="text-sm tabular-nums">
          <strong className="font-semibold">{shownValue}</strong>
          <span className="text-muted"> · {above ? 'Passages cover the question' : 'Weak match'}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(clamped.toFixed(2))}
        aria-valuetext={valueText}
        className="relative mt-2 h-2.5 rounded-sm bg-line"
      >
        <div
          className={`meter-fill h-full rounded-sm ${above ? 'bg-accent' : 'bg-warn'}`}
          style={{ width: `${clamped * 100}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-1 h-4.5 w-0.5 bg-ink"
          style={{ left: `${threshold * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        How closely the retrieved passages match your question. The mark at {shownThreshold} is the
        line below which the documents probably don’t answer it. This is not the chance that the answer is
        correct.
      </p>
    </div>
  )
}
