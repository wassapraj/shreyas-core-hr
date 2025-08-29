import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Package,
  Calendar,
  FileText,
  Monitor
} from 'lucide-react';

interface AssetAssignment {
  id: string;
  assigned_on: string;
  returned_on?: string;
  condition: string;
  notes?: string;
  assets: {
    asset_code: string;
    type: string;
    model: string;
    serial: string;
    status: string;
  };
}

const EmployeeAssets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMyAssets();
    }
  }, [user]);

  const loadMyAssets = async () => {
    try {
      setLoading(true);
      
      // First get current employee
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (empError) throw empError;

      // Load asset assignments
      const { data, error } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          assets!inner(asset_code, type, model, serial, status)
        `)
        .eq('employee_id', employee.id)
        .order('assigned_on', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);

    } catch (error) {
      console.error('Error loading assets:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load your assets"
      });
    } finally {
      setLoading(false);
    }
  };

  const currentAssignments = assignments.filter(a => !a.returned_on);
  const pastAssignments = assignments.filter(a => a.returned_on);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold gradient-text">My Assets</h1>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold gradient-text">My Assets</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Monitor className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Currently Assigned</p>
                <p className="text-2xl font-bold">{currentAssignments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Total Assigned</p>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Returned</p>
                <p className="text-2xl font-bold">{pastAssignments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Assets */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Currently Assigned Assets
          </CardTitle>
          <CardDescription>
            Assets currently assigned to you
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentAssignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No assets currently assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{assignment.assets.asset_code}</h3>
                      <Badge variant="default">Current</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {assignment.assets.type} {assignment.assets.model && `• ${assignment.assets.model}`}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {assignment.assets.serial && (
                        <span>S/N: {assignment.assets.serial}</span>
                      )}
                      <span>Assigned: {new Date(assignment.assigned_on).toLocaleDateString()}</span>
                      <span>Condition: {assignment.condition}</span>
                    </div>
                    {assignment.notes && (
                      <p className="text-sm text-muted-foreground">
                        Notes: {assignment.notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {Math.floor((new Date().getTime() - new Date(assignment.assigned_on).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Asset History</CardTitle>
          <CardDescription>
            Previously assigned assets and their return dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pastAssignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No asset history found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors opacity-75"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{assignment.assets.asset_code}</h3>
                      <Badge variant="secondary">Returned</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {assignment.assets.type} {assignment.assets.model && `• ${assignment.assets.model}`}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {assignment.assets.serial && (
                        <span>S/N: {assignment.assets.serial}</span>
                      )}
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
                  
                  <div className="text-sm text-muted-foreground">
                    {assignment.returned_on && (
                      <span>
                        Used for{' '}
                        {Math.floor(
                          (new Date(assignment.returned_on).getTime() - new Date(assignment.assigned_on).getTime()) / 
                          (1000 * 60 * 60 * 24)
                        )}{' '}
                        days
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeAssets;