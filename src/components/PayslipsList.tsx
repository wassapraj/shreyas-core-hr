import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface PayslipsListProps {
  employee: any;
  isHR: boolean;
}

interface Payslip {
  id: string;
  month: number;
  year: number;
  gross: number;
  deductions: number;
  net: number;
  remarks: string;
  s3_key: string;
  visible_to_employee: boolean;
  created_at: string;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayslipsList = ({ employee, isHR }: PayslipsListProps) => {
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    gross: '',
    deductions: '',
    net: '',
    remarks: '',
    visible_to_employee: true,
    file: null as File | null
  });

  useEffect(() => {
    fetchPayslips();
  }, [employee.id]);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', employee.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setPayslips(data || []);
    } catch (error) {
      console.error('Error fetching payslips:', error);
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
    if (!uploadForm.file || !uploadForm.month || !uploadForm.year) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a PDF file and fill in all required fields.'
      });
      return;
    }

    // Validate file type - only PDF allowed
    if (uploadForm.file.type !== 'application/pdf') {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Only PDF files are allowed for payslips.'
      });
      return;
    }

    setUploading(true);
    try {
      // Get signed URL for upload
      const { data: urlData, error: urlError } = await supabase.functions.invoke('get-upload-url', {
        body: {
          employeeId: employee.id,
          category: 'payslips',
          fileName: uploadForm.file.name,
          contentType: uploadForm.file.type
        }
      });

      if (urlError) throw urlError;

      // Upload file to S3 using signed URL
      const uploadResponse = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        body: uploadForm.file,
        headers: {
          'Content-Type': uploadForm.file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to S3');
      }

      // Insert payslip record
      const { error: insertError } = await supabase
        .from('payslips')
        .insert({
          employee_id: employee.id,
          month: uploadForm.month,
          year: uploadForm.year,
          gross: parseFloat(uploadForm.gross) || 0,
          deductions: parseFloat(uploadForm.deductions) || 0,
          net: parseFloat(uploadForm.net) || 0,
          remarks: uploadForm.remarks || '',
          visible_to_employee: uploadForm.visible_to_employee,
          s3_key: urlData.key,
          file_path: urlData.key,
          content_type: uploadForm.file.type,
          size: uploadForm.file.size
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Payslip uploaded successfully'
      });

      setUploaderOpen(false);
      setUploadForm({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        gross: '',
        deductions: '',
        net: '',
        remarks: '',
        visible_to_employee: true,
        file: null
      });
      fetchPayslips();
    } catch (error) {
      console.error('Error uploading payslip:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload payslip',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (payslip: Payslip) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-download-url', {
        body: { key: payslip.s3_key }
      });

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading payslip:', error);
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

      fetchPayslips();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to update visibility',
        variant: 'destructive'
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Filter payslips for employee view
  const visiblePayslips = isHR ? payslips : payslips.filter(p => p.visible_to_employee);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-200 rounded h-32"></div>
        <div className="animate-pulse bg-gray-200 rounded h-64"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payslips</h3>
        {isHR && (
          <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload Payslip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Payslip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Month</Label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={uploadForm.month}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                    >
                      {monthNames.map((name, index) => (
                        <option key={index} value={index + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={uploadForm.year}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Gross</Label>
                    <Input
                      type="number"
                      value={uploadForm.gross}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, gross: e.target.value }))}
                      placeholder="₹0"
                    />
                  </div>
                  <div>
                    <Label>Deductions</Label>
                    <Input
                      type="number"
                      value={uploadForm.deductions}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, deductions: e.target.value }))}
                      placeholder="₹0"
                    />
                  </div>
                  <div>
                    <Label>Net</Label>
                    <Input
                      type="number"
                      value={uploadForm.net}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, net: e.target.value }))}
                      placeholder="₹0"
                    />
                  </div>
                </div>

                <div>
                  <Label>Remarks</Label>
                  <Textarea
                    value={uploadForm.remarks}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Optional remarks..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="visible"
                    checked={uploadForm.visible_to_employee}
                    onCheckedChange={(checked) => setUploadForm(prev => ({ ...prev, visible_to_employee: checked }))}
                  />
                  <Label htmlFor="visible">Visible to Employee</Label>
                </div>

                <div>
                  <Label>File (PDF Only)</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  />
                  {uploading && (
                    <div className="mt-2 space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full animate-pulse w-1/2"></div>
                      </div>
                      <p className="text-sm text-muted-foreground">Uploading payslip...</p>
                    </div>
                  )}
                </div>

                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload Payslip'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {visiblePayslips.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  {isHR && <TableHead>Visibility</TableHead>}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePayslips.map(payslip => (
                  <TableRow key={payslip.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {monthNames[payslip.month - 1]} {payslip.year}
                        </div>
                        {payslip.remarks && (
                          <div className="text-sm text-muted-foreground">{payslip.remarks}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(payslip.gross)}</TableCell>
                    <TableCell>{formatCurrency(payslip.deductions)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(payslip.net)}</TableCell>
                    {isHR && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleVisibility(payslip.id, !payslip.visible_to_employee)}
                        >
                          {payslip.visible_to_employee ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(payslip)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {isHR && (
                          <Button size="sm" variant="destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No payslips available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayslipsList;