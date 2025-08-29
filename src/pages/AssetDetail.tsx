import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft,
  Plus, 
  Edit, 
  RotateCcw,
  User,
  Calendar
} from 'lucide-react';

interface Asset {
  id: string;
  asset_code: string;
  type: string;
  model: string;
  serial: string;
  purchase_date: string;
  warranty_till: string;
  status: string;
}

interface AssetAssignment {
  id: string;
  employee_id: string;
  assigned_on: string;
  returned_on?: string;
  condition: string;
  notes?: string;
  employees: {
    first_name: string;
    last_name: string;
    emp_code: string;
    department: string;
  };
}

const AssetDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssetAssignment | null>(null);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    assigned_on: new Date().toISOString().split('T')[0],
    condition: 'Good',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadAssetData();
      loadEmployees();
    }
  }, [id]);

  const loadAssetData = async () => {
    try {
      setLoading(true);
      
      // Load asset details
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single();

      if (assetError) throw assetError;
      setAsset(assetData);

      // Load assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          employees!inner(first_name, last_name, emp_code, department)
        `)
        .eq('asset_id', id)
        .order('assigned_on', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

    } catch (error) {
      console.error('Error loading asset data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load asset data"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, emp_code, department')
        .eq('status', 'Active')
        .order('emp_code');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const assignAsset = async () => {
    if (!assignForm.employee_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an employee"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('asset_assignments')
        .insert({
          asset_id: id,
          ...assignForm
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Asset assigned successfully"
      });

      setAssignModalOpen(false);
      setAssignForm({
        employee_id: '',
        assigned_on: new Date().toISOString().split('T')[0],
        condition: 'Good',
        notes: ''
      });
      loadAssetData();
    } catch (error: any) {
      console.error('Error assigning asset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign asset"
      });
    }
  };

  const returnAsset = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('asset_assignments')
        .update({ returned_on: new Date().toISOString().split('T')[0] })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Asset returned successfully"
      });

      loadAssetData();
    } catch (error: any) {
      console.error('Error returning asset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to return asset"
      });
    }
  };

  const updateAssignment = async () => {
    if (!selectedAssignment) return;

    try {
      const { error } = await supabase
        .from('asset_assignments')
        .update({
          condition: assignForm.condition,
          notes: assignForm.notes
        })
        .eq('id', selectedAssignment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment updated successfully"
      });

      setEditModalOpen(false);
      setSelectedAssignment(null);
      loadAssetData();
    } catch (error: any) {
      console.error('Error updating assignment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update assignment"
      });
    }
  };

  const openEditModal = (assignment: AssetAssignment) => {
    setSelectedAssignment(assignment);
    setAssignForm({
      employee_id: assignment.employee_id,
      assigned_on: assignment.assigned_on,
      condition: assignment.condition,
      notes: assignment.notes || ''
    });
    setEditModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/hr/assets">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold gradient-text">Loading...</h1>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/hr/assets">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold gradient-text">Asset Not Found</h1>
        </div>
      </div>
    );
  }

  const currentAssignment = assignments.find(a => !a.returned_on);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/hr/assets">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold gradient-text">
            {asset.asset_code}
          </h1>
          <p className="text-muted-foreground">
            {asset.type} {asset.model && `• ${asset.model}`}
          </p>
        </div>
      </div>

      {/* Asset Details */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Asset Information</CardTitle>
          <CardDescription>Complete details about this asset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Asset Code</Label>
              <p className="text-base">{asset.asset_code}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Type</Label>
              <p className="text-base">{asset.type}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <Badge variant={asset.status === 'InUse' ? 'default' : asset.status === 'Available' ? 'secondary' : 'destructive'}>
                {asset.status}
              </Badge>
            </div>
            {asset.model && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Model</Label>
                <p className="text-base">{asset.model}</p>
              </div>
            )}
            {asset.serial && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Serial Number</Label>
                <p className="text-base">{asset.serial}</p>
              </div>
            )}
            {asset.purchase_date && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Purchase Date</Label>
                <p className="text-base">{new Date(asset.purchase_date).toLocaleDateString()}</p>
              </div>
            )}
            {asset.warranty_till && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Warranty Till</Label>
                <p className="text-base">{new Date(asset.warranty_till).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Assignment */}
      {currentAssignment && (
        <Card className="glass-card border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Currently Assigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">
                  {currentAssignment.employees.first_name} {currentAssignment.employees.last_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentAssignment.employees.emp_code} • {currentAssignment.employees.department}
                </p>
                <p className="text-sm text-muted-foreground">
                  Assigned: {new Date(currentAssignment.assigned_on).toLocaleDateString()} • 
                  Condition: {currentAssignment.condition}
                </p>
                {currentAssignment.notes && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Notes: {currentAssignment.notes}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => returnAsset(currentAssignment.id)}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Return
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment History */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assignment History</CardTitle>
              <CardDescription>
                Track who has been assigned this asset
              </CardDescription>
            </div>
            
            {!currentAssignment && (
              <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Asset
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card">
                  <DialogHeader>
                    <DialogTitle>Assign Asset</DialogTitle>
                    <DialogDescription>
                      Assign this asset to an employee.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="employee_id">Employee *</Label>
                      <Select value={assignForm.employee_id} onValueChange={(value) => setAssignForm({ ...assignForm, employee_id: value })}>
                        <SelectTrigger className="form-modern">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name} ({emp.emp_code}) - {emp.department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assigned_on">Assigned On</Label>
                        <Input
                          id="assigned_on"
                          type="date"
                          value={assignForm.assigned_on}
                          onChange={(e) => setAssignForm({ ...assignForm, assigned_on: e.target.value })}
                          className="form-modern"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="condition">Condition</Label>
                        <Select value={assignForm.condition} onValueChange={(value) => setAssignForm({ ...assignForm, condition: value })}>
                          <SelectTrigger className="form-modern">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Excellent">Excellent</SelectItem>
                            <SelectItem value="Good">Good</SelectItem>
                            <SelectItem value="Fair">Fair</SelectItem>
                            <SelectItem value="Poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional notes about this assignment"
                        value={assignForm.notes}
                        onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                        className="form-modern"
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-6">
                      <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={assignAsset}>Assign Asset</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No assignment history found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">
                        {assignment.employees.first_name} {assignment.employees.last_name}
                      </h3>
                      <Badge variant="outline">{assignment.employees.emp_code}</Badge>
                      {!assignment.returned_on && <Badge>Current</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {assignment.employees.department}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Assigned: {new Date(assignment.assigned_on).toLocaleDateString()}</span>
                      {assignment.returned_on && (
                        <span>Returned: {new Date(assignment.returned_on).toLocaleDateString()}</span>
                      )}
                      <span>Condition: {assignment.condition}</span>
                    </div>
                    {assignment.notes && (
                      <p className="text-sm text-muted-foreground">
                        Notes: {assignment.notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(assignment)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    
                    {!assignment.returned_on && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => returnAsset(assignment.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Return
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Assignment Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>
              Update assignment details and notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit_condition">Condition</Label>
              <Select value={assignForm.condition} onValueChange={(value) => setAssignForm({ ...assignForm, condition: value })}>
                <SelectTrigger className="form-modern">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Excellent">Excellent</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                placeholder="Any additional notes about this assignment"
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                className="form-modern"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateAssignment}>Update Assignment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetDetail;