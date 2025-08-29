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
  User,
  FileText,
  StickyNote
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
      { name: 'Leave Inbox', href: '/hr/leaves', icon: Calendar },
      { name: 'Payroll', href: '/hr/payroll', icon: DollarSign },
      { name: 'Offers', href: '/hr/offers', icon: FileText },
      { name: 'Assets', href: '/hr/assets', icon: Package },
      { name: 'Announcements', href: '/hr/announcements', icon: Bell },
      { name: 'Notes', href: '/hr/notes', icon: StickyNote },
      { name: 'Reminders', href: '/hr/reminders', icon: Clock },
    ] : []),
    { name: 'My Profile', href: '/me', icon: User },
    { name: 'My Leaves', href: '/me/leave', icon: Calendar },
    { name: 'My Assets', href: '/me/assets', icon: Package },
    { name: 'Announcements', href: '/me/announcements', icon: Bell },
    { name: 'Notes', href: '/me/notes', icon: StickyNote },
    { name: 'Reminders', href: '/me/reminders', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Header with gradient */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl shadow-lg sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/55fc8fc5-a89f-4a00-bcb1-ab0c5499703f.png" 
              alt="Shreyas Logo" 
              className="h-8 drop-shadow-sm"
            />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Shreyas HRMS
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <p className="font-medium text-foreground">{user?.email}</p>
              <p className="text-muted-foreground capitalize">{userRole}</p>
            </div>
            <Button variant="modern" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Modern Sidebar with glass effect */}
        <aside className="w-64 bg-card/30 backdrop-blur-xl border-r border-border h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:shadow-md'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content with modern spacing */}
        <main className="flex-1 overflow-auto bg-background/50">
          <div className="p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;