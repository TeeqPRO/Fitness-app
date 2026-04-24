import { NavLink, Outlet } from 'react-router-dom';
import { Home, PlusCircle, Scale, Settings } from 'lucide-react';

const items = [
  { to: '/', icon: Home, label: 'Dziś' },
  { to: '/add', icon: PlusCircle, label: 'Dodaj' },
  { to: '/weight', icon: Scale, label: 'Waga' },
  { to: '/settings', icon: Settings, label: 'Profil' },
];

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <main className="flex-1 pb-24 safe-top">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md safe-bottom">
        <div className="mx-3 mb-3 glass rounded-3xl p-2 shadow-elevated">
          <div className="grid grid-cols-4 gap-1">
            {items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-medium transition-all ${
                    isActive ? 'bg-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                <Icon className="h-5 w-5" strokeWidth={2.2} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
