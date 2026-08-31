import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CampaignCard, type CampaignDto } from './CampaignCard';

const campaign = (over: Partial<CampaignDto> = {}): CampaignDto => ({
  id: 'c1',
  name: 'Festive Push',
  clientName: 'Sugar Cosmetics',
  leadId: 'u1',
  leadName: 'Rohan Mehta',
  deadline: '2026-12-01',
  status: 'in_progress',
  color: null,
  members: [
    { userId: 'u1', fullName: 'Rohan Mehta' },
    { userId: 'u2', fullName: 'Sneha Kapoor' },
  ],
  memberNames: ['Rohan Mehta', 'Sneha Kapoor'],
  memberCount: 2,
  state: 'on_track',
  ...over,
});

const show = (c: CampaignDto) =>
  render(
    <MemoryRouter>
      <CampaignCard c={c} />
    </MemoryRouter>,
  );

describe('CampaignCard', () => {
  it('names the lead and the team instead of counting them (v4 feedback)', () => {
    const { container } = show(campaign());
    // The lead appears twice on purpose — once as the lead, once inside the team line.
    expect(container.textContent).toMatch(/Lead:\s*Rohan Mehta/);
    expect(container.textContent).toMatch(/Team:\s*Rohan Mehta, Sneha Kapoor/);
    expect(screen.queryByText(/2 members/)).toBeNull();
  });

  it('shows the deadline on the card', () => {
    const { container } = show(campaign());
    expect(container.textContent).toMatch(/Deadline:/);
    expect(container.textContent).toMatch(/1 Dec/);
  });

  it('rolls a long team up into "+N more" rather than wrapping into a wall', () => {
    const { container } = show(
      campaign({ memberNames: ['Aarav', 'Bhavna', 'Chirag', 'Divya', 'Esha'], memberCount: 5 }),
    );
    expect(container.textContent).toMatch(/\+2 more/);
  });

  it('says so plainly when nobody is on the campaign yet', () => {
    const { container } = show(campaign({ leadName: null, memberNames: [], memberCount: 0 }));
    expect(container.textContent).toMatch(/Not assigned yet/);
    expect(container.textContent).toMatch(/No one added yet/);
  });
});
