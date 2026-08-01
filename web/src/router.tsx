import { Navigate, createBrowserRouter } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Layout } from '@/components/Layout';
import { Login } from '@/screens/Login';
import { Home } from '@/screens/Home';
import { Tasks } from '@/screens/Tasks';
import { Campaigns } from '@/screens/Campaigns';
import { CampaignDetail } from '@/screens/CampaignDetail';
import { Attendance } from '@/screens/Attendance';
import { Leaderboard } from '@/screens/Leaderboard';
import { Profile } from '@/screens/Profile';
import { Leave } from '@/screens/Leave';
import { CompOff } from '@/screens/CompOff';
import { Notifications } from '@/screens/Notifications';
import { Admin } from '@/screens/Admin';

function Protected() {
  const status = useAuth((s) => s.status);
  if (status === 'anon') return <Navigate to="/login" replace />;
  return <Layout />;
}

function AdminOnly() {
  const isAdmin = useAuth((s) => s.user?.isAdmin);
  return isAdmin ? <Admin /> : <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <Protected />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'campaigns/:id', element: <CampaignDetail /> },
      { path: 'attendance', element: <Attendance /> },
      { path: 'leaderboard', element: <Leaderboard /> },
      { path: 'profile', element: <Profile /> },
      { path: 'leave', element: <Leave /> },
      { path: 'comp-off', element: <CompOff /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'admin', element: <AdminOnly /> },
    ],
  },
]);
