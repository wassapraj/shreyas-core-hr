import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, Trash2, Shield, AlertCircle, Calendar } from 'lucide-react';

interface InsurancePoliciesProps {
  employee: any;
  isHR: boolean;
}

interface InsurancePolicy {
  id: string;
  insurer_name: string;
  product_name: string;
  policy_number: string;
  start_date: string;
  end_date: string;
  s3_key: string;
  insurer_logo_url?: string;
  notes?: string;
  created_at: string;
}

export const InsurancePolicies = ({ employee, isHR }: InsurancePoliciesProps) => {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    insurer_name: '',
    product_name: '',
    policy_number: '',
    start_date: '',
    end_date: '',
    insurer_logo_url: '',
    notes: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchPolicies();
  }, [employee.id]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error('Error fetching insurance policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load insurance policies',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.insurer_name || !uploadForm.product_name || !uploadForm.policy_number) {
      toast({
        title: 'Error',
        description: 'Please fill in required fields and select a file',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      // Get signed URL for upload
      const { data: urlData, error: urlError } = await supabase.functions.invoke('get-upload-url', {
        body: {
          employeeId: employee.id,
          category: 'insurance',
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

      // Insert insurance policy record
      const { error: insertError } = await supabase
        .from('insurance_policies')
        .insert({
          employee_id: employee.id,
          insurer_name: uploadForm.insurer_name,
          product_name: uploadForm.product_name,
          policy_number: uploadForm.policy_number,
          start_date: uploadForm.start_date || null,
          end_date: uploadForm.end_date || null,
          s3_key: urlData.key,
          file_path: urlData.key,
          content_type: uploadForm.file.type,
          size: uploadForm.file.size,
          insurer_logo_url: uploadForm.insurer_logo_url || null,
          notes: uploadForm.notes || null
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Insurance policy uploaded successfully'
      });

      setUploaderOpen(false);
      setUploadForm({
        insurer_name: '',
        product_name: '',
        policy_number: '',
        start_date: '',
        end_date: '',
        insurer_logo_url: '',
        notes: '',
        file: null
      });
      fetchPolicies();
    } catch (error) {
      console.error('Error uploading insurance policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload insurance policy',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (policy: InsurancePolicy) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-download-url', {
        body: { key: policy.s3_key }
      });

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to download policy document',
        variant: 'destructive'
      });
    }
  };

  const isExpiringSoon = (endDate: string) => {
    const expiry = new Date(endDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

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
        <h3 className="text-lg font-semibold">Insurance Policies</h3>
        {isHR && (
          <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Add Policy Card
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Insurance Policy</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Insurer Name *</Label>
                  <Input
                    value={uploadForm.insurer_name}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, insurer_name: e.target.value }))}
                    placeholder="e.g., HDFC ERGO, ICICI Lombard"
                  />
                </div>

                <div>
                  <Label>Product Name *</Label>
                  <Input
                    value={uploadForm.product_name}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, product_name: e.target.value }))}
                    placeholder="e.g., Health Insurance, Life Insurance"
                  />
                </div>

                <div>
                  <Label>Policy Number *</Label>
                  <Input
                    value={uploadForm.policy_number}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, policy_number: e.target.value }))}
                    placeholder="Policy number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={uploadForm.start_date}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={uploadForm.end_date}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Insurer Logo URL (Optional)</Label>
                  <Input
                    value={uploadForm.insurer_logo_url}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, insurer_logo_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Policy Document *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  />
                </div>

                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Add Policy'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {policies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map(policy => {
            const expired = isExpired(policy.end_date);
            const expiringSoon = !expired && isExpiringSoon(policy.end_date);

            return (
              <Card key={policy.id} className={`${expired ? 'border-destructive' : expiringSoon ? 'border-warning' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {policy.insurer_logo_url ? (
                        <img 
                          src={policy.insurer_logo_url} 
                          alt={policy.insurer_name}
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Shield className="w-8 h-8 text-primary" />
                      )}
                      <div>
                        <CardTitle className="text-sm">{policy.product_name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{policy.insurer_name}</p>
                      </div>
                    </div>
                    {expired && <Badge variant="destructive">Expired</Badge>}
                    {expiringSoon && <Badge variant="destructive">Expiring Soon</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Policy Number</Label>
                    <p className="text-sm font-mono">{policy.policy_number}</p>
                  </div>

                  {(policy.start_date || policy.end_date) && (
                    <div>
                      <Label className="text-xs">Validity</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {policy.start_date && new Date(policy.start_date).toLocaleDateString()}
                        {policy.start_date && policy.end_date && ' → '}
                        {policy.end_date && new Date(policy.end_date).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {policy.notes && (
                    <div>
                      <Label className="text-xs">Notes</Label>
                      <p className="text-sm text-muted-foreground">{policy.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(policy)}
                      className="flex-1"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      View Card
                    </Button>
                    {isHR && (
                      <Button size="sm" variant="destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No insurance policies on file</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InsurancePolicies;