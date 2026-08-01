import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Logo } from './Logo';
import {
  IconBell,
  IconCalendar,
  IconCampaign,
  IconHome,
  IconTasks,
  IconUser,
} from './Icons';
import { api } from '@/lib/api';

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/tasks', label: 'Tasks', Icon: IconTasks, end: false },
  { to: '/campaigns', label: 'Campaigns', Icon: IconCampaign, end: false },
  { to: '/attendance', label: 'Attendance', Icon: IconCalendar, end: false },
  { to: '/profile', label: 'Profile', Icon: IconUser, end: false },
];

export function Layout() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/notifications'),
    refetchInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between bg-bg/80 px-4 py-3 backdrop-blur">
        <Logo height={22} />
        <button
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="relative rounded-full p-2 text-muted transition hover:text-ink"
        >
          <IconBell />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral ring-2 ring-bg" />
          )}
        </button>
      </header>

      <main className="flex-1 px-4 pb-28 pt-2">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-white/10 bg-surface/95 px-2 pt-2 backdrop-blur">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] transition ${
                isActive ? 'text-primary' : 'text-muted'
              }`
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
