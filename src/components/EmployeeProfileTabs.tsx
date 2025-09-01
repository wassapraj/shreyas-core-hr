import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FileText, 
  Calendar, 
  Package, 
  Shield, 
  Receipt, 
  CreditCard, 
  TrendingUp, 
  Upload,
  Download,
  MessageSquare,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit,
  Send,
  Copy,
  ExternalLink
} from 'lucide-react';
import { EmployeeTerminateDialog } from '@/components/EmployeeTerminateDialog';
import { EmployeeDeleteDialog } from '@/components/EmployeeDeleteDialog';
import { AvatarUpload } from './AvatarUpload';
import { DocumentUpload } from './DocumentUpload';
import { PayslipsList } from './PayslipsList';

interface EmployeeProfileTabsProps {
  employee: any;
  isHR: boolean;
  isSuperAdmin: boolean;
  onEmployeeUpdate: () => void;
}

const EmployeeProfileTabs: React.FC<EmployeeProfileTabsProps> = ({
  employee,
  isHR,
  isSuperAdmin,
  onEmployeeUpdate
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);

  // State for various tabs data
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveStats, setLeaveStats] = useState<any>({});
  const [assets, setAssets] = useState<any[]>([]);
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  const [insurance, setInsurance] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [hikes, setHikes] = useState<any[]>([]);

  // Form states
  const [editedEmployee, setEditedEmployee] = useState(employee);
  const [showPfPassword, setShowPfPassword] = useState(false);
  const [composerDialog, setComposerDialog] = useState(false);
  const [handoverDialog, setHandoverDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [insuranceDialog, setInsuranceDialog] = useState(false);
  const [selectedInsurance, setSelectedInsurance] = useState<any>(null);

  // Composer form state
  const [composerForm, setComposerForm] = useState({
    channel: 'Email' as 'Email' | 'WhatsApp',
    tone: 'HR' as 'HR' | 'Friendly' | 'Formal',
    intent: 'onboarding' as 'onboarding' | 'docs_missing' | 'policy' | 'custom',
    custom_prompt: ''
  });
  const [composedMessage, setComposedMessage] = useState<any>(null);

  // Load data for active tab
  useEffect(() => {
    if (activeTab === 'leaves') {
      loadLeaveData();
    } else if (activeTab === 'assets') {
      loadAssetData();
    } else if (activeTab === 'insurance') {
      loadInsuranceData();
    } else if (activeTab === 'payslips') {
      loadPayslipData();
    } else if (activeTab === 'hikes') {
      loadHikeData();
    }
  }, [activeTab, employee.id]);

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      
      // Get leave statistics
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      const { data: leaveData, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('created_at', twelveMonthsAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeaves(leaveData || []);
      
      // Calculate stats
      const stats = {
        totalRequests: leaveData?.length || 0,
        approvedCount: leaveData?.filter(l => l.status === 'Approved').length || 0,
        rejectedCount: leaveData?.filter(l => l.status === 'Rejected').length || 0,
        pendingCount: leaveData?.filter(l => l.status === 'Pending').length || 0,
        daysTakenByType: {
          SL: leaveData?.filter(l => l.type === 'SL' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0,
          CL: leaveData?.filter(l => l.type === 'CL' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0,
          EL: leaveData?.filter(l => l.type === 'EL' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0,
          LOP: leaveData?.filter(l => l.type === 'LOP' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0
        }
      };
      setLeaveStats(stats);

    } catch (error) {
      console.error('Error loading leave data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leave data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssetData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          assets (*)
        `)
        .eq('employee_id', employee.id)
        .order('assigned_on', { ascending: false });

      if (error) throw error;

      const current = data?.filter(a => !a.returned_on) || [];
      const history = data?.filter(a => a.returned_on) || [];
      
      setAssets(current);
      setAssetHistory(history);

    } catch (error) {
      console.error('Error loading asset data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load asset data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInsuranceData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('employee_id', employee.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setInsurance(data || []);

    } catch (error) {
      console.error('Error loading insurance data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load insurance data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPayslipData = async () => {
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
      console.error('Error loading payslip data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payslip data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHikeData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('hikes')
        .select('*')
        .eq('employee_id', employee.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setHikes(data || []);

    } catch (error) {
      console.error('Error loading hike data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load hike data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmployee = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('employees')
        .update(editedEmployee)
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Employee details updated successfully'
      });
      
      onEmployeeUpdate();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employee details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComposeMessage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('compose-employee-message', {
        body: {
          employee_id: employee.id,
          channel: composerForm.channel,
          tone: composerForm.tone,
          intent: composerForm.intent,
          custom_prompt: composerForm.custom_prompt
        }
      });

      if (error) throw error;
      setComposedMessage(data);
    } catch (error) {
      console.error('Error composing message:', error);
      toast({
        title: 'Error',
        description: 'Failed to compose message',
        variant: 'destructive'
      });
    }
  };

  const handleHandoverRequest = async (assetId: string, comments: string, toEmployeeId?: string) => {
    try {
      const { error } = await supabase.functions.invoke('handover-request', {
        body: {
          asset_id: assetId,
          comments,
          to_employee_id: toEmployeeId
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Handover request submitted successfully'
      });
      
      loadAssetData();
      setHandoverDialog(false);
    } catch (error) {
      console.error('Error creating handover request:', error);
      toast({
        title: 'Error',
        description: 'Failed to create handover request',
        variant: 'destructive'
      });
    }
  };

  const saveInsurancePolicy = async (policy: any) => {
    try {
      if (policy.id) {
        const { error } = await supabase
          .from('insurance_policies')
          .update(policy)
          .eq('id', policy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('insurance_policies')
          .insert({ ...policy, employee_id: employee.id });
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Insurance policy saved successfully'
      });
      
      loadInsuranceData();
      setInsuranceDialog(false);
    } catch (error) {
      console.error('Error saving insurance policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to save insurance policy',
        variant: 'destructive'
      });
    }
  };

  const deleteInsurancePolicy = async (policyId: string) => {
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
      
      loadInsuranceData();
    } catch (error) {
      console.error('Error deleting insurance policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete insurance policy',
        variant: 'destructive'
      });
    }
  };

  const togglePayslipVisibility = async (payslipId: string, visible: boolean) => {
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
      
      loadPayslipData();
    } catch (error) {
      console.error('Error updating payslip visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payslip visibility',
        variant: 'destructive'
      });
    }
  };

  const validatePAN = (pan: string) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
    return panRegex.test(pan);
  };

  const validateAadhaar = (aadhaar: string) => {
    return /^\d{12}$/.test(aadhaar.replace(/\s/g, ''));
  };

  const validateIFSC = (ifsc: string) => {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'Pending': 'secondary',
      'Approved': 'default',
      'Rejected': 'destructive',
      'Active': 'default',
      'Inactive': 'outline'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const openWhatsAppLink = (phone: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${phoneNumber.startsWith('91') ? phoneNumber : '91' + phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Content copied to clipboard'
    });
  };

  const saveToMessageLog = async () => {
    if (!composedMessage || !user) return;
    
    try {
      const { error } = await supabase
        .from('messages_log')
        .insert({
          employee_id: employee.id,
          channel: composerForm.channel,
          subject: composedMessage.subject,
          body: composedMessage.body,
          created_by: user.id
        });

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Message saved to log'
      });
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: 'Error',
        description: 'Failed to save message',
        variant: 'destructive'
      });
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:grid-cols-9">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="leaves">Leaves</TabsTrigger>
        <TabsTrigger value="assets">Assets</TabsTrigger>
        <TabsTrigger value="insurance">Insurance</TabsTrigger>
        <TabsTrigger value="payslips">Payslips</TabsTrigger>
        <TabsTrigger value="salary">Salary & Bank</TabsTrigger>
        <TabsTrigger value="hikes">Hike History</TabsTrigger>
        <TabsTrigger value="composer">
          <MessageSquare className="h-4 w-4 mr-1" />
          Composer
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-6">
        {/* Quick Prefill Section */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Prefill</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Extract from Resume (PDF/DOCX)</Label>
                <div className="flex gap-2">
                  <Input type="file" accept=".pdf,.docx" />
                  <Button onClick={() => toast({ title: 'Feature', description: 'Resume parsing will be implemented soon' })}>
                    Extract & Prefill
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bulk Import</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => window.open('/hr/employees/import')}>
                    Import from Excel/CSV
                  </Button>
                  <Button variant="outline" onClick={() => toast({ title: 'Feature', description: 'One-file import will be implemented soon' })}>
                    One-file Import
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avatar Upload Section */}
        {isHR && (
          <AvatarUpload 
            employee={employee} 
            onAvatarUpdated={onEmployeeUpdate}
          />
        )}

        {/* Identity Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Identity Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Employee Code</Label>
                <Input value={employee.emp_code || ''} readOnly />
              </div>
              <div>
                <Label>First Name</Label>
                <Input 
                  value={editedEmployee.first_name || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, first_name: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input 
                  value={editedEmployee.last_name || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, last_name: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Father's Name</Label>
                <Input 
                  value={editedEmployee.father_name || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, father_name: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Mother's Name</Label>
                <Input 
                  value={editedEmployee.mother_name || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, mother_name: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select 
                  value={editedEmployee.gender || ''} 
                  onValueChange={(value) => setEditedEmployee({...editedEmployee, gender: value})}
                  disabled={!isHR}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marital Status</Label>
                <Select 
                  value={editedEmployee.marital_status || ''} 
                  onValueChange={(value) => setEditedEmployee({...editedEmployee, marital_status: value})}
                  disabled={!isHR}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input 
                  type="date"
                  value={editedEmployee.dob || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, dob: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Blood Group</Label>
                <Select 
                  value={editedEmployee.blood_group || ''} 
                  onValueChange={(value) => setEditedEmployee({...editedEmployee, blood_group: value})}
                  disabled={!isHR}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Email</Label>
                <Input 
                  value={editedEmployee.email || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, email: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input 
                  value={editedEmployee.phone || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, phone: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Alternative Phone</Label>
                <Input 
                  value={editedEmployee.alt_phone || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, alt_phone: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>WhatsApp Number</Label>
                <Input 
                  value={editedEmployee.whatsapp_number || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, whatsapp_number: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Emergency Contact Name</Label>
                <Input 
                  value={editedEmployee.emergency_contact_name || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, emergency_contact_name: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Emergency Phone</Label>
                <Input 
                  value={editedEmployee.emergency_phone || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, emergency_phone: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Permanent Address</Label>
                <Textarea 
                  value={editedEmployee.permanent_address || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, permanent_address: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Current Address</Label>
                <Textarea 
                  value={editedEmployee.current_address || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, current_address: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Office Details */}
        <Card>
          <CardHeader>
            <CardTitle>Office Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Brand</Label>
                <Input 
                  value={editedEmployee.brand || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, brand: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Department</Label>
                <Input 
                  value={editedEmployee.department || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, department: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input 
                  value={editedEmployee.designation || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, designation: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input 
                  value={editedEmployee.location || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, location: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Date of Joining</Label>
                <Input 
                  type="date"
                  value={editedEmployee.doj || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, doj: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select 
                  value={editedEmployee.status || ''} 
                  onValueChange={(value) => setEditedEmployee({...editedEmployee, status: value})}
                  disabled={!isHR}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                    <SelectItem value="Resigned">Resigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Numbers */}
        <Card>
          <CardHeader>
            <CardTitle>Document Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PAN Number</Label>
                <Input 
                  value={editedEmployee.pan_number || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, pan_number: e.target.value.toUpperCase()})}
                  readOnly={!isHR}
                  className={editedEmployee.pan_number && !validatePAN(editedEmployee.pan_number) ? 'border-red-500' : ''}
                />
                {editedEmployee.pan_number && !validatePAN(editedEmployee.pan_number) && (
                  <p className="text-xs text-red-500 mt-1">Invalid PAN format (ABCDE1234F)</p>
                )}
              </div>
              <div>
                <Label>Aadhaar Number</Label>
                <Input 
                  value={editedEmployee.aadhaar_number || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, aadhaar_number: e.target.value.replace(/\D/g, '')})}
                  readOnly={!isHR}
                  className={editedEmployee.aadhaar_number && !validateAadhaar(editedEmployee.aadhaar_number) ? 'border-red-500' : ''}
                />
                {editedEmployee.aadhaar_number && !validateAadhaar(editedEmployee.aadhaar_number) && (
                  <p className="text-xs text-red-500 mt-1">Must be 12 digits</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {isHR && (
          <div className="flex justify-end">
            <Button onClick={handleSaveEmployee} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </TabsContent>

      {/* Documents Tab */}
      <TabsContent value="documents" className="space-y-6">
        <DocumentUpload 
          employee={employee} 
          isHR={isHR} 
          onDocumentUpdate={onEmployeeUpdate} 
        />
      </TabsContent>

      {/* Leaves Tab */}
      <TabsContent value="leaves" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{leaveStats.totalRequests || 0}</div>
              <p className="text-xs text-muted-foreground">Total Requests (12m)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{leaveStats.approvedCount || 0}</div>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{leaveStats.pendingCount || 0}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{leaveStats.rejectedCount || 0}</div>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(leaveStats.daysTakenByType || {}).map(([type, days]) => (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="text-lg font-bold">{days as number}</div>
                <Badge variant="outline">{type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave History (Last 12 Months)
              </div>
              {isHR && (
                <Button variant="outline" onClick={() => window.open('/hr/leaves')}>
                  Open Leave Inbox
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaves.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leave requests found</p>
            ) : (
              <div className="space-y-4">
                {leaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {leave.start_date && leave.end_date 
                          ? `${new Date(leave.start_date).toLocaleDateString()} - ${new Date(leave.end_date).toLocaleDateString()}`
                          : 'Dates pending'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {leave.type || 'Type pending'} • {leave.days || 0} days
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {leave.reason || 'No reason provided'}
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(leave.status)}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(leave.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Assets Tab */}
      <TabsContent value="assets" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Currently Assigned Assets
              </div>
              {isHR && (
                <Button variant="outline" onClick={() => window.open('/hr/assets/handover-inbox')}>
                  Handover Inbox
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No assets currently assigned</p>
            ) : (
              <div className="space-y-4">
                {assets.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <div className="font-medium">{assignment.assets?.asset_code}</div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.assets?.type} • {assignment.assets?.model}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Assigned: {new Date(assignment.assigned_on).toLocaleDateString()}
                      </div>
                      {assignment.notes && (
                        <div className="text-sm text-muted-foreground">
                          Notes: {assignment.notes}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAsset(assignment);
                        setHandoverDialog(true);
                      }}
                    >
                      Request Handover
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset History</CardTitle>
          </CardHeader>
          <CardContent>
            {assetHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No asset history</p>
            ) : (
              <div className="space-y-4">
                {assetHistory.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <div className="font-medium">{assignment.assets?.asset_code}</div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.assets?.type} • {assignment.assets?.model}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(assignment.assigned_on).toLocaleDateString()} - {new Date(assignment.returned_on).toLocaleDateString()}
                      </div>
                      {assignment.notes && (
                        <div className="text-sm text-muted-foreground">
                          Notes: {assignment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Insurance Tab */}
      <TabsContent value="insurance" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Insurance Policies
              </div>
              {isHR && (
                <Button onClick={() => {
                  setSelectedInsurance(null);
                  setInsuranceDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Policy
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insurance.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No insurance policies found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insurance.map((policy) => (
                  <div key={policy.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {policy.insurer_logo_url && (
                          <img src={policy.insurer_logo_url} alt="Insurer Logo" className="h-8 w-8 object-contain" />
                        )}
                        <div>
                          <div className="font-medium">{policy.insurer_name}</div>
                          <Badge variant="outline">{policy.product_name}</Badge>
                        </div>
                      </div>
                      {isHR && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedInsurance(policy);
                            setInsuranceDialog(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteInsurancePolicy(policy.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Policy: {policy.policy_number}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(policy.start_date).toLocaleDateString()} - {new Date(policy.end_date).toLocaleDateString()}
                    </div>
                    {policy.notes && (
                      <div className="text-sm text-muted-foreground">
                        {policy.notes}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {policy.card_image_url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(policy.card_image_url)}>
                          <Download className="h-4 w-4 mr-2" />
                          View Card
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Payslips Tab */}
      <TabsContent value="payslips" className="space-y-6">
        <PayslipsList 
          employee={employee} 
          isHR={isHR} 
        />
      </TabsContent>

      {/* Salary & Bank Tab */}
      <TabsContent value="salary" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Salary & Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium">Salary Information</h4>
                <div>
                  <Label>Monthly CTC</Label>
                  <Input 
                    value={`₹${editedEmployee.monthly_ctc?.toLocaleString() || 0}`} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setEditedEmployee({...editedEmployee, monthly_ctc: parseFloat(value) || 0});
                    }}
                    readOnly={!isSuperAdmin} 
                  />
                </div>
                <div>
                  <Label>PF Applicable</Label>
                  <Select 
                    value={editedEmployee.pf_applicable ? 'Yes' : 'No'} 
                    onValueChange={(value) => setEditedEmployee({...editedEmployee, pf_applicable: value === 'Yes'})}
                    disabled={!isSuperAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>PT State</Label>
                  <Select 
                    value={editedEmployee.pt_state || ''} 
                    onValueChange={(value) => setEditedEmployee({...editedEmployee, pt_state: value})}
                    disabled={!isSuperAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TS">Telangana</SelectItem>
                      <SelectItem value="AP">Andhra Pradesh</SelectItem>
                      <SelectItem value="KA">Karnataka</SelectItem>
                      <SelectItem value="TN">Tamil Nadu</SelectItem>
                      <SelectItem value="MH">Maharashtra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Bank Details</h4>
                <div>
                  <Label>Account Name</Label>
                  <Input 
                    value={editedEmployee.bank_account_name || ''} 
                    onChange={(e) => setEditedEmployee({...editedEmployee, bank_account_name: e.target.value})}
                    readOnly={!isSuperAdmin} 
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input 
                    value={editedEmployee.bank_account_number || ''} 
                    onChange={(e) => setEditedEmployee({...editedEmployee, bank_account_number: e.target.value})}
                    readOnly={!isSuperAdmin} 
                  />
                </div>
                <div>
                  <Label>IFSC Code</Label>
                  <Input 
                    value={editedEmployee.bank_ifsc || ''} 
                    onChange={(e) => setEditedEmployee({...editedEmployee, bank_ifsc: e.target.value.toUpperCase()})}
                    readOnly={!isSuperAdmin}
                    className={editedEmployee.bank_ifsc && !validateIFSC(editedEmployee.bank_ifsc) ? 'border-red-500' : ''}
                  />
                  {editedEmployee.bank_ifsc && !validateIFSC(editedEmployee.bank_ifsc) && (
                    <p className="text-xs text-red-500 mt-1">Invalid IFSC format</p>
                  )}
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input 
                    value={editedEmployee.bank_branch || ''} 
                    onChange={(e) => setEditedEmployee({...editedEmployee, bank_branch: e.target.value})}
                    readOnly={!isSuperAdmin} 
                  />
                </div>
                <div>
                  <Label>UPI ID</Label>
                  <Input 
                    value={editedEmployee.upi_id || ''} 
                    onChange={(e) => setEditedEmployee({...editedEmployee, upi_id: e.target.value})}
                    readOnly={!isSuperAdmin} 
                  />
                </div>
              </div>
            </div>

            {/* PF Portal Details */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-4">PF Portal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>PF Portal Username</Label>
                  <Input 
                    value={editedEmployee.pf_portal_user || ''} 
                    onChange={(e) => setEditedEmployee({...editedEmployee, pf_portal_user: e.target.value})}
                    readOnly={!isSuperAdmin} 
                  />
                </div>
                <div>
                  <Label>PF Portal Password</Label>
                  <div className="flex gap-2">
                    <Input 
                      type={showPfPassword ? 'text' : 'password'}
                      value={editedEmployee.pf_portal_pass || ''} 
                      onChange={(e) => setEditedEmployee({...editedEmployee, pf_portal_pass: e.target.value})}
                      readOnly={!isSuperAdmin} 
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPfPassword(!showPfPassword)}
                    >
                      {showPfPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <div className="flex justify-end">
            <Button onClick={handleSaveEmployee} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </TabsContent>

      {/* Hike History Tab */}
      <TabsContent value="hikes" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Hike History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hikes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hike history found</p>
            ) : (
              <div className="space-y-4">
                {hikes.map((hike) => (
                  <div key={hike.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <div className="font-medium">{new Date(hike.date).toLocaleDateString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {hike.pct}% increase • ₹{hike.amount?.toLocaleString()}
                      </div>
                      {hike.note && (
                        <div className="text-sm text-muted-foreground">{hike.note}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Composer Tab */}
      <TabsContent value="composer" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message Composer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Channel</Label>
                  <Select 
                    value={composerForm.channel} 
                    onValueChange={(value: 'Email' | 'WhatsApp') => 
                      setComposerForm(prev => ({ ...prev, channel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tone</Label>
                  <Select 
                    value={composerForm.tone} 
                    onValueChange={(value: 'HR' | 'Friendly' | 'Formal') => 
                      setComposerForm(prev => ({ ...prev, tone: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Friendly">Friendly</SelectItem>
                      <SelectItem value="Formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Intent</Label>
                <Select 
                  value={composerForm.intent} 
                  onValueChange={(value: 'onboarding' | 'docs_missing' | 'policy' | 'custom') => 
                    setComposerForm(prev => ({ ...prev, intent: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="docs_missing">Documents Missing</SelectItem>
                    <SelectItem value="policy">Policy Update</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {composerForm.intent === 'custom' && (
                <div>
                  <Label>Custom Message</Label>
                  <Textarea
                    value={composerForm.custom_prompt}
                    onChange={(e) => setComposerForm(prev => ({ ...prev, custom_prompt: e.target.value }))}
                    placeholder="Enter your custom message..."
                    rows={3}
                  />
                </div>
              )}

              <Button onClick={handleComposeMessage} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Generate Message
              </Button>

              {composedMessage && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="font-semibold">Subject:</Label>
                    <p className="text-sm">{composedMessage.subject}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Message:</Label>
                    <pre className="text-sm whitespace-pre-wrap bg-background p-3 rounded border">
                      {composedMessage.body}
                    </pre>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    {composerForm.channel === 'Email' && composedMessage.mailto && (
                      <Button size="sm" onClick={() => window.open(composedMessage.mailto)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Open in Email
                      </Button>
                    )}
                    {composerForm.channel === 'WhatsApp' && employee.phone && (
                      <Button size="sm" onClick={() => openWhatsAppLink(employee.phone, composedMessage.body)}>
                        <Phone className="h-4 w-4 mr-2" />
                        Open WhatsApp
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(composedMessage.body)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Message
                    </Button>
                    <Button size="sm" variant="outline" onClick={saveToMessageLog}>
                      Save to Log
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Handover Request Dialog */}
      <Dialog open={handoverDialog} onOpenChange={setHandoverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Asset Handover</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Asset</Label>
              <Input value={selectedAsset?.assets?.asset_code || ''} readOnly />
            </div>
            <div>
              <Label>Comments</Label>
              <Textarea placeholder="Reason for handover request..." />
            </div>
            <div>
              <Label>Transfer to Employee (Optional)</Label>
              <Input placeholder="Employee ID or leave empty for return to HR" />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={() => {
                handleHandoverRequest(selectedAsset?.asset_id, 'Handover request from profile');
              }}>
                Submit Request
              </Button>
              <Button variant="outline" onClick={() => setHandoverDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insurance Policy Dialog */}
      <Dialog open={insuranceDialog} onOpenChange={setInsuranceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedInsurance ? 'Edit' : 'Add'} Insurance Policy</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Insurer Name</Label>
              <Input placeholder="e.g., HDFC ERGO" />
            </div>
            <div>
              <Label>Product Name</Label>
              <Input placeholder="e.g., Health Insurance" />
            </div>
            <div>
              <Label>Policy Number</Label>
              <Input placeholder="Policy number" />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Insurer Logo URL</Label>
              <Input placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <Label>Card Image</Label>
              <Input type="file" accept="image/*" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button onClick={() => saveInsurancePolicy({})}>
              Save Policy
            </Button>
            <Button variant="outline" onClick={() => setInsuranceDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};

export default EmployeeProfileTabs;