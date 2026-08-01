import type { HolidayRef } from '../../src/domain/dayType.js';

/** The seeded FY 2026-27 holiday calendar (PRD §10), used across day-type/salary tests. */
export const FY2627_HOLIDAYS: HolidayRef[] = [
  { day: '2026-04-03', type: 'optional_holiday' }, // Good Friday
  { day: '2026-05-01', type: 'mandatory_holiday' }, // Maharashtra Day
  { day: '2026-05-28', type: 'optional_holiday' }, // Bakri ID
  { day: '2026-06-26', type: 'optional_holiday' }, // Moharram
  { day: '2026-08-15', type: 'mandatory_holiday' }, // Independence Day
  { day: '2026-08-28', type: 'optional_holiday' }, // Raksha Bandhan
  { day: '2026-09-04', type: 'optional_holiday' }, // Janmashtami
  { day: '2026-09-14', type: 'mandatory_holiday' }, // Ganesh Chaturthi
  { day: '2026-09-25', type: 'optional_holiday' }, // Ganesh Visarjan
  { day: '2026-10-02', type: 'mandatory_holiday' }, // Gandhi Jayanti
  { day: '2026-10-20', type: 'optional_holiday' }, // Dussehra
  { day: '2026-11-09', type: 'mandatory_holiday' }, // Diwali
  { day: '2026-11-11', type: 'optional_holiday' }, // Bhai Duj
  { day: '2026-12-25', type: 'optional_holiday' }, // Christmas
  { day: '2027-01-01', type: 'mandatory_holiday' }, // New Year
  { day: '2027-01-15', type: 'optional_holiday' }, // Makar Sankranti
  { day: '2027-01-26', type: 'mandatory_holiday' }, // Republic Day
  { day: '2027-02-19', type: 'optional_holiday' }, // Shivaji Jayanti
  { day: '2027-02-24', type: 'optional_holiday' }, // Mahaveer Jayanti
  { day: '2027-03-10', type: 'optional_holiday' }, // Ramzan ID
  { day: '2027-03-19', type: 'optional_holiday' }, // Gudi Padwa
  { day: '2027-03-22', type: 'mandatory_holiday' }, // Holi
  { day: '2027-03-26', type: 'optional_holiday' }, // Good Friday
];
