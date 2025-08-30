import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Download, Plus, Trash2, Edit, Loader2 } from 'lucide-react';

interface InsurancePoliciesProps {
  employeeId: string;
}

const InsurancePolicies: React.FC<InsurancePoliciesProps> = ({ employeeId }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [uploadForm, setUploadForm] = useState({
    insurer_name: '',
    product_name: '',
    policy_number: '',
    start_date: '',
    end_date: '',
    notes: '',
    file: null as File | null
  });

  const isHR = userRoles.includes('hr') || userRoles.includes('super_admin');

  useEffect(() => {
    loadPolicies();
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

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error('Error loading policies:', error);
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
    if (!uploadForm.file || !uploadForm.insurer_name || !uploadForm.product_name || !uploadForm.policy_number) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('employee_id', employeeId);
      formData.append('insurer_name', uploadForm.insurer_name);
      formData.append('product_name', uploadForm.product_name);
      formData.append('policy_number', uploadForm.policy_number);
      formData.append('start_date', uploadForm.start_date);
      formData.append('end_date', uploadForm.end_date);
      formData.append('notes', uploadForm.notes);
      formData.append('filename', uploadForm.file.name);

      const { data, error } = await supabase.functions.invoke('insurance-upload', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Insurance policy uploaded successfully'
      });

      resetForm();
      loadPolicies();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload insurance policy',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setUploadForm({
      insurer_name: '',
      product_name: '',
      policy_number: '',
      start_date: '',
      end_date: '',
      notes: '',
      file: null
    });
    setShowUpload(false);
    setEditingPolicy(null);
  };

  const handleDownload = async (policy: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: {
          bucket: 'insurance',
          path: policy.file_path
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
        description: 'Failed to download policy document',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this insurance policy?')) return;

    try {
      const { error } = await supabase
        .from('insurance_policies')
        .delete()
        .eq('id', policyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Insurance policy deleted successfully'
      });

      loadPolicies();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete insurance policy',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (endDate: string) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Insurance Policies</h4>
        {isHR && (
          <Button onClick={() => setShowUpload(true)} size="sm">
            <Plus className="h-3 w-3 mr-1" />
            Add Policy
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          No insurance policies found
        </p>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <div key={policy.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-blue-600" />
                  <div>
                    <h5 className="font-medium">{policy.insurer_name}</h5>
                    <p className="text-sm text-muted-foreground">{policy.product_name}</p>
                    <p className="text-xs text-muted-foreground">Policy: {policy.policy_number}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {policy.file_path && (
                    <Button size="sm" variant="outline" onClick={() => handleDownload(policy)}>
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {isHR && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditingPolicy(policy)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(policy.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>Start: {formatDate(policy.start_date)}</span>
                <span className={isExpired(policy.end_date) ? 'text-red-600' : ''}>
                  End: {formatDate(policy.end_date)}
                  {isExpired(policy.end_date) && ' (Expired)'}
                </span>
              </div>
              {policy.notes && (
                <p className="text-sm text-muted-foreground mt-2">{policy.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Insurance Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Insurer Name</Label>
              <Input
                value={uploadForm.insurer_name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, insurer_name: e.target.value }))}
                placeholder="e.g., HDFC ERGO, Star Health"
              />
            </div>
            <div>
              <Label>Product Name</Label>
              <Input
                value={uploadForm.product_name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, product_name: e.target.value }))}
                placeholder="e.g., Health Insurance, Group Medical"
              />
            </div>
            <div>
              <Label>Policy Number</Label>
              <Input
                value={uploadForm.policy_number}
                onChange={(e) => setUploadForm(prev => ({ ...prev, policy_number: e.target.value }))}
                placeholder="Policy number"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
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
              <Label>Notes</Label>
              <Textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
            <div>
              <Label>Policy Card/Document</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleUpload} 
                disabled={!uploadForm.file || !uploadForm.insurer_name || !uploadForm.product_name || !uploadForm.policy_number || uploading}
                className="flex-1"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Add Policy
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsurancePolicies;