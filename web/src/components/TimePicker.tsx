import { useId } from 'react';

/**
 * A 12-hour time picker with an explicit AM/PM control (v4 change log). The native
 * `<input type="time">` renders as a 24-hour field on many Android builds and desktop
 * browsers, which made "10:00" ambiguous — this never is. The value stays "HH:mm" 24-hour so
 * the API contract is unchanged.
 */
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function to12h(hhmm: string): { hour: number; minute: string; meridiem: 'AM' | 'PM' } {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = Number.isFinite(h) ? h : 10;
  const minute = Number.isFinite(m) ? String(m).padStart(2, '0') : '00';
  return { hour: hour % 12 === 0 ? 12 : hour % 12, minute, meridiem: hour < 12 ? 'AM' : 'PM' };
}

export function to24h(hour: number, minute: string, meridiem: 'AM' | 'PM'): string {
  const h = meridiem === 'AM' ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export function TimePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { hour, minute, meridiem } = to12h(value);
  // Keep an off-step minute (e.g. an older 10:07 task) selectable instead of silently snapping.
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [minute, ...MINUTES];

  return (
    <div>
      <label className="label" htmlFor={`${id}-hour`}>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <select
          id={`${id}-hour`}
          aria-label={`${label} hour`}
          className="input !px-2"
          value={hour}
          disabled={disabled}
          onChange={(e) => onChange(to24h(Number(e.target.value), minute, meridiem))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-muted">:</span>
        <select
          aria-label={`${label} minutes`}
          className="input !px-2"
          value={minute}
          disabled={disabled}
          onChange={(e) => onChange(to24h(hour, e.target.value, meridiem))}
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} AM or PM`}
          className="input !px-2"
          value={meridiem}
          disabled={disabled}
          onChange={(e) => onChange(to24h(hour, minute, e.target.value as 'AM' | 'PM'))}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
