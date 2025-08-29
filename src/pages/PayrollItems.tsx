import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft,
  Eye, 
  DollarSign, 
  FileText,
  CheckCircle,
  Clock,
  Calculator,
  Printer
} from 'lucide-react';

interface PayrollItem {
  id: string;
  employee_id: string;
  gross: number;
  deductions: number;
  net: number;
  lop_days: number;
  breakup_json: any;
  paid: boolean;
  paid_at?: string;
  evidence_url?: string;
  remarks?: string;
  employees: {
    first_name: string;
    last_name: string;
    emp_code: string;
    department: string;
    designation: string;
  };
}

interface PayrollRun {
  run_id: string;
  month: number;
  year: number;
  status: string;
  created_on: string;
}

const PayrollItems = () => {
  const { runId } = useParams<{ runId: string }>();
  const { toast } = useToast();
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipHtml, setPayslipHtml] = useState('');
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PayrollItem | null>(null);
  const [paidForm, setPaidForm] = useState({
    evidence_url: '',
    remarks: ''
  });

  useEffect(() => {
    if (runId) {
      loadPayrollData();
    }
  }, [runId]);

  const loadPayrollData = async () => {
    try {
      setLoading(true);
      
      // Load payroll run info
      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('run_id', runId)
        .single();

      if (runError) throw runError;
      setRun(runData);

      // Load payroll items
      const { data: itemsData, error: itemsError } = await supabase
        .from('payroll_items')
        .select(`
          *,
          employees!inner(first_name, last_name, emp_code, department, designation)
        `)
        .eq('run_id', runId)
        .order('employees(emp_code)');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

    } catch (error) {
      console.error('Error loading payroll data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load payroll data"
      });
    } finally {
      setLoading(false);
    }
  };

  const viewPayslip = async (item: PayrollItem) => {
    try {
      const { data, error } = await supabase.functions.invoke('payroll-render-payslip', {
        body: { item_id: item.id }
      });

      if (error) throw error;

      setPayslipHtml(data.html);
      setPayslipModalOpen(true);
    } catch (error: any) {
      console.error('Error generating payslip:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate payslip"
      });
    }
  };

  const markAsPaid = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase.functions.invoke('payroll-mark-paid', {
        body: {
          item_id: selectedItem.id,
          evidence_url: paidForm.evidence_url,
          remarks: paidForm.remarks
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payroll item marked as paid"
      });

      setMarkPaidModalOpen(false);
      setPaidForm({ evidence_url: '', remarks: '' });
      loadPayrollData();
    } catch (error: any) {
      console.error('Error marking as paid:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to mark as paid"
      });
    }
  };

  const printPayslip = () => {
    window.print();
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `Month ${month}`;
  };

  const totalStats = {
    gross: items.reduce((sum, item) => sum + (item.gross || 0), 0),
    deductions: items.reduce((sum, item) => sum + (item.deductions || 0), 0),
    net: items.reduce((sum, item) => sum + (item.net || 0), 0),
    paid: items.filter(item => item.paid).length,
    pending: items.filter(item => !item.paid).length
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/hr/payroll">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold gradient-text">Loading...</h1>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => (
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/hr/payroll">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold gradient-text">
            Payroll Items - {run?.run_id}
          </h1>
          {run && (
            <p className="text-muted-foreground">
              {getMonthName(run.month)} {run.year} • {items.length} employees
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calculator className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Gross Total</p>
                <p className="font-bold">₹{totalStats.gross.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Deductions</p>
                <p className="font-bold">₹{totalStats.deductions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Net Total</p>
                <p className="font-bold">₹{totalStats.net.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="font-bold">{totalStats.paid}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="font-bold">{totalStats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Items */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Payroll Items</CardTitle>
          <CardDescription>
            Individual salary calculations for {getMonthName(run?.month || 1)} {run?.year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No payroll items found for this run.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">
                        {item.employees.first_name} {item.employees.last_name}
                      </h3>
                      <Badge variant="outline">{item.employees.emp_code}</Badge>
                      {item.paid ? (
                        <Badge variant="secondary">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.employees.department} • {item.employees.designation}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span>Gross: ₹{item.gross?.toLocaleString()}</span>
                      <span>Deductions: ₹{item.deductions?.toLocaleString()}</span>
                      <span className="font-medium">Net: ₹{item.net?.toLocaleString()}</span>
                      {item.lop_days > 0 && (
                        <span className="text-destructive">LOP: {item.lop_days} days</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewPayslip(item)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Payslip
                    </Button>
                    
                    {!item.paid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setMarkPaidModalOpen(true);
                        }}
                      >
                        <DollarSign className="h-3 w-3 mr-1" />
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payslip Modal */}
      <Dialog open={payslipModalOpen} onOpenChange={setPayslipModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Payslip Preview</DialogTitle>
            <DialogDescription>
              Review the payslip and use the print button to generate PDF
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={printPayslip} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
            <div 
              dangerouslySetInnerHTML={{ __html: payslipHtml }}
              className="border rounded p-4 bg-white text-black"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Modal */}
      <Dialog open={markPaidModalOpen} onOpenChange={setMarkPaidModalOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Mark this payroll item as paid and add payment evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="evidence_url">Evidence URL (Optional)</Label>
              <Input
                id="evidence_url"
                placeholder="Link to payment confirmation, receipt, etc."
                value={paidForm.evidence_url}
                onChange={(e) => setPaidForm({ ...paidForm, evidence_url: e.target.value })}
                className="form-modern"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                placeholder="Additional notes about this payment"
                value={paidForm.remarks}
                onChange={(e) => setPaidForm({ ...paidForm, remarks: e.target.value })}
                className="form-modern"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setMarkPaidModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={markAsPaid}>Mark as Paid</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollItems;