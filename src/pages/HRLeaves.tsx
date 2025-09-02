import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Eye, Loader2, Filter, Plus } from "lucide-react";
import LeaveBox from "@/components/LeaveBox";

interface LeaveRequestWithEmployee {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  raw_text: string;
  status: string;
  priority_score: number;
  created_on: string;
  employees: {
    first_name: string;
    last_name: string;
    emp_code: string;
    department: string;
  };
}

export default function HRLeaves() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithEmployee | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: "all",
    department: "all",
    start_date: "",
    end_date: ""
  });

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const loadLeaveRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employees!inner (
            first_name,
            last_name,
            emp_code,
            department
          )
        `)
        .order('priority_score', { ascending: false })
        .order('created_on', { ascending: true });

      // Apply filters
      if (filters.status !== "all") {
        query = query.eq('status', filters.status as 'Pending' | 'Approved' | 'Rejected');
      }
      if (filters.department !== "all") {
        query = query.eq('employees.department', filters.department);
      }
      if (filters.start_date) {
        query = query.gte('start_date', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('end_date', filters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      toast({
        title: "Error",
        description: "Failed to load leave requests",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId: string, status: 'Approved' | 'Rejected') => {
    setProcessing(requestId);
    try {
      const { data, error } = await supabase.functions.invoke('leave-set-status', {
        body: { 
          id: requestId, 
          status: status,
          approver_user_id: user?.id 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Leave request ${status.toLowerCase()}`
        });
        
        // Reload requests
        loadLeaveRequests();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: `Failed to ${status.toLowerCase()} leave request`,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      Pending: "default",
      Approved: "default", 
      Rejected: "destructive"
    } as const;
    return <Badge variant={variants[status as keyof typeof variants] || "secondary"}>{status}</Badge>;
  };

  const getPriorityBadge = (score: number) => {
    if (score > 0.7) return <Badge variant="destructive">High</Badge>;
    if (score > 0.4) return <Badge variant="default">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const generateNotificationMessage = (request: LeaveRequestWithEmployee) => {
    const employeeName = `${request.employees.first_name} ${request.employees.last_name}`;
    const dates = request.start_date === request.end_date 
      ? new Date(request.start_date).toLocaleDateString()
      : `${new Date(request.start_date).toLocaleDateString()} to ${new Date(request.end_date).toLocaleDateString()}`;
    
    if (request.status === 'Approved') {
      return `Hi ${employeeName}, your ${request.type} leave request for ${dates} has been approved. Please coordinate with your team for handover.`;
    } else if (request.status === 'Rejected') {
      return `Hi ${employeeName}, your ${request.type} leave request for ${dates} has been declined. Please contact HR for more details.`;
    }
    return `Hi ${employeeName}, your leave request is being reviewed.`;
  };

  // Get unique departments for filter
  const departments = Array.from(new Set(leaveRequests.map(r => r.employees.department))).filter(Boolean);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Leave Inbox</h1>
        <div className="flex gap-2">
          <LeaveBox onLeaveAdded={loadLeaveRequests} />
          <Button onClick={loadLeaveRequests} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Filter className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter leave requests by status, department, and dates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Start Date From</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Start Date To</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="mt-4">
            <Button onClick={loadLeaveRequests}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>Manage pending and processed leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leave requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {request.employees.first_name} {request.employees.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.employees.emp_code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{request.employees.department || '-'}</TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(request.start_date).toLocaleDateString()}
                        {request.start_date !== request.end_date && (
                          <div>to {new Date(request.end_date).toLocaleDateString()}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{request.days}</TableCell>
                    <TableCell>{getPriorityBadge(request.priority_score)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {new Date(request.created_on).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Sheet open={isSheetOpen && selectedRequest?.id === request.id} onOpenChange={(open) => {
                          setIsSheetOpen(open);
                          if (open) setSelectedRequest(request);
                        }}>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                        </Sheet>
                        
                        {request.status === 'Pending' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleStatusChange(request.id, 'Approved')}
                              disabled={processing === request.id}
                            >
                              {processing === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStatusChange(request.id, 'Rejected')}
                              disabled={processing === request.id}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[600px] sm:w-[540px]">
          {selectedRequest && (
            <>
              <SheetHeader>
                <SheetTitle>
                  Leave Request Details
                </SheetTitle>
                <SheetDescription>
                  {selectedRequest.employees.first_name} {selectedRequest.employees.last_name} ({selectedRequest.employees.emp_code})
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Type</Label>
                    <div className="mt-1">{selectedRequest.type}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Start Date</Label>
                    <div className="mt-1">{new Date(selectedRequest.start_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">End Date</Label>
                    <div className="mt-1">{new Date(selectedRequest.end_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Days</Label>
                    <div className="mt-1">{selectedRequest.days}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Priority</Label>
                    <div className="mt-1">{getPriorityBadge(selectedRequest.priority_score)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Reason</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {selectedRequest.reason}
                  </div>
                </div>

                {selectedRequest.raw_text && (
                  <div>
                    <Label className="text-sm font-medium">Original Request</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                      {selectedRequest.raw_text}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Suggested Notification</Label>
                  <Textarea
                    value={generateNotificationMessage(selectedRequest)}
                    readOnly
                    className="mt-1 bg-muted"
                    rows={3}
                  />
                </div>

                {selectedRequest.status === 'Pending' && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => handleStatusChange(selectedRequest.id, 'Approved')}
                      disabled={processing === selectedRequest.id}
                      className="flex-1"
                    >
                      {processing === selectedRequest.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleStatusChange(selectedRequest.id, 'Rejected')}
                      disabled={processing === selectedRequest.id}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}