import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Eye,
  MessageSquare,
  Users,
  Megaphone,
  Calendar
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

const HRAnnouncements = () => {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    audience: 'All'
  });

  const quickTemplates = [
    {
      name: 'WhatsApp short',
      template: (title: string) => `Hey team, ${title}. — Shreyas Media`
    },
    {
      name: 'Email formal',
      template: (title: string) => `Dear All,\n\n${title}\n\nRegards,\nShreyas Media HR`
    },
    {
      name: 'Noticeboard bullets',
      template: (title: string) => `⚡ ${title}\n- Point 1\n- Point 2\n\n— HR Desk`
    }
  ];

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('posted_on', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load announcements"
      });
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.message) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Title and message are required"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          ...announcementForm,
          posted_on: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Announcement created successfully"
      });

      setCreateModalOpen(false);
      setAnnouncementForm({
        title: '',
        message: '',
        audience: 'All'
      });
      loadAnnouncements();
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create announcement"
      });
    }
  };

  const updateAnnouncement = async () => {
    if (!selectedAnnouncement || !announcementForm.title || !announcementForm.message) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Title and message are required"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .update(announcementForm)
        .eq('id', selectedAnnouncement.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Announcement updated successfully"
      });

      setEditModalOpen(false);
      setSelectedAnnouncement(null);
      loadAnnouncements();
    } catch (error: any) {
      console.error('Error updating announcement:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update announcement"
      });
    }
  };

  const applyTemplate = (templateName: string) => {
    const template = quickTemplates.find(t => t.name === templateName);
    if (template && announcementForm.title) {
      setAnnouncementForm({
        ...announcementForm,
        message: template.template(announcementForm.title)
      });
    } else if (template) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a title first to use templates"
      });
    }
  };

  const openEditModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      message: announcement.message,
      audience: announcement.audience
    });
    setEditModalOpen(true);
  };

  const getAudienceBadge = (audience: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      'All': 'default',
      'Department': 'secondary',
      'Location': 'outline'
    };
    return <Badge variant={variants[audience] || 'outline'}>{audience}</Badge>;
  };

  const audienceCounts = {
    All: announcements.filter(a => a.audience === 'All').length,
    Department: announcements.filter(a => a.audience === 'Department').length,
    Location: announcements.filter(a => a.audience === 'Location').length
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
        <h1 className="text-3xl font-bold gradient-text">Announcements</h1>
        
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Announcement</DialogTitle>
              <DialogDescription>
                Create and publish a new announcement for employees.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter announcement title"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="form-modern"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message">Message *</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Quick Templates" />
                    </SelectTrigger>
                    <SelectContent>
                      {quickTemplates.map(template => (
                        <SelectItem key={template.name} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="message"
                  placeholder="Enter your announcement message"
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                  className="form-modern min-h-32"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="audience">Audience</Label>
                <Select value={announcementForm.audience} onValueChange={(value) => setAnnouncementForm({ ...announcementForm, audience: value })}>
                  <SelectTrigger className="form-modern">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Employees</SelectItem>
                    <SelectItem value="Department">By Department</SelectItem>
                    <SelectItem value="Location">By Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createAnnouncement}>Create Announcement</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Megaphone className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{announcements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">All Employees</p>
                <p className="text-2xl font-bold">{audienceCounts.All}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="text-2xl font-bold">{audienceCounts.Department}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="text-2xl font-bold">{audienceCounts.Location}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Published Announcements</CardTitle>
          <CardDescription>
            Manage and track all company announcements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No announcements found. Create your first announcement to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="flex items-start justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{announcement.title}</h3>
                      {getAudienceBadge(announcement.audience)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {announcement.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Posted: {new Date(announcement.posted_on).toLocaleDateString()}</span>
                      <span>Reads: {announcement.read_count}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(announcement)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Announcement Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="glass-card max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update announcement content and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit_title">Title *</Label>
              <Input
                id="edit_title"
                placeholder="Enter announcement title"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                className="form-modern"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit_message">Message *</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Quick Templates" />
                  </SelectTrigger>
                  <SelectContent>
                    {quickTemplates.map(template => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                id="edit_message"
                placeholder="Enter your announcement message"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                className="form-modern min-h-32"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_audience">Audience</Label>
              <Select value={announcementForm.audience} onValueChange={(value) => setAnnouncementForm({ ...announcementForm, audience: value })}>
                <SelectTrigger className="form-modern">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Employees</SelectItem>
                  <SelectItem value="Department">By Department</SelectItem>
                  <SelectItem value="Location">By Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateAnnouncement}>Update Announcement</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRAnnouncements;