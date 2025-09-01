import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Flag, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
}

interface EmployeeTerminateDialogProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const terminationReasons = [
  'Misconduct',
  'Performance', 
  'Absenteeism',
  'Redundancy',
  'Mutual',
  'Other'
];

export const EmployeeTerminateDialog = ({ employee, isOpen, onClose, onSuccess }: EmployeeTerminateDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    terminationDate: new Date().toISOString().split('T')[0],
    reason: '',
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClose = () => {
    setFormData({
      terminationDate: new Date().toISOString().split('T')[0],
      reason: '',
      notes: ''
    });
    setSelectedFile(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please select a PDF, DOCX, JPG, or PNG file.'
        });
        return;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'File size must be less than 10MB.'
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!employee || !formData.reason) {
      toast({
        variant: 'destructive',
        title: 'Required Fields',
        description: 'Please fill in all required fields.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let terminationLetterKey = null;

      // Upload termination letter if provided
      if (selectedFile) {
        setIsUploading(true);
        
        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(selectedFile);
        const base64Data = await base64Promise;

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-employee-document', {
          body: {
            employeeId: employee.id,
            documentKind: 'termination_letter',
            fileName: selectedFile.name,
            fileData: base64Data,
            contentType: selectedFile.type
          }
        });

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        terminationLetterKey = uploadData?.s3Key;
        setIsUploading(false);
      }

      // Terminate employee
      const { data, error } = await supabase.functions.invoke('employee-terminate', {
        body: {
          employeeId: employee.id,
          terminationDate: formData.terminationDate,
          reason: formData.reason,
          notes: formData.notes,
          terminationLetterKey
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Employee Terminated',
        description: `${employee.emp_code} ${employee.first_name} ${employee.last_name} has been terminated.`
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error terminating employee:', error);
      toast({
        variant: 'destructive',
        title: 'Termination Failed',
        description: error instanceof Error ? error.message : 'Failed to terminate employee'
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-orange-500" />
            Terminate {employee.emp_code} – {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="terminationDate">Termination Date *</Label>
            <Input
              id="terminationDate"
              type="date"
              value={formData.terminationDate}
              onChange={(e) => setFormData(prev => ({ ...prev, terminationDate: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Select value={formData.reason} onValueChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select termination reason" />
              </SelectTrigger>
              <SelectContent>
                {terminationReasons.map(reason => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about the termination..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="terminationLetter">Termination Letter (Optional)</Label>
            <div className="mt-2">
              <input
                id="terminationLetter"
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('terminationLetter')?.click()}
                className="w-full"
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {selectedFile ? selectedFile.name : 'Upload Termination Letter'}
              </Button>
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.reason || isSubmitting || isUploading}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Terminating...'}
                </>
              ) : (
                'Terminate Employee'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};