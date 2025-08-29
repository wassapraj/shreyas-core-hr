import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Mail, Save, User, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmailComposerModal } from '@/components/EmailComposerModal';

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  doj: string;
  location: string;
  status: 'Active' | 'Inactive';
  user_id: string;
  created_at: string;
  updated_at: string;
  dob?: string;
  manager_employee_id?: string;
  monthly_ctc?: number;
  pf_applicable?: boolean;
  pt_state?: 'TS' | 'AP';
  last_hike_on?: string;
  last_hike_pct?: number;
  last_hike_amount?: number;
  hike_cycle_months?: number;
}

interface LeaveRequest {
  id: string;
  created_on: string;
  type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string;
}

const departments = [
  'Digital', 'Film Events', 'Utsav Events', 'Corp Events', 
  'Finance', 'Housekeeping', 'Admin/IT', 'Creative', 'Managerial', 'Others'
];

export default function EmployeeProfileManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [smartFillText, setSmartFillText] = useState('');
  const [showSmartFill, setShowSmartFill] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEmployeeData();
    }
  }, [id]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // Fetch employee details
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (empError) {
        console.error('Error fetching employee:', empError);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch employee details'
        });
        return;
      }

      setEmployee(empData);

      // Fetch leave requests (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', id)
        .gte('created_on', twelveMonthsAgo.toISOString())
        .order('created_on', { ascending: false });

      if (leaveError) {
        console.error('Error fetching leave requests:', leaveError);
      } else {
        setLeaveRequests(leaveData || []);
      }

    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSmartFill = async () => {
    if (!smartFillText.trim()) return;

    try {
      const { data, error } = await supabase.functions.invoke('employee-smart-fill', {
        body: { text: smartFillText }
      });

      if (error) {
        console.error('Error in smart fill:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to parse text'
        });
        return;
      }

      // Update form fields with parsed data
      if (employee) {
        setEmployee({
          ...employee,
          ...data
        });
      }

      toast({
        title: 'Success',
        description: 'Fields auto-filled from text'
      });

      setShowSmartFill(false);
      setSmartFillText('');
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred'
      });
    }
  };

  const handleSave = async () => {
    if (!employee) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('employees')
        .update(employee)
        .eq('id', id);

      if (error) {
        console.error('Error saving employee:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save employee details'
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Employee details saved successfully'
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: keyof Employee, value: string) => {
    if (employee) {
      setEmployee({
        ...employee,
        [field]: value
      });
    }
  };

  const getLeaveStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="default">Approved</Badge>;
      case 'Rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'Pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Employee Not Found</h1>
          <Button onClick={() => navigate('/hr/employees')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Employees
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/hr/employees')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{employee.first_name} {employee.last_name}</h1>
            <p className="text-muted-foreground">{employee.emp_code} • {employee.designation} • {employee.department}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowEmailModal(true)} variant="outline">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Leaves
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-6">
            {/* Smart Fill Section */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Smart Fill from Text</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSmartFill(!showSmartFill)}
                  >
                    {showSmartFill ? 'Hide' : 'Show'} Smart Fill
                  </Button>
                </div>
              </CardHeader>
              {showSmartFill && (
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Paste resume text or employee information here..."
                    value={smartFillText}
                    onChange={(e) => setSmartFillText(e.target.value)}
                    rows={6}
                  />
                  <Button onClick={handleSmartFill} disabled={!smartFillText.trim()}>
                    Auto-Fill Fields
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Basic Information Section */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">First Name</label>
                    <Input
                      value={employee.first_name || ''}
                      onChange={(e) => handleFieldChange('first_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Last Name</label>
                    <Input
                      value={employee.last_name || ''}
                      onChange={(e) => handleFieldChange('last_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input
                      type="email"
                      value={employee.email || ''}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <Input
                      value={employee.phone || ''}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date of Birth</label>
                    <Input
                      type="date"
                      value={employee.dob || ''}
                      onChange={(e) => handleFieldChange('dob', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Location</label>
                    <Input
                      value={employee.location || ''}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Office Section */}
            <Card>
              <CardHeader>
                <CardTitle>Office Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Department</label>
                    <Select value={employee.department || ''} onValueChange={(value) => handleFieldChange('department', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Designation</label>
                    <Input
                      value={employee.designation || ''}
                      onChange={(e) => handleFieldChange('designation', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date of Joining</label>
                    <Input
                      type="date"
                      value={employee.doj || ''}
                      onChange={(e) => handleFieldChange('doj', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={employee.status || ''} onValueChange={(value) => handleFieldChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
            <Card>
            <CardHeader>
              <CardTitle>Document Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mt-4 p-4 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Document upload and management functionality will be implemented in the next phase when additional database fields are added for document storage.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Applied</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell>{new Date(leave.created_on).toLocaleDateString()}</TableCell>
                      <TableCell>{leave.type}</TableCell>
                      <TableCell>{new Date(leave.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(leave.end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{leave.days}</TableCell>
                      <TableCell>{getLeaveStatusBadge(leave.status)}</TableCell>
                      <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {leaveRequests.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No leave requests found in the last 12 months.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmailComposerModal
        employee={employee}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
    </div>
  );
}