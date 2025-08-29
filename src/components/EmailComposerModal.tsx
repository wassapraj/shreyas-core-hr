import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface EmailComposerModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

type MessageKind = 'onboarding' | 'docs_missing' | 'kyc_reminder' | 'custom';

export function EmailComposerModal({ employee, isOpen, onClose }: EmailComposerModalProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<MessageKind>('onboarding');
  const [customNote, setCustomNote] = useState('');
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const templateOptions = [
    { value: 'onboarding', label: 'Welcome Onboarding' },
    { value: 'docs_missing', label: 'Missing Documents' },
    { value: 'kyc_reminder', label: 'KYC Reminder' },
    { value: 'custom', label: 'Custom Message' }
  ];

  const generatePreview = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-compose-message', {
        body: {
          employee_id: employee.id,
          kind: selectedTemplate,
          custom_note: selectedTemplate === 'custom' ? customNote : undefined
        }
      });

      if (error) {
        console.error('Error generating preview:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to generate email preview'
        });
        return;
      }

      setEmailPreview(data);
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const openInEmail = () => {
    if (!emailPreview || !employee) return;

    const subject = encodeURIComponent(emailPreview.subject);
    const body = encodeURIComponent(emailPreview.body);
    const mailtoUrl = `mailto:${employee.email}?subject=${subject}&body=${body}`;
    
    window.open(mailtoUrl);
  };

  const copyToClipboard = () => {
    if (!emailPreview) return;

    const textToCopy = `Subject: ${emailPreview.subject}\n\n${emailPreview.body}`;
    navigator.clipboard.writeText(textToCopy);
    
    toast({
      title: 'Copied!',
      description: 'Email content copied to clipboard'
    });
  };

  const handleClose = () => {
    setSelectedTemplate('onboarding');
    setCustomNote('');
    setEmailPreview(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Compose Email - {employee?.first_name} {employee?.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Email Template</label>
            <Select value={selectedTemplate} onValueChange={(value: MessageKind) => setSelectedTemplate(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Note Input */}
          {selectedTemplate === 'custom' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Message</label>
              <Textarea
                placeholder="Enter your custom message here..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* Generate Preview Button */}
          <Button 
            onClick={generatePreview} 
            disabled={loading || (selectedTemplate === 'custom' && !customNote.trim())}
            className="w-full"
          >
            {loading ? 'Generating...' : 'Generate Preview'}
          </Button>

          {/* Email Preview */}
          {emailPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Email Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">To:</label>
                  <p className="text-sm">{employee?.email}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject:</label>
                  <p className="text-sm font-medium">{emailPreview.subject}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Body:</label>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm">{emailPreview.body}</pre>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={openInEmail} className="flex-1">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Email
                  </Button>
                  <Button onClick={copyToClipboard} variant="outline" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Content
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}