/** Calendar day chip, colour-coded (PRD §6.4): teal=on-time, coral=late, lavender=WFH, grey=off. */
export interface DayInfo {
  day: string;
  dayType: string;
  status: string | null;
  isLate: boolean;
  remark: string | null;
}

export function DayChip({ d, isToday }: { d: DayInfo; isToday: boolean }) {
  const n = new Date(`${d.day}T00:00:00`).getDate();
  let bg = 'bg-white/[0.04]';
  let text = 'text-ink/80';

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
    case 'half_day':
      bg = 'bg-lavender/25';
      text = 'text-lavender';
      break;
    case 'on_leave':
      bg = 'bg-primary/20';
      text = 'text-[#c9beff]';
      break;
    case 'holiday':
    case 'weekend_off':
      bg = 'bg-white/[0.03]';
      text = 'text-muted/60';
      break;
    case 'absent':
      bg = 'bg-coral/10';
      text = 'text-coral/70';
      break;
    default:
      break;
  }

  return (
    <div
      title={d.remark ?? d.dayType}
      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl ${bg} ${
        isToday ? 'ring-1 ring-primary' : ''
      }`}
    >
      <span className={`text-[13px] font-semibold ${text}`}>{n}</span>
      {d.remark && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sunny" />}
    </div>
  );
}
