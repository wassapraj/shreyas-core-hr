import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  User,
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
  ExternalLink,
  DollarSign,
  Monitor,
  Heart
} from 'lucide-react';
import { EmployeeTerminateDialog } from '@/components/EmployeeTerminateDialog';
import { EmployeeDeleteDialog } from '@/components/EmployeeDeleteDialog';
import { AvatarUpload } from './AvatarUpload';
import { DocumentUpload } from './DocumentUpload';
import { PayslipsList } from './PayslipsList';
import LeaveBox from './LeaveBox';
import AddAssetDialog from './AddAssetDialog';

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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Leave Management
                </CardTitle>
                <CardDescription>
                  Employee leave requests and history
                </CardDescription>
              </div>
              {(isHR || isSuperAdmin) && (
                <LeaveBox onLeaveAdded={loadLeaveData} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{leaveStats.totalRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Requests (12m)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{leaveStats.approvedCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{leaveStats.pendingCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{leaveStats.rejectedCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </CardContent>
              </Card>
            </div>

            {leaves.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leave requests found</p>
            ) : (
              <div className="space-y-4">
                {leaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <div className="font-medium">{leave.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-muted-foreground">{leave.days} days</div>
                      {leave.reason && <div className="text-sm">{leave.reason}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(leave.status)}
                      <div className="text-sm text-muted-foreground">
                        {new Date(leave.created_on).toLocaleDateString()}
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Currently Assigned Assets
                </CardTitle>
              </div>
              {isHR && (
                <div className="flex gap-2">
                  <AddAssetDialog 
                    employeeId={employee.id} 
                    onAssetAssigned={loadAssetData} 
                  />
                  <Button variant="outline" onClick={() => window.open('/hr/assets/handover-inbox')}>
                    View Handover Inbox
                  </Button>
                </div>
              )}
            </div>
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
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Insurance Policies
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
              <DollarSign className="h-5 w-5" />
              Salary Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Monthly CTC</Label>
                <Input 
                  value={`₹${employee.monthly_ctc?.toLocaleString() || '0'}`} 
                  readOnly 
                />
              </div>
              <div>
                <Label>Last Hike Date</Label>
                <Input 
                  value={employee.last_hike_on ? new Date(employee.last_hike_on).toLocaleDateString() : 'N/A'} 
                  readOnly 
                />
              </div>
              <div>
                <Label>Bank Account Name</Label>
                <Input 
                  value={editedEmployee.bank_account_name || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, bank_account_name: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>Bank Account Number</Label>
                <Input 
                  value={editedEmployee.bank_account_number || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, bank_account_number: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input 
                  value={editedEmployee.bank_ifsc || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, bank_ifsc: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
              <div>
                <Label>UPI ID</Label>
                <Input 
                  value={editedEmployee.upi_id || ''} 
                  onChange={(e) => setEditedEmployee({...editedEmployee, upi_id: e.target.value})}
                  readOnly={!isHR}
                />
              </div>
            </div>
          </CardContent>
        </Card>
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
            <p className="text-muted-foreground">Message composer functionality will be implemented here.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default EmployeeProfileTabs;