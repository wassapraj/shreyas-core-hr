
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  Phone
} from 'lucide-react';

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

  const handleHandoverRequest = async (assetId: string) => {
    try {
      const { error } = await supabase.functions.invoke('handover-request', {
        body: {
          asset_id: assetId,
          comments: 'Handover request from employee profile'
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Handover request submitted successfully'
      });
      
      loadAssetData(); // Refresh asset data
    } catch (error) {
      console.error('Error creating handover request:', error);
      toast({
        title: 'Error',
        description: 'Failed to create handover request',
        variant: 'destructive'
      });
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
      <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="leaves">Leaves</TabsTrigger>
        <TabsTrigger value="assets">Assets</TabsTrigger>
        <TabsTrigger value="insurance">Insurance</TabsTrigger>
        <TabsTrigger value="payslips">Payslips</TabsTrigger>
        <TabsTrigger value="salary">Salary & Bank</TabsTrigger>
        <TabsTrigger value="hikes">Hike History</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Employee Details
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
                <Input value={employee.first_name || ''} readOnly />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={employee.last_name || ''} readOnly />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={employee.email || ''} readOnly />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={employee.phone || ''} readOnly />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={employee.department || ''} readOnly />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value={employee.designation || ''} readOnly />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={employee.location || ''} readOnly />
              </div>
              <div>
                <Label>Date of Joining</Label>
                <Input value={employee.doj ? new Date(employee.doj).toLocaleDateString() : ''} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave History (Last 12 Months)
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

      <TabsContent value="assets" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Currently Assigned Assets
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
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleHandoverRequest(assignment.asset_id)}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

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
                  <div key={policy.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{policy.insurer_name}</div>
                      <Badge variant="outline">{policy.product_name}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Policy: {policy.policy_number}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(policy.start_date).toLocaleDateString()} - {new Date(policy.end_date).toLocaleDateString()}
                    </div>
                    {policy.card_image_url && (
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download Card
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payslips" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payslips
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payslips.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payslips found</p>
            ) : (
              <div className="space-y-4">
                {payslips.map((payslip) => (
                  <div key={payslip.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Gross: ₹{payslip.gross?.toLocaleString()} • Net: ₹{payslip.net?.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {payslip.pdf_url && (
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download
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

      <TabsContent value="salary" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Salary & Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Monthly CTC</Label>
                <Input value={`₹${employee.monthly_ctc?.toLocaleString() || 0}`} readOnly={!isSuperAdmin} />
              </div>
              <div>
                <Label>PF Applicable</Label>
                <Input value={employee.pf_applicable ? 'Yes' : 'No'} readOnly />
              </div>
              <div>
                <Label>Bank Account Name</Label>
                <Input value={employee.bank_account_name || ''} readOnly={!isSuperAdmin} />
              </div>
              <div>
                <Label>Bank Account Number</Label>
                <Input value={employee.bank_account_number || ''} readOnly={!isSuperAdmin} />
              </div>
              <div>
                <Label>Bank IFSC</Label>
                <Input value={employee.bank_ifsc || ''} readOnly={!isSuperAdmin} />
              </div>
              <div>
                <Label>Bank Branch</Label>
                <Input value={employee.bank_branch || ''} readOnly={!isSuperAdmin} />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

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
    </Tabs>
  );
};

export default EmployeeProfileTabs;
