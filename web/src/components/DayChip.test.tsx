import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DayChip, type DayInfo } from './DayChip';

const day = (over: Partial<DayInfo>): DayInfo => ({
  day: '2026-11-10',
  dayType: 'office',
  status: 'present',
  isLate: false,
  remark: null,
  ...over,
});

describe('DayChip', () => {
  it('renders the day-of-month number', () => {
    render(<DayChip d={day({})} isToday={false} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('exposes the day type / remark via title for accessibility', () => {
    const { container } = render(<DayChip d={day({ remark: 'WFH approved' })} isToday={false} />);
    expect(container.querySelector('[title="WFH approved"]')).not.toBeNull();
  });

  it('marks a holiday with a label and its name in the title', () => {
    const { container } = render(
      <DayChip d={day({ status: null, dayType: 'mandatory_holiday', holidayName: 'Diwali' })} isToday={false} />,
    );
    expect(screen.getByText(/holiday/i)).toBeInTheDocument();
    expect(container.querySelector('[title="Diwali"]')).not.toBeNull();
  });

  it('labels an approved leave day', () => {
    render(<DayChip d={day({ status: 'on_leave', dayType: 'office' })} isToday={false} />);
    expect(screen.getByText(/leave/i)).toBeInTheDocument();
  });
});
