import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
}

interface EmployeeDeleteDialogProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmployeeDeleteDialog = ({ employee, isOpen, onClose, onSuccess }: EmployeeDeleteDialogProps) => {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleDelete = async () => {
    if (!employee || confirmText !== 'DELETE') {
      toast({
        variant: 'destructive',
        title: 'Confirmation Required',
        description: 'Please type DELETE to confirm this action.'
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('employee-delete', {
        body: { employeeId: employee.id }
      });

      if (error) {
        throw error;
      }

      const deletedCounts = data?.deletedCounts || {};
      const countMessages = Object.entries(deletedCounts)
        .filter(([_, count]) => (count as number) > 0)
        .map(([table, count]) => `${table}: ${count}`)
        .join(', ');

      toast({
        title: 'Employee Deleted',
        description: `${employee.emp_code} deleted successfully. ${countMessages ? `Removed: ${countMessages}` : ''}`
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete employee'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete employee {employee.emp_code} – {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-destructive/10 p-4 rounded-lg">
            <p className="text-sm text-destructive font-medium mb-2">
              ⚠️ This action cannot be undone
            </p>
            <p className="text-sm text-muted-foreground">
              This will permanently remove this employee and all related records including:
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>• Documents and files</li>
              <li>• Payslips and salary records</li>
              <li>• Leave requests</li>
              <li>• Asset assignments</li>
              <li>• Insurance policies</li>
              <li>• Notes and reminders</li>
            </ul>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Type <code className="bg-muted px-1 py-0.5 rounded text-destructive">DELETE</code> to confirm:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className="border-destructive/50 focus:border-destructive"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || isDeleting}
              className="flex-1"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};