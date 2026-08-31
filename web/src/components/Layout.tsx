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
import { BreakMonitor } from './BreakMonitor';

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/tasks', label: 'Tasks', Icon: IconTasks, end: false },
  { to: '/campaigns', label: 'Campaigns', Icon: IconCampaign, end: false },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar, end: false },
  { to: '/profile', label: 'Profile', Icon: IconUser, end: false },
];

/**
 * One shell, two shapes (v4 change log). On a phone it stays the single-column app with a
 * bottom tab bar; from `lg` up the navigation moves to a fixed side rail and the content
 * stretches to fill a laptop screen instead of sitting in a narrow strip.
 */
export function Layout() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/notifications'),
    refetchInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <div className="flex min-h-full lg:gap-0">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-white/10 bg-surface/40 px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo height={24} />
        </div>
        <nav className="flex flex-col gap-1">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-white/5 hover:text-ink'
                }`
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-full w-full flex-col">
        <header className="safe-top sticky top-0 z-30 flex items-center justify-between bg-bg/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <Logo height={22} />
          </div>
          <div className="hidden lg:block" />
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

        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-2 lg:max-w-6xl lg:px-8 lg:pb-12">
          <Outlet />
        </main>

        <BreakMonitor />

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-white/10 bg-surface/95 px-2 pt-2 backdrop-blur lg:hidden">
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
    </div>
  );
}
