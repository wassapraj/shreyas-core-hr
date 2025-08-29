import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Play, 
  Eye, 
  Calendar,
  DollarSign,
  Calculator,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface PayrollRun {
  id: string;
  run_id: string;
  month: number;
  year: number;
  status: string;
  created_on: string;
  notes?: string;
}

const PayrollRuns = () => {
  const { toast } = useToast();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRun, setNewRun] = useState({
    run_id: '',
    month: '',
    year: new Date().getFullYear(),
    notes: ''
  });

  useEffect(() => {
    loadPayrollRuns();
  }, []);

  const loadPayrollRuns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_on', { ascending: false });

      if (error) throw error;
      setRuns(data || []);
    } catch (error) {
      console.error('Error loading payroll runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load payroll runs"
      });
    } finally {
      setLoading(false);
    }
  };

  const createPayrollRun = async () => {
    if (!newRun.run_id || !newRun.month || !newRun.year) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('payroll_runs')
        .insert({
          run_id: newRun.run_id,
          month: parseInt(newRun.month),
          year: newRun.year,
          notes: newRun.notes,
          status: 'Draft'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payroll run created successfully"
      });

      setCreateModalOpen(false);
      setNewRun({ run_id: '', month: '', year: new Date().getFullYear(), notes: '' });
      loadPayrollRuns();
    } catch (error: any) {
      console.error('Error creating payroll run:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create payroll run"
      });
    }
  };

  const computePayroll = async (runId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('payroll-compute', {
        body: { run_id: runId }
      });

      if (error) throw error;

      toast({
        title: "Payroll Computed",
        description: `Processed ${data.processed} employees. Gross: ₹${data.grossTotals.toLocaleString()}, Net: ₹${data.netTotals.toLocaleString()}`
      });

      loadPayrollRuns();
    } catch (error: any) {
      console.error('Error computing payroll:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to compute payroll"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'Draft': 'outline',
      'Computed': 'default',
      'Paid': 'secondary'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `Month ${month}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold gradient-text">Payroll Runs</h1>
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
        <h1 className="text-3xl font-bold gradient-text">Payroll Runs</h1>
        
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="btn-modern">
              <Plus className="h-4 w-4 mr-2" />
              New Run
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Create New Payroll Run</DialogTitle>
              <DialogDescription>
                Create a new payroll run for a specific month and year.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="run_id">Run ID</Label>
                <Input
                  id="run_id"
                  placeholder="e.g., PAY-2024-01"
                  value={newRun.run_id}
                  onChange={(e) => setNewRun({ ...newRun, run_id: e.target.value })}
                  className="form-modern"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Month</Label>
                  <Select value={newRun.month} onValueChange={(value) => setNewRun({ ...newRun, month: value })}>
                    <SelectTrigger className="form-modern">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {getMonthName(i + 1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={newRun.year}
                    onChange={(e) => setNewRun({ ...newRun, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="form-modern"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Optional notes for this run"
                  value={newRun.notes}
                  onChange={(e) => setNewRun({ ...newRun, notes: e.target.value })}
                  className="form-modern"
                />
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createPayrollRun}>Create Run</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold">{runs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Draft Runs</p>
                <p className="text-2xl font-bold">{runs.filter(r => r.status === 'Draft').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calculator className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Computed</p>
                <p className="text-2xl font-bold">{runs.filter(r => r.status === 'Computed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Paid Runs</p>
                <p className="text-2xl font-bold">{runs.filter(r => r.status === 'Paid').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Runs Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
          <CardDescription>
            Manage payroll runs and compute salaries for employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No payroll runs found. Create your first run to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{run.run_id}</h3>
                      {getStatusBadge(run.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getMonthName(run.month)} {run.year}
                      {run.notes && ` • ${run.notes}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(run.created_on).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {run.status === 'Draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => computePayroll(run.run_id)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Compute
                      </Button>
                    )}
                    
                    <Link to={`/hr/payroll/${run.run_id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        View Items
                      </Button>
                    </Link>
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

export default PayrollRuns;