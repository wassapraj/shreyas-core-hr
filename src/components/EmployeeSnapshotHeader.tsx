
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, MessageCircle, Phone, Calendar, DollarSign, Calendar as CalendarIcon } from 'lucide-react';
import { createWhatsAppUrl, toE164 } from '@/lib/phoneUtils';
import { EmployeeAvatar } from './EmployeeAvatar';

interface EmployeeSnapshotHeaderProps {
  employeeId: string;
  isHR?: boolean;
  isSelfView?: boolean;
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

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  emp_code: string;
  department: string;
  designation: string;
  phone: string;
  email: string;
  avatar_url?: string;
}

const EmployeeSnapshotHeader = ({ employeeId, isHR = false, isSelfView = false }: EmployeeSnapshotHeaderProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [messageForm, setMessageForm] = useState({
    channel: 'WhatsApp' as 'WhatsApp' | 'Email',
    tone: 'HR' as 'HR' | 'Friendly' | 'Formal',
    intent: 'Reminder' as 'Reminder' | 'Congrats' | 'Warning' | 'Custom',
    custom_prompt: ''
  });
  const [composedMessage, setComposedMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchSnapshot();
    fetchEmployee();
  }, [employeeId]);

  const fetchEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, emp_code, department, designation, phone, email, avatar_url')
        .eq('id', employeeId)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
    }
  };

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

  const handleGenerateMessage = async () => {
    if (!employee) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('compose-quick-message', {
        body: {
          kind: messageForm.intent.toLowerCase(),
          employee_name: `${employee.first_name} ${employee.last_name}`,
          dept: employee.department,
          datesText: '',
          channel: messageForm.channel,
          tone: messageForm.tone,
          custom_prompt: messageForm.intent === 'Custom' ? messageForm.custom_prompt : ''
        }
      });

      if (error) throw error;
      setComposedMessage(data.message);
    } catch (error) {
      console.error('Error generating message:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate message',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmail = () => {
    if (!employee?.email) return;
    const subject = `Regarding ${employee.emp_code}`;
    window.open(`mailto:${employee.email}?subject=${encodeURIComponent(subject)}`);
  };

  const handleWhatsApp = () => {
    if (!employee?.phone) {
      toast({
        variant: 'destructive',
        title: 'No Phone Number',
        description: 'This employee does not have a phone number on file.'
      });
      return;
    }
    
    const whatsappUrl = createWhatsAppUrl(employee.phone, `Hi ${employee.first_name}, this is HR from Shreyas HRMS.`);
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank');
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid Phone Number',
        description: 'Unable to format the phone number for WhatsApp.'
      });
    }
  };

  const handleCall = () => {
    if (!employee?.phone) {
      toast({
        variant: 'destructive',
        title: 'No Phone Number',
        description: 'This employee does not have a phone number on file.'
      });
      return;
    }

    const e164Phone = toE164(employee.phone);
    if (e164Phone) {
      window.open(`tel:${e164Phone}`);
    } else {
      // Fallback for 10-digit numbers
      const cleaned = employee.phone.replace(/\D/g, '');
      if (cleaned.length === 10) {
        window.open(`tel:+91${cleaned}`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Invalid Phone Number',
          description: 'Unable to format the phone number for calling.'
        });
      }
    }
  };

  const handleCopyMessage = () => {
    if (!composedMessage) return;
    navigator.clipboard.writeText(composedMessage);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard'
    });
  };

  const handleOpenInEmail = () => {
    if (!employee?.email || !composedMessage) return;
    const subject = `Regarding ${employee.emp_code}`;
    window.open(`mailto:${employee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(composedMessage)}`);
  };

  const handleOpenInWhatsApp = () => {
    if (!employee?.phone || !composedMessage) return;
    const whatsappUrl = createWhatsAppUrl(employee.phone, composedMessage);
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank');
    }
  };

  const isPhoneAvailable = employee?.phone && (toE164(employee.phone) || employee.phone.replace(/\D/g, '').length === 10);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-lg h-32 mb-6"></div>
    );
  }

  if (!employee) return null;

  return (
    <>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {/* Left: Avatar */}
            <div className="flex-shrink-0">
              <EmployeeAvatar
                avatarUrl={employee.avatar_url}
                firstName={employee.first_name}
                lastName={employee.last_name}
                size="lg"
                className="w-18 h-18 text-lg"
                onClick={() => window.location.href = `/hr/employees/${employeeId}`}
              />
              {(isHR && !isSelfView) && (
                <button 
                  className="text-xs text-primary hover:underline mt-1 block"
                  onClick={() => window.location.href = `/hr/employees/${employeeId}`}
                >
                  Change photo
                </button>
              )}
            </div>

            {/* Middle: Name, Code, Department & Snapshot Chips */}
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {employee.first_name} {employee.last_name}
                </h2>
                <p className="text-muted-foreground">
                  {employee.emp_code} • {employee.department} • {employee.designation}
                </p>
              </div>

              {snapshot && (
                <div className="flex flex-wrap gap-2">
                  <button 
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 transition-colors"
                    onClick={() => {/* Navigate to leaves tab */}}
                  >
                    <Calendar className="w-3 h-3" />
                    Leaves (12 mo): {snapshot.leaves.approvedCount}
                  </button>

                  <button 
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm hover:bg-green-100 transition-colors"
                    onClick={() => {/* Navigate to salary tab */}}
                  >
                    <DollarSign className="w-3 h-3" />
                    Current CTC: ₹{snapshot.salary.monthly_ctc?.toLocaleString('en-IN')}
                  </button>

                  <button 
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 transition-colors"
                    onClick={() => {/* Navigate to hike history tab */}}
                  >
                    <CalendarIcon className="w-3 h-3" />
                    Next Hike: {snapshot.salary.next_hike_date 
                      ? new Date(snapshot.salary.next_hike_date).toLocaleDateString('en-GB') 
                      : '—'}
                  </button>
                </div>
              )}
            </div>

            {/* Right: Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleEmail}
                disabled={!employee.email}
                title={employee.email ? "Send email" : "No email address"}
              >
                <Mail className="w-4 h-4" />
              </Button>

              {((isHR && !isSelfView) || (!isHR && isSelfView)) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleWhatsApp}
                    disabled={!isPhoneAvailable}
                    title={isPhoneAvailable ? "Open WhatsApp chat" : "No valid phone number"}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCall}
                    disabled={!isPhoneAvailable}
                    title={isPhoneAvailable ? "Make phone call" : "No valid phone number"}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                </>
              )}

              {(isHR && !isSelfView) && (
                <Popover open={quickMessageOpen} onOpenChange={setQuickMessageOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Quick message…
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Quick Message</h4>
                      
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Channel</Label>
                          <Select value={messageForm.channel} onValueChange={(value: 'WhatsApp' | 'Email') => 
                            setMessageForm(prev => ({ ...prev, channel: value }))}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Email">Email</SelectItem>
                              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Tone</Label>
                            <Select value={messageForm.tone} onValueChange={(value: 'HR' | 'Friendly' | 'Formal') => 
                              setMessageForm(prev => ({ ...prev, tone: value }))}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="HR">HR</SelectItem>
                                <SelectItem value="Friendly">Friendly</SelectItem>
                                <SelectItem value="Formal">Formal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Intent</Label>
                            <Select value={messageForm.intent} onValueChange={(value: 'Reminder' | 'Congrats' | 'Warning' | 'Custom') => 
                              setMessageForm(prev => ({ ...prev, intent: value }))}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Reminder">Reminder</SelectItem>
                                <SelectItem value="Congrats">Congrats</SelectItem>
                                <SelectItem value="Warning">Warning</SelectItem>
                                <SelectItem value="Custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {messageForm.intent === 'Custom' && (
                          <div>
                            <Label className="text-xs">Prompt</Label>
                            <Textarea
                              value={messageForm.custom_prompt}
                              onChange={(e) => setMessageForm(prev => ({ ...prev, custom_prompt: e.target.value }))}
                              placeholder="Enter your prompt..."
                              rows={3}
                              className="text-sm"
                            />
                          </div>
                        )}

                        <Button 
                          onClick={handleGenerateMessage} 
                          size="sm" 
                          className="w-full"
                          disabled={isGenerating}
                        >
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>

                        {composedMessage && (
                          <div className="space-y-2 p-3 bg-muted rounded text-sm">
                            <div className="max-h-24 overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-xs">{composedMessage}</pre>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={handleCopyMessage} className="h-7 px-2 text-xs">
                                Copy
                              </Button>
                              {messageForm.channel === 'Email' && (
                                <Button size="sm" variant="outline" onClick={handleOpenInEmail} className="h-7 px-2 text-xs">
                                  Open in Email
                                </Button>
                              )}
                              {messageForm.channel === 'WhatsApp' && (
                                <Button size="sm" variant="outline" onClick={handleOpenInWhatsApp} className="h-7 px-2 text-xs">
                                  Open in WhatsApp
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default EmployeeSnapshotHeader;
