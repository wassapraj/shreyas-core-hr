import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Megaphone,
  Calendar,
  Eye,
  Users
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: string;
  posted_on: string;
  read_count: number;
  created_at: string;
}

const EmployeeAnnouncements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadEmployeeAndAnnouncements();
    }
  }, [user]);

  const loadEmployeeAndAnnouncements = async () => {
    try {
      setLoading(true);
      
      // First get current employee details
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select('id, department, location')
        .eq('user_id', user?.id)
        .single();

      if (empError) throw empError;
      setEmployee(employeeData);

      // Load announcements based on audience
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .or(`audience.eq.All,and(audience.eq.Department,department.eq.${employeeData.department}),and(audience.eq.Location,location.eq.${employeeData.location})`)
        .order('posted_on', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);

    } catch (error) {
      console.error('Error loading announcements:', error);
      // Fallback: load all announcements with audience 'All'
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('announcements')
          .select('*')
          .eq('audience', 'All')
          .order('posted_on', { ascending: false });

        if (fallbackError) throw fallbackError;
        setAnnouncements(fallbackData || []);
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load announcements"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId: string) => {
    try {
      // Direct update to increment read count
      const announcement = announcements.find(a => a.id === announcementId);
      if (announcement) {
        await supabase
          .from('announcements')
          .update({ read_count: announcement.read_count + 1 })
          .eq('id', announcementId);

        // Update local state
        setAnnouncements(prev => prev.map(a => 
          a.id === announcementId 
            ? { ...a, read_count: a.read_count + 1 }
            : a
        ));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      // Don't show error to user as this is not critical
    }
  };

  const toggleExpanded = (announcementId: string) => {
    if (expandedId === announcementId) {
      setExpandedId(null);
    } else {
      setExpandedId(announcementId);
      markAsRead(announcementId);
    }
  };

  const getAudienceBadge = (audience: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      'All': 'default',
      'Department': 'secondary',
      'Location': 'outline'
    };
    return <Badge variant={variants[audience] || 'outline'}>{audience}</Badge>;
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const posted = new Date(dateString);
    const diffMs = now.getTime() - posted.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays > 7) {
      return posted.toLocaleDateString();
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold gradient-text">Announcements</h1>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold gradient-text">Company Announcements</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Megaphone className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Available</p>
                <p className="text-2xl font-bold">{announcements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">
                  {announcements.filter(a => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return new Date(a.posted_on) >= weekAgo;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">For You</p>
                <p className="text-2xl font-bold">
                  {announcements.filter(a => a.audience === 'All' || 
                    (a.audience === 'Department' && employee?.department) ||
                    (a.audience === 'Location' && employee?.location)
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
          <CardDescription>
            Stay updated with the latest company news and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No announcements available at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                const isExpanded = expandedId === announcement.id;
                
                return (
                  <div
                    key={announcement.id}
                    className="border rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleExpanded(announcement.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{announcement.title}</h3>
                            {getAudienceBadge(announcement.audience)}
                          </div>
                          
                          {!isExpanded && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {announcement.message}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{getTimeAgo(announcement.posted_on)}</span>
                            <span>{announcement.read_count} reads</span>
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t bg-muted/20">
                        <div className="pt-4">
                          <div className="prose prose-sm max-w-none">
                            <div className="whitespace-pre-wrap text-sm">
                              {announcement.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeAnnouncements;