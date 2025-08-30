
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, CheckCircle, XCircle } from 'lucide-react';

const AssetHandoverInbox = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionForm, setActionForm] = useState({
    action: 'approve',
    to_employee_id: '',
    comments: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch handover requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('asset_handover_requests')
        .select(`
          *,
          assets (*),
          from_employee:employees!asset_handover_requests_from_employee_id_fkey (*),
          to_employee:employees!asset_handover_requests_to_employee_id_fkey (*)
        `)
        .eq('status', 'Requested')
        .order('requested_on', { ascending: true });

      if (requestsError) throw requestsError;

      // Fetch all employees for the dropdown
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, emp_code, first_name, last_name, department')
        .eq('status', 'Active')
        .order('first_name');

      if (employeesError) throw employeesError;

      setRequests(requestsData || []);
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load handover requests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    try {
      if (!selectedRequest) return;

      const { error } = await supabase.functions.invoke('handover-approve', {
        body: {
          request_id: selectedRequest.id,
          to_employee_id: actionForm.to_employee_id || null,
          comments: actionForm.comments,
          approve: actionForm.action === 'approve'
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Handover request ${actionForm.action === 'approve' ? 'approved' : 'rejected'} successfully`
      });

      setActionDialog(false);
      setSelectedRequest(null);
      setActionForm({ action: 'approve', to_employee_id: '', comments: '' });
      fetchData();
    } catch (error) {
      console.error('Error processing handover:', error);
      toast({
        title: 'Error',
        description: 'Failed to process handover request',
        variant: 'destructive'
      });
    }
  };

  const openActionDialog = (request: any, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionForm({ 
      action, 
      to_employee_id: request.to_employee_id || '', 
      comments: '' 
    });
    setActionDialog(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Asset Handover Inbox</h1>
        <Badge variant="secondary">
          {requests.length} Pending Request{requests.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pending Handover Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Requests</h3>
              <p className="text-muted-foreground">
                All handover requests have been processed.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>From Employee</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{request.assets?.asset_code}</div>
                        <div className="text-sm text-muted-foreground">
                          {request.assets?.type} • {request.assets?.model}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {request.from_employee?.first_name} {request.from_employee?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.from_employee?.emp_code} • {request.from_employee?.department}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(request.requested_on).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-xs truncate">
                        {request.comments || 'No comments'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => openActionDialog(request, 'approve')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openActionDialog(request, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionForm.action === 'approve' ? 'Approve' : 'Reject'} Handover Request
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium mb-2">Request Details</div>
                <div className="text-sm space-y-1">
                  <div>Asset: {selectedRequest.assets?.asset_code}</div>
                  <div>From: {selectedRequest.from_employee?.first_name} {selectedRequest.from_employee?.last_name}</div>
                  <div>Comments: {selectedRequest.comments || 'None'}</div>
                </div>
              </div>

              {actionForm.action === 'approve' && (
                <div>
                  <Label>Assign To Employee (Optional)</Label>
                  <Select 
                    value={actionForm.to_employee_id} 
                    onValueChange={(value) => setActionForm({...actionForm, to_employee_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee or leave empty to return to store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">Return to Store</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.emp_code}) - {emp.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Comments</Label>
                <Textarea
                  value={actionForm.comments}
                  onChange={(e) => setActionForm({...actionForm, comments: e.target.value})}
                  placeholder={actionForm.action === 'approve' ? 'Approval comments...' : 'Rejection reason...'}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAction} className="flex-1">
                  {actionForm.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                </Button>
                <Button variant="outline" onClick={() => setActionDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetHandoverInbox;
