import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, User, Clock, CheckCircle, XCircle } from 'lucide-react';

interface AssetHandoverProps {
  employee: any;
  isHR: boolean;
  assets?: any[];
  onUpdate?: () => void;
}

interface HandoverRequest {
  id: string;
  asset_id: string;
  from_employee_id: string;
  to_employee_id: string;
  status: 'Requested' | 'Approved' | 'Rejected' | 'Completed';
  requested_on: string;
  approved_by?: string;
  comments?: string;
  created_at: string;
  updated_at: string;
  asset: {
    asset_code: string;
    type: string;
    model: string;
  } | null;
  from_employee: {
    first_name: string;
    last_name: string;
    emp_code: string;
  } | null;
  to_employee: {
    first_name: string;
    last_name: string;
    emp_code: string;
  } | null;
}

export const AssetHandover = ({ employee, isHR, assets = [], onUpdate }: AssetHandoverProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<HandoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [requestForm, setRequestForm] = useState({
    asset_id: '',
    to_employee_id: '',
    comments: ''
  });

  useEffect(() => {
    fetchHandoverRequests();
    if (isHR) {
      fetchEmployees();
    }
  }, [employee.id, isHR]);

  const fetchHandoverRequests = async () => {
    try {
      setLoading(true);
      
      // Build query filter based on user role
      const queryFilter = isHR 
        ? undefined // HR can see all requests
        : `from_employee_id.eq.${employee.id},to_employee_id.eq.${employee.id}`;

      let query = supabase
        .from('asset_handover_requests')
        .select(`
          *,
          asset:assets(asset_code, type, model),
          from_employee:employees!asset_handover_requests_from_employee_id_fkey(first_name, last_name, emp_code),
          to_employee:employees!asset_handover_requests_to_employee_id_fkey(first_name, last_name, emp_code)
        `)
        .order('requested_on', { ascending: false });

      if (queryFilter) {
        query = query.or(queryFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching handover requests:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load handover requests'
        });
        return;
      }

      // Filter out any malformed data and ensure proper typing
      const validRequests = (data || []).filter(request => 
        request.asset && request.from_employee && request.to_employee
      ) as HandoverRequest[];
      
      setRequests(validRequests);
    } catch (error) {
      console.error('Error fetching handover requests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load handover requests'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, emp_code, designation')
        .eq('status', 'Active')
        .neq('id', employee.id)
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleRequestHandover = async () => {
    if (!requestForm.asset_id || !requestForm.to_employee_id) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select an asset and recipient'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('asset_handover_requests')
        .insert({
          asset_id: requestForm.asset_id,
          from_employee_id: employee.id,
          to_employee_id: requestForm.to_employee_id,
          comments: requestForm.comments,
          status: 'Requested'
        });

      if (error) throw error;

      toast({
        title: 'Request Submitted',
        description: 'Asset handover request has been submitted for approval'
      });

      setRequestDialogOpen(false);
      setRequestForm({ asset_id: '', to_employee_id: '', comments: '' });
      fetchHandoverRequests();
    } catch (error) {
      console.error('Error submitting handover request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit handover request'
      });
    }
  };

  const handleApproveReject = async (requestId: string, action: 'Approved' | 'Rejected') => {
    try {
      const { error } = await supabase
        .from('asset_handover_requests')
        .update({
          status: action,
          approved_by: employee.id
        })
        .eq('id', requestId);

      if (error) throw error;

      if (action === 'Approved') {
        // Update asset assignment
        const request = requests.find(r => r.id === requestId);
        if (request) {
          // Close old assignment
          await supabase
            .from('asset_assignments')
            .update({ returned_on: new Date().toISOString().split('T')[0] })
            .eq('asset_id', request.asset_id)
            .eq('employee_id', request.from_employee_id)
            .is('returned_on', null);

          // Create new assignment
          await supabase
            .from('asset_assignments')
            .insert({
              asset_id: request.asset_id,
              employee_id: request.to_employee_id,
              assigned_on: new Date().toISOString().split('T')[0],
              condition: 'Good',
              notes: `Transferred from ${request.from_employee?.first_name} ${request.from_employee?.last_name}`
            });
        }
      }

      toast({
        title: action === 'Approved' ? 'Request Approved' : 'Request Rejected',
        description: `Asset handover request has been ${action.toLowerCase()}`
      });

      fetchHandoverRequests();
      onUpdate?.();
    } catch (error) {
      console.error(`Error ${action.toLowerCase()} handover request:`, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to ${action.toLowerCase()} handover request`
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-200 rounded h-32"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Asset Handover Requests</h3>
        {!isHR && assets.length > 0 && (
          <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Request Handover
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Asset Handover</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Asset</Label>
                  <Select value={requestForm.asset_id} onValueChange={(value) => setRequestForm(prev => ({ ...prev, asset_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose asset to handover" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.asset_code} - {asset.type} {asset.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Transfer To</Label>
                  <Select value={requestForm.to_employee_id} onValueChange={(value) => setRequestForm(prev => ({ ...prev, to_employee_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.emp_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Comments</Label>
                  <Textarea
                    value={requestForm.comments}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Reason for handover..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleRequestHandover} className="w-full">
                  Submit Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map(request => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">
                        {request.asset?.asset_code} - {request.asset?.type}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {request.from_employee?.first_name} {request.from_employee?.last_name} → {request.to_employee?.first_name} {request.to_employee?.last_name}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(request.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(request.status)}
                      {request.status}
                    </div>
                  </Badge>
                </div>

                {request.comments && (
                  <div className="mb-4">
                    <Label className="text-xs">Comments</Label>
                    <p className="text-sm text-muted-foreground">{request.comments}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Requested on {new Date(request.requested_on).toLocaleDateString()}
                  </p>
                  
                  {isHR && request.status === 'Requested' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproveReject(request.id, 'Approved')}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleApproveReject(request.id, 'Rejected')}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No handover requests found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};