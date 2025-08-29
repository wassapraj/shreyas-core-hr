
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, MessageCircle, Printer, Share2, Calendar, DollarSign, Clock, Users } from 'lucide-react';

interface EmployeeSnapshotHeaderProps {
  employeeId: string;
}

interface SnapshotData {
  leaves: {
    totalRequests: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
  };
  birthday: {
    date: string;
    daysToBirthday: number;
  };
  salary: {
    monthly_ctc: number;
    next_hike_date: string;
  };
  attendance: {
    present: number;
    absent: number;
    halfDay: number;
    total: number;
  };
}

const EmployeeSnapshotHeader = ({ employeeId }: EmployeeSnapshotHeaderProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageDialog, setMessageDialog] = useState(false);
  const [messageForm, setMessageForm] = useState({
    channel: 'Email' as 'Email' | 'WhatsApp',
    tone: 'HR' as 'HR' | 'Friendly' | 'Formal',
    intent: 'onboarding' as 'onboarding' | 'docs_missing' | 'policy' | 'custom',
    custom_prompt: ''
  });
  const [composedMessage, setComposedMessage] = useState<any>(null);

  useEffect(() => {
    fetchSnapshot();
  }, [employeeId]);

  const fetchSnapshot = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('employee-snapshot', {
        body: { employee_id: employeeId }
      });

      if (error) throw error;
      setSnapshot(data);
    } catch (error) {
      console.error('Error fetching snapshot:', error);
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
          employee_id: employeeId,
          channel: messageForm.channel,
          tone: messageForm.tone,
          intent: messageForm.intent,
          custom_prompt: messageForm.custom_prompt
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

  const saveToLog = async () => {
    if (!composedMessage || !user) return;
    
    try {
      const { error } = await supabase
        .from('messages_log')
        .insert({
          employee_id: employeeId,
          channel: messageForm.channel,
          subject: composedMessage.subject,
          body: composedMessage.body,
          created_by: user.id
        });

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Message saved to log'
      });
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: 'Error',
        description: 'Failed to save message',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard'
    });
  };

  const shareProfile = () => {
    const url = `${window.location.origin}/hr/employees/${employeeId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied',
      description: 'Profile link copied to clipboard'
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-lg h-32 mb-6"></div>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              {snapshot && (
                <>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-sm text-muted-foreground">Leaves (12m)</div>
                      <Badge variant={snapshot.leaves.pendingCount > 0 ? "destructive" : "secondary"}>
                        {snapshot.leaves.approvedCount}/{snapshot.leaves.totalRequests}
                        {snapshot.leaves.pendingCount > 0 && ` (${snapshot.leaves.pendingCount} pending)`}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="text-sm text-muted-foreground">This Month</div>
                      <Badge variant="outline">
                        P:{snapshot.attendance.present} A:{snapshot.attendance.absent} HD:{snapshot.attendance.halfDay}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <div>
                      <div className="text-sm text-muted-foreground">Birthday</div>
                      <Badge variant="outline">
                        {snapshot.birthday.daysToBirthday === 0 ? 'Today!' : 
                         snapshot.birthday.daysToBirthday > 0 ? `In ${snapshot.birthday.daysToBirthday} days` : 
                         snapshot.birthday.date}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="text-sm text-muted-foreground">Salary</div>
                      <Badge variant="outline">
                        ₹{snapshot.salary.monthly_ctc?.toLocaleString('en-IN')}
                      </Badge>
                      {snapshot.salary.next_hike_date && (
                        <div className="text-xs text-muted-foreground">
                          Next hike: {new Date(snapshot.salary.next_hike_date).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 ml-4">
              <Button size="sm" variant="outline" onClick={() => setMessageDialog(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setMessageForm(prev => ({ ...prev, channel: 'WhatsApp' }));
                setMessageDialog(true);
              }}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button size="sm" variant="outline" onClick={shareProfile}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compose {messageForm.channel} Message</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Channel</Label>
                <Select value={messageForm.channel} onValueChange={(value: 'Email' | 'WhatsApp') => 
                  setMessageForm(prev => ({ ...prev, channel: value }))}>
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
                <Select value={messageForm.tone} onValueChange={(value: 'HR' | 'Friendly' | 'Formal') => 
                  setMessageForm(prev => ({ ...prev, tone: value }))}>
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
              <Select value={messageForm.intent} onValueChange={(value: 'onboarding' | 'docs_missing' | 'policy' | 'custom') => 
                setMessageForm(prev => ({ ...prev, intent: value }))}>
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
                  onChange={(e) => setMessageForm(prev => ({ ...prev, custom_prompt: e.target.value }))}
                  placeholder="Enter your custom message..."
                  rows={3}
                />
              </div>
            )}

            <Button onClick={handleComposeMessage} className="w-full">
              Generate Message
            </Button>

            {composedMessage && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="font-semibold">Subject:</Label>
                  <p className="text-sm">{composedMessage.subject}</p>
                </div>
                <div>
                  <Label className="font-semibold">Message:</Label>
                  <pre className="text-sm whitespace-pre-wrap bg-background p-3 rounded border">
                    {composedMessage.body}
                  </pre>
                </div>
                
                <div className="flex gap-2 pt-2">
                  {messageForm.channel === 'Email' && composedMessage.mailto && (
                    <Button size="sm" onClick={() => window.open(composedMessage.mailto)}>
                      Open in Email
                    </Button>
                  )}
                  {messageForm.channel === 'WhatsApp' && composedMessage.whatsappDeepLink && (
                    <Button size="sm" onClick={() => window.open(composedMessage.whatsappDeepLink)}>
                      Open WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(composedMessage.body)}>
                    Copy Message
                  </Button>
                  <Button size="sm" variant="outline" onClick={saveToLog}>
                    Save to Log
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeSnapshotHeader;
