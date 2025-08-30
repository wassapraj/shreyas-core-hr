import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Upload, Eye, EyeOff, Plus, Loader2 } from 'lucide-react';

interface PayslipsListProps {
  employeeId: string;
}

const PayslipsList: React.FC<PayslipsListProps> = ({ employeeId }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [uploadForm, setUploadForm] = useState({
    month: '',
    year: '',
    gross: '',
    deductions: '',
    net: '',
    remarks: '',
    file: null as File | null
  });

  const isHR = userRoles.includes('hr') || userRoles.includes('super_admin');

  useEffect(() => {
    loadPayslips();
    fetchUserRoles();
  }, [employeeId]);

  const fetchUserRoles = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      setUserRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const loadPayslips = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', employeeId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setPayslips(data || []);
    } catch (error) {
      console.error('Error loading payslips:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payslips',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.month || !uploadForm.year) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('employee_id', employeeId);
      formData.append('month', uploadForm.month);
      formData.append('year', uploadForm.year);
      formData.append('gross', uploadForm.gross);
      formData.append('deductions', uploadForm.deductions);
      formData.append('net', uploadForm.net);
      formData.append('remarks', uploadForm.remarks);
      formData.append('filename', uploadForm.file.name);

      const { data, error } = await supabase.functions.invoke('payslip-upload', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payslip uploaded successfully'
      });

      setUploadForm({
        month: '',
        year: '',
        gross: '',
        deductions: '',
        net: '',
        remarks: '',
        file: null
      });
      setShowUpload(false);
      loadPayslips();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload payslip',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (payslip: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: {
          bucket: 'payslips',
          path: payslip.file_path
        }
      });

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download payslip',
        variant: 'destructive'
      });
    }
  };

  const toggleVisibility = async (payslipId: string, visible: boolean) => {
    try {
      const { error } = await supabase
        .from('payslips')
        .update({ visible_to_employee: visible })
        .eq('id', payslipId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Payslip ${visible ? 'shown to' : 'hidden from'} employee`
      });

      loadPayslips();
    } catch (error) {
      console.error('Error updating visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to update visibility',
        variant: 'destructive'
      });
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Payslips</h4>
        {isHR && (
          <Button onClick={() => setShowUpload(true)} size="sm">
            <Plus className="h-3 w-3 mr-1" />
            Upload Payslip
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : payslips.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          No payslips available
        </p>
      ) : (
        <div className="space-y-2">
          {payslips.map((payslip) => (
            <div key={payslip.id} className="flex items-center gap-3 p-3 border rounded">
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {monthNames[payslip.month - 1]} {payslip.year}
                </p>
                <div className="text-xs text-muted-foreground">
                  {payslip.gross > 0 && (
                    <span>Gross: {formatCurrency(payslip.gross)} | </span>
                  )}
                  {payslip.net > 0 && (
                    <span>Net: {formatCurrency(payslip.net)}</span>
                  )}
                </div>
                {payslip.remarks && (
                  <p className="text-xs text-muted-foreground mt-1">{payslip.remarks}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {payslip.file_path && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(payslip)}>
                    <Download className="h-3 w-3" />
                  </Button>
                )}
                {isHR && (
                  <div className="flex items-center gap-1">
                    {payslip.visible_to_employee ? (
                      <Eye className="h-3 w-3 text-green-600" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-red-600" />
                    )}
                    <Switch
                      checked={payslip.visible_to_employee}
                      onCheckedChange={(checked) => toggleVisibility(payslip.id, checked)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Payslip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Month</Label>
                <Select value={uploadForm.month} onValueChange={(value) => setUploadForm(prev => ({ ...prev, month: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={uploadForm.year}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, year: e.target.value }))}
                  placeholder="2024"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Gross</Label>
                <Input
                  type="number"
                  value={uploadForm.gross}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, gross: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Deductions</Label>
                <Input
                  type="number"
                  value={uploadForm.deductions}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, deductions: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Net</Label>
                <Input
                  type="number"
                  value={uploadForm.net}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, net: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={uploadForm.remarks}
                onChange={(e) => setUploadForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional remarks"
                rows={2}
              />
            </div>
            <div>
              <Label>PDF File</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleUpload} 
                disabled={!uploadForm.file || !uploadForm.month || !uploadForm.year || uploading}
                className="flex-1"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload
              </Button>
              <Button variant="outline" onClick={() => setShowUpload(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayslipsList;