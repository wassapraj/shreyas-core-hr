import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  Calendar, 
  Clock, 
  DollarSign, 
  Package, 
  Bell, 
  Home,
  LogOut,
  User
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, userRole, signOut, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navigation = [
    ...(hasRole('hr') ? [
      { name: 'HR Dashboard', href: '/hr', icon: Home },
      { name: 'Employees', href: '/hr/employees', icon: Users },
      { name: 'Attendance', href: '/hr/attendance', icon: Clock },
      { name: 'Leaves', href: '/hr/leaves', icon: Calendar },
      { name: 'Payroll', href: '/hr/payroll', icon: DollarSign },
      { name: 'Assets', href: '/hr/assets', icon: Package },
      { name: 'Announcements', href: '/hr/announcements', icon: Bell },
    ] : []),
    { name: 'My Profile', href: '/me', icon: User },
    { name: 'My Leaves', href: '/me/leave', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/55fc8fc5-a89f-4a00-bcb1-ab0c5499703f.png" 
              alt="Shreyas Logo" 
              className="h-8"
            />
            <div>
              <h1 className="text-lg font-semibold">Shreyas HRMS</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <p className="font-medium">{user?.email}</p>
              <p className="text-muted-foreground capitalize">{userRole}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-card border-r h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;