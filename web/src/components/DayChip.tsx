/** Calendar day chip, colour-coded: teal=on-time, coral=late, lavender=WFH/half-day, amber=holiday, grey=off. */
export interface DayInfo {
  day: string;
  dayType: string;
  status: string | null;
  isLate: boolean;
  checkInAt?: string | null;
  holidayName?: string | null;
  remark: string | null;
}

const HOLIDAY_TYPES = ['mandatory_holiday', 'optional_holiday'];
const OFF_TYPES = ['sunday', 'fourth_saturday'];

export function DayChip({
  d,
  isToday,
  onSelect,
}: {
  d: DayInfo;
  isToday: boolean;
  onSelect?: (d: DayInfo) => void;
}) {
  const n = new Date(`${d.day}T00:00:00`).getDate();
  const isHoliday = HOLIDAY_TYPES.includes(d.dayType);
  let bg = 'bg-white/[0.04]';
  let text = 'text-ink/80';
  let label: string | null = null;

  switch (d.status) {
    case 'present':
      bg = 'bg-mint/20';
      text = 'text-mint';
      break;
    case 'late':
      bg = 'bg-coral/20';
      text = 'text-coral';
      break;
    case 'wfh':
      bg = 'bg-lavender/25';
      text = 'text-lavender';
      label = 'WFH';
      break;
    case 'half_day':
      bg = 'bg-lavender/25';
      text = 'text-lavender';
      label = 'Half';
      break;
    case 'on_leave':
      bg = 'bg-primary/20';
      text = 'text-[#c9beff]';
      label = 'Leave';
      break;
    case 'absent':
      bg = 'bg-coral/10';
      text = 'text-coral/70';
      break;
    case 'holiday':
    case 'weekend_off':
    default:
      // No attendance record: fall back to the calendar's own classification.
      if (isHoliday || d.status === 'holiday') {
        bg = 'bg-sunny/15';
        text = 'text-sunny';
        label = 'Holiday';
      } else if (OFF_TYPES.includes(d.dayType) || d.status === 'weekend_off') {
        bg = 'bg-white/[0.03]';
        text = 'text-muted/60';
        label = 'Off';
      } else if (d.dayType === 'second_saturday') {
        bg = 'bg-lavender/15';
        text = 'text-lavender/80';
        label = 'WFH';
      }
      break;
  }

  const title = d.holidayName ?? d.remark ?? d.dayType.replaceAll('_', ' ');
  const chipClass = `relative flex aspect-square flex-col items-center justify-center rounded-xl ${bg} ${
    isToday ? 'ring-1 ring-primary' : ''
  }`;
  const tappable = !!onSelect && (isHoliday || !!d.holidayName);

  const inner = (
    <>
      <span className={`text-[13px] font-semibold ${text}`}>{n}</span>
      {label && <span className={`mt-0.5 text-[8px] leading-none ${text} opacity-80`}>{label}</span>}
      {d.remark && <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-sunny" />}
    </>
  );

  if (tappable) {
    return (
      <button
        type="button"
        title={title}
        aria-label={d.holidayName ? `${d.holidayName} holiday details` : 'Holiday details'}
        onClick={() => onSelect!(d)}
        className={`${chipClass} transition hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-primary`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div title={title} className={chipClass}>
      {inner}
    </div>
  );
}
