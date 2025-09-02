import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Mail, Send, Sparkles } from 'lucide-react';

interface MessageComposerProps {
  employee: any;
  onMessageSent?: () => void;
}

const messagePresets = [
  {
    key: 'attendance_reminder',
    label: 'Attendance Reminder',
    subject: 'Attendance Update Required',
    template: 'Hi {firstName}, we noticed you haven\'t marked your attendance today. Please update your status as soon as possible. Thank you!'
  },
  {
    key: 'document_request',
    label: 'Document Request',
    subject: 'Document Submission Required',
    template: 'Hi {firstName}, we need you to submit the following documents: [specify documents]. Please upload them through your employee portal at your earliest convenience.'
  },
  {
    key: 'leave_approved',
    label: 'Leave Approved',
    subject: 'Leave Request Approved',
    template: 'Hi {firstName}, your leave request from {startDate} to {endDate} has been approved. Please ensure proper handover of your responsibilities. Enjoy your time off!'
  },
  {
    key: 'meeting_reminder',
    label: 'Meeting Reminder',
    subject: 'Meeting Reminder',
    template: 'Hi {firstName}, this is a reminder about the meeting scheduled for {date} at {time}. Please ensure you\'re prepared and have reviewed the agenda.'
  },
  {
    key: 'policy_update',
    label: 'Policy Update',
    subject: 'Important Policy Update',
    template: 'Hi {firstName}, we have updated our company policies. Please review the changes in the employee handbook and acknowledge your understanding.'
  }
];

const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'urgent', label: 'Urgent' }
];

export const MessageComposer = ({ employee, onMessageSent }: MessageComposerProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('email');
  const [tone, setTone] = useState('professional');
  const [preset, setPreset] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePresetChange = (presetKey: string) => {
    setPreset(presetKey);
    const selectedPreset = messagePresets.find(p => p.key === presetKey);
    if (selectedPreset) {
      setSubject(selectedPreset.subject);
      setMessage(selectedPreset.template);
    }
  };

  const processMessage = (text: string): string => {
    let processed = text;
    
    // Replace standard placeholders
    processed = processed.replace(/{firstName}/g, employee.first_name || 'there');
    processed = processed.replace(/{lastName}/g, employee.last_name || '');
    processed = processed.replace(/{fullName}/g, `${employee.first_name || ''} ${employee.last_name || ''}`.trim());
    processed = processed.replace(/{empCode}/g, employee.emp_code || '');
    processed = processed.replace(/{designation}/g, employee.designation || '');
    processed = processed.replace(/{department}/g, employee.department || '');
    
    // Replace custom fields
    Object.entries(customFields).forEach(([key, value]) => {
      processed = processed.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return processed;
  };

  const openWhatsApp = () => {
    const processedMessage = processMessage(message);
    const phoneNumber = employee.phone || employee.whatsapp_number;
    
    if (!phoneNumber) {
      toast({
        variant: 'destructive',
        title: 'No Phone Number',
        description: 'Employee phone number not available'
      });
      return;
    }

    // Clean phone number and ensure it starts with country code
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(processedMessage)}`;
    window.open(whatsappUrl, '_blank');
    
    logMessage('whatsapp', processedMessage);
  };

  const openEmail = () => {
    const processedSubject = processMessage(subject);
    const processedMessage = processMessage(message);
    
    if (!employee.email) {
      toast({
        variant: 'destructive',
        title: 'No Email Address',
        description: 'Employee email address not available'
      });
      return;
    }

    const emailUrl = `mailto:${employee.email}?subject=${encodeURIComponent(processedSubject)}&body=${encodeURIComponent(processedMessage)}`;
    window.open(emailUrl, '_blank');
    
    logMessage('email', processedMessage);
  };

  const logMessage = async (channel: 'whatsapp' | 'email', content: string) => {
    try {
      // Log the message in the system for record keeping
      // This would typically call a logging API
      console.log(`Message sent via ${channel} to ${employee.first_name} ${employee.last_name}:`, content);
      
      toast({
        title: 'Message Opened',
        description: `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} client opened with message`
      });

      onMessageSent?.();
    } catch (error) {
      console.error('Error logging message:', error);
    }
  };

  const detectPlaceholders = (text: string): string[] => {
    const matches = text.match(/{([^}]+)}/g);
    if (!matches) return [];
    
    const standardPlaceholders = ['firstName', 'lastName', 'fullName', 'empCode', 'designation', 'department'];
    return matches
      .map(match => match.replace(/[{}]/g, ''))
      .filter(placeholder => !standardPlaceholders.includes(placeholder));
  };

  const customPlaceholders = detectPlaceholders(message);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="w-4 h-4 mr-2" />
          Compose Message
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Composer</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Send a message to {employee.first_name} {employee.last_name}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Channel & Tone Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(value: 'whatsapp' | 'email') => setChannel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      WhatsApp
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Message Presets */}
          <div>
            <Label>Message Template</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template or write custom message" />
              </SelectTrigger>
              <SelectContent>
                {messagePresets.map(preset => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject (Email only) */}
          {channel === 'email' && (
            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
          )}

          {/* Message Content */}
          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              className="resize-none"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              Available placeholders: {'{firstName}'}, {'{lastName}'}, {'{fullName}'}, {'{empCode}'}, {'{designation}'}, {'{department}'}
            </div>
          </div>

          {/* Custom Placeholders */}
          {customPlaceholders.length > 0 && (
            <div>
              <Label>Custom Fields</Label>
              <div className="space-y-2">
                {customPlaceholders.map(placeholder => (
                  <div key={placeholder} className="flex items-center gap-2">
                    <Badge variant="outline">{`{${placeholder}}`}</Badge>
                    <Input
                      placeholder={`Value for ${placeholder}`}
                      value={customFields[placeholder] || ''}
                      onChange={(e) => setCustomFields(prev => ({
                        ...prev,
                        [placeholder]: e.target.value
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div>
            <Label>Preview</Label>
            <Card>
              <CardContent className="p-4 bg-muted/50">
                {channel === 'email' && subject && (
                  <div className="mb-2">
                    <span className="font-medium">Subject: </span>
                    <span>{processMessage(subject)}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm">
                  {processMessage(message) || 'Message preview will appear here...'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={channel === 'whatsapp' ? openWhatsApp : openEmail}
              disabled={!message.trim()}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              Open {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>

          {/* Contact Info */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div>Email: {employee.email || 'Not provided'}</div>
              <div>Phone: {employee.phone || employee.whatsapp_number || 'Not provided'}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
