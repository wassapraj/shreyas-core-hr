import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Upload, Wand2 } from "lucide-react";

export default function EmployeeLeave() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [rawText, setRawText] = useState("");
  const [formData, setFormData] = useState({
    type: "",
    start_date: "",
    end_date: "",
    reason: "",
    attachment_url: "",
    days: 1
  });

  useEffect(() => {
    if (user) {
      loadEmployeeData();
      loadLeaveRequests();
    }
  }, [user]);

  const loadEmployeeData = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    if (error) {
      console.error('Error loading employee:', error);
      toast({
        title: "Error",
        description: "Failed to load employee data",
        variant: "destructive"
      });
    } else {
      setEmployee(data);
    }
  };

  const loadLeaveRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employee?.id || '')
      .order('created_on', { ascending: false });

    if (error) {
      console.error('Error loading leave requests:', error);
      toast({
        title: "Error",
        description: "Failed to load leave requests",
        variant: "destructive"
      });
    } else {
      setLeaveRequests(data || []);
    }
    setLoading(false);
  };

  const handleAutoFill = async () => {
    if (!rawText.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text first",
        variant: "destructive"
      });
      return;
    }

    setAutoFilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('leave-autofill', {
        body: { rawText: rawText.trim() }
      });

      if (error) throw error;

      if (data.success) {
        const result = data.data;
        setFormData({
          type: result.type || "",
          start_date: result.start_date || "",
          end_date: result.end_date || result.start_date || "",
          reason: result.reason || rawText.trim(),
          attachment_url: "",
          days: 1
        });

        // Compute days if dates are available
        if (result.start_date && (result.end_date || result.start_date)) {
          await computeDays(result.start_date, result.end_date || result.start_date);
        }

        setIsDialogOpen(true);
        toast({
          title: "Success",
          description: "Auto-filled leave details"
        });
      }
    } catch (error) {
      console.error('Error auto-filling:', error);
      toast({
        title: "Error",
        description: "Failed to auto-fill leave details",
        variant: "destructive"
      });
    } finally {
      setAutoFilling(false);
    }
  };

  const computeDays = async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('leave-compute-days', {
        body: { start_date: startDate, end_date: endDate }
      });

      if (error) throw error;

      if (data.success) {
        setFormData(prev => ({ ...prev, days: data.days }));
      }
    } catch (error) {
      console.error('Error computing days:', error);
    }
  };

  const handleDateChange = async (field: 'start_date' | 'end_date', value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    if (newFormData.start_date && newFormData.end_date) {
      await computeDays(newFormData.start_date, newFormData.end_date);
    }
  };

  const handleSubmit = async () => {
    if (!employee?.id) {
      toast({
        title: "Error",
        description: "Employee data not loaded",
        variant: "destructive"
      });
      return;
    }

    if (!formData.type || !formData.start_date || !formData.reason) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (formData.end_date && formData.end_date < formData.start_date) {
      toast({
        title: "Error",
        description: "End date cannot be before start date",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Calculate priority score
      let priorityScore = 0;
      if (formData.start_date) {
        const startDate = new Date(formData.start_date);
        const today = new Date();
        const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        priorityScore = Math.max(0, 1 - (daysUntil / 14));
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: employee.id,
        type: formData.type as 'SL' | 'CL' | 'EL' | 'LOP',
        start_date: formData.start_date,
        end_date: formData.end_date || formData.start_date,
        days: formData.days,
        reason: formData.reason,
        attachment_url: formData.attachment_url || null,
        raw_text: rawText.trim() || null,
        status: 'Pending',
        priority_score: priorityScore
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request submitted. Track status below."
      });

      // Reset form
      setRawText("");
      setFormData({
        type: "",
        start_date: "",
        end_date: "",
        reason: "",
        attachment_url: "",
        days: 1
      });
      setIsDialogOpen(false);
      
      // Reload requests
      loadLeaveRequests();
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
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

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Leave</h1>
      </div>

      {/* Smart Leave Card */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Leave</CardTitle>
          <CardDescription>
            Describe your leave in natural language and we'll auto-fill the details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="raw-text">Describe your leave request</Label>
            <Textarea
              id="raw-text"
              placeholder="e.g., I need sick leave from 15 Jan to 17 Jan due to fever"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleAutoFill} 
                disabled={!rawText.trim() || autoFilling}
                className="w-full"
              >
                {autoFilling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Auto-fill & Review
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Review Leave Request</DialogTitle>
                <DialogDescription>
                  Please review and adjust the auto-filled details before submitting
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Leave Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SL">Sick Leave (SL)</SelectItem>
                      <SelectItem value="CL">Casual Leave (CL)</SelectItem>
                      <SelectItem value="EL">Earned Leave (EL)</SelectItem>
                      <SelectItem value="LOP">Loss of Pay (LOP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Days</Label>
                  <Input value={formData.days} readOnly className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleDateChange('start_date', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleDateChange('end_date', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="attachment">Attachment URL (Optional)</Label>
                <Input
                  id="attachment"
                  placeholder="https://..."
                  value={formData.attachment_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, attachment_url: e.target.value }))}
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Submit Leave Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* My Requests Card */}
      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
          <CardDescription>Track your leave request status</CardDescription>
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
                  <TableHead>Created</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {new Date(request.created_on).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>
                      {request.start_date ? new Date(request.start_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      {request.end_date ? new Date(request.end_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>{request.days}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}