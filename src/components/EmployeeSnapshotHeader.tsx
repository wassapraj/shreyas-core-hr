
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  MessageSquare, 
  Printer, 
  Share2, 
  Calendar, 
  Clock, 
  CakeIcon, 
  DollarSign 
} from 'lucide-react';

interface EmployeeSnapshotHeaderProps {
  employee: any;
  isHR: boolean;
}

const EmployeeSnapshotHeader: React.FC<EmployeeSnapshotHeaderProps> = ({ employee, isHR }) => {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [messageDialog, setMessageDialog] = useState(false);
  const [messageForm, setMessageForm] = useState({
    channel: 'Email',
    tone: 'HR',
    intent: 'onboarding',
    custom_prompt: ''
  });
  const [composedMessage, setComposedMessage] = useState<any>(null);

  useEffect(() => {
    loadSnapshot();
  }, [employee.id]);

  const loadSnapshot = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('employee-snapshot', {
        body: { employee_id: employee.id }
      });

      if (error) throw error;
      setSnapshot(data);
    } catch (error) {
      console.error('Error loading snapshot:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee snapshot',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComposeMessage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('compose-employee-message', {
        body: {
          employee_id: employee.id,
          ...messageForm
        }
      });

      if (error) throw error;
      setComposedMessage(data);
    } catch (error) {
      console.error('Error composing message:', error);
      toast({
        title: 'Error',
        description: 'Failed to compose message',
        variant: 'destructive'
      });
    }
  };

  const handleSendMessage = (type: 'email' | 'whatsapp') => {
    if (!composedMessage) return;

    if (type === 'email') {
      window.open(composedMessage.mailto, '_blank');
    } else if (type === 'whatsapp' && composedMessage.whatsappDeepLink) {
      window.open(composedMessage.whatsappDeepLink, '_blank');
    }

    // Save to messages log
    supabase.from('messages_log').insert({
      employee_id: employee.id,
      channel: messageForm.channel,
      subject: composedMessage.subject,
      body: composedMessage.body,
      created_by: employee.user_id
    });

    setMessageDialog(false);
    toast({
      title: 'Message Opened',
      description: `${type === 'email' ? 'Email client' : 'WhatsApp'} opened successfully`
    });
  };

  const handleShareProfile = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied',
      description: 'Profile link copied to clipboard'
    });
  };

  const handlePrintProfile = () => {
    window.print();
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-48"></div>
                <div className="h-4 bg-muted rounded w-32"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-9 bg-muted rounded w-20"></div>
                <div className="h-9 bg-muted rounded w-20"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-muted-foreground">
              {employee.designation} • {employee.department}
            </p>
          </div>
          
          {isHR && (
            <div className="flex gap-2">
              <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Compose Message</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Channel</Label>
                        <Select 
                          value={messageForm.channel} 
                          onValueChange={(value) => setMessageForm({...messageForm, channel: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tone</Label>
                        <Select 
                          value={messageForm.tone} 
                          onValueChange={(value) => setMessageForm({...messageForm, tone: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="Friendly">Friendly</SelectItem>
                            <SelectItem value="Formal">Formal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Intent</Label>
                      <Select 
                        value={messageForm.intent} 
                        onValueChange={(value) => setMessageForm({...messageForm, intent: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onboarding">Onboarding</SelectItem>
                          <SelectItem value="docs_missing">Documents Missing</SelectItem>
                          <SelectItem value="policy">Policy Update</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {messageForm.intent === 'custom' && (
                      <div>
                        <Label>Custom Message</Label>
                        <Textarea 
                          value={messageForm.custom_prompt}
                          onChange={(e) => setMessageForm({...messageForm, custom_prompt: e.target.value})}
                          placeholder="Enter your custom message..."
                        />
                      </div>
                    )}

                    <Button onClick={handleComposeMessage} className="w-full">
                      Generate Message
                    </Button>

                    {composedMessage && (
                      <div className="space-y-4 border-t pt-4">
                        <div>
                          <Label>Subject</Label>
                          <div className="p-2 bg-muted rounded text-sm">
                            {composedMessage.subject}
                          </div>
                        </div>
                        <div>
                          <Label>Message</Label>
                          <div className="p-2 bg-muted rounded text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {composedMessage.body}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleSendMessage('email')} className="flex-1">
                            <Mail className="h-4 w-4 mr-2" />
                            Open in Email
                          </Button>
                          {messageForm.channel === 'WhatsApp' && composedMessage.whatsappDeepLink && (
                            <Button onClick={() => handleSendMessage('whatsapp')} className="flex-1" variant="outline">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Open WhatsApp
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={handlePrintProfile}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleShareProfile}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Leaves Pill */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Leaves (12m)</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Approved:</span>
                  <Badge variant="default">{snapshot.leaves?.approvedCount || 0}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pending:</span>
                  <Badge variant="secondary">{snapshot.leaves?.pendingCount || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Pill */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">This Month</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Present:</span>
                  <Badge variant="default">{snapshot.attendance?.P || 0}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Absent:</span>
                  <Badge variant="destructive">{snapshot.attendance?.A || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Birthday Pill */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <CakeIcon className="h-4 w-4 text-pink-500" />
                <span className="text-sm font-medium">Birthday</span>
              </div>
              <div className="space-y-1">
                {snapshot.birthday ? (
                  <>
                    <div className="text-lg font-bold">{snapshot.birthday.date}</div>
                    <div className="text-xs text-muted-foreground">
                      {snapshot.birthday.daysToBirthday === 0 ? 'Today!' : 
                       snapshot.birthday.daysToBirthday === 1 ? 'Tomorrow' : 
                       `In ${snapshot.birthday.daysToBirthday} days`}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Not provided</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Salary Pill */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Salary</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold">
                  ₹{snapshot.salary?.monthly_ctc?.toLocaleString() || '0'}
                </div>
                {snapshot.salary?.next_hike_date && (
                  <div className="text-xs text-muted-foreground">
                    Next hike: {snapshot.salary.next_hike_date}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeSnapshotHeader;
