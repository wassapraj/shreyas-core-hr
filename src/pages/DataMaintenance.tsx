import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DataMaintenance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleWipeData = async () => {
    if (confirmText !== 'DELETE') {
      toast({
        variant: 'destructive',
        title: 'Confirmation Required',
        description: 'Please type DELETE to confirm this action.'
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('wipe-employee-data', {
        body: { confirm: true }
      });

      if (error) {
        throw error;
      }

      const counts = data?.counts || {};
      const deletedTables = Object.entries(counts)
        .filter(([_, count]) => (count as number) > 0)
        .map(([table, count]) => `${table}: ${count}`)
        .join(', ');

      toast({
        title: 'Success',
        description: `All employee data removed. Deleted: ${deletedTables || 'No records found'}`
      });

      navigate('/hr/employees');
    } catch (error) {
      console.error('Error wiping data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to wipe employee data. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Data Maintenance</h1>
        <p className="text-muted-foreground mt-2">
          Administrative tools for data management. Use with extreme caution.
        </p>
      </div>

      <Card className="border-destructive">
        <CardHeader className="bg-destructive/10">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Wipe Employee Data (Danger Zone)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">This action will DELETE ALL:</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Employee records and personal data</li>
                <li>• Leave requests and history</li>
                <li>• Asset assignments</li>
                <li>• Insurance policies</li>
                <li>• Payslips and salary records</li>
                <li>• Hike history</li>
                <li>• Employee documents metadata</li>
                <li>• Sticky notes</li>
                <li>• Reminders</li>
              </ul>
              <p className="text-sm font-medium text-destructive mt-3">
                ⚠️ This action CANNOT be undone. Auth users and system roles will NOT be deleted.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Type <code className="bg-muted px-1 py-0.5 rounded">DELETE</code> to enable the button:
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE here"
                  className="max-w-xs"
                />
              </div>

              <Button
                variant="destructive"
                onClick={handleWipeData}
                disabled={confirmText !== 'DELETE' || isDeleting}
                className="w-full max-w-xs"
              >
                {isDeleting ? 'Deleting All Employee Data...' : 'Delete All Employee Data'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}