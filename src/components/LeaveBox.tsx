import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
}

interface LeaveBoxProps {
  onLeaveAdded?: () => void;
}

export default function LeaveBox({ onLeaveAdded }: LeaveBoxProps) {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [managerSearchOpen, setManagerSearchOpen] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    approved_by: "",
    type: "",
    start_date: "",
    end_date: "",
    reason: "",
    days: 1
  });

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      loadManagers();
    }
  }, [isOpen]);

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, emp_code, first_name, last_name, designation, department')
      .eq('status', 'Active')
      .order('first_name');

    if (error) {
      console.error('Error loading employees:', error);
    } else {
      setEmployees(data || []);
    }
  };

  const loadManagers = async () => {
    // Get employees who have HR or super_admin roles
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['hr', 'super_admin']);

    if (roleError) {
      console.error('Error loading user roles:', roleError);
      return;
    }

    const userIds = roleData?.map(role => role.user_id) || [];
    
    if (userIds.length === 0) {
      setManagers([]);
      return;
    }

    const { data, error } = await supabase
      .from('employees')
      .select('id, emp_code, first_name, last_name, designation, department')
      .in('user_id', userIds);

    if (error) {
      console.error('Error loading managers:', error);
    } else {
      setManagers(data || []);
    }
  };

  const computeDays = () => {
    if (!formData.start_date || !formData.end_date) return 1;
    
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays;
  };

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    if (field === 'start_date' && !newFormData.end_date) {
      newFormData.end_date = value;
    }
    
    newFormData.days = computeDays();
    setFormData(newFormData);
  };

  const handleSubmit = async () => {
    if (!formData.employee_id || !formData.approved_by || !formData.type || !formData.start_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('leave-record', {
        body: {
          employee_id: formData.employee_id,
          approved_by: formData.approved_by,
          type: formData.type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason,
          days: formData.days
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Leave recorded successfully. Updated ${data.data.attendance_updated} attendance records.`
        });

        // Reset form
        setFormData({
          employee_id: "",
          approved_by: "",
          type: "",
          start_date: "",
          end_date: "",
          reason: "",
          days: 1
        });

        setIsOpen(false);
        onLeaveAdded?.();
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Error recording leave:', error);
      toast({
        title: "Error",
        description: "Failed to record leave",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasRole('hr')) {
    return null;
  }

  const selectedEmployee = employees.find(e => e.id === formData.employee_id);
  const selectedManager = managers.find(m => m.id === formData.approved_by);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Record Leave / Add Leave
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Employee Leave</DialogTitle>
          <DialogDescription>
            Record leave for an employee. This will automatically update attendance records.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={employeeSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedEmployee
                    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} (${selectedEmployee.emp_code})`
                    : "Select employee..."
                  }
                  <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandEmpty>No employee found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {employees.map((employee) => (
                        <CommandItem
                          key={employee.id}
                          onSelect={() => {
                            setFormData(prev => ({ ...prev, employee_id: employee.id }));
                            setEmployeeSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{employee.first_name} {employee.last_name}</span>
                            <span className="text-sm text-muted-foreground">
                              {employee.emp_code} • {employee.designation}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Manager/Approver Selection */}
          <div className="space-y-2">
            <Label>Approved By *</Label>
            <Popover open={managerSearchOpen} onOpenChange={setManagerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={managerSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedManager
                    ? `${selectedManager.first_name} ${selectedManager.last_name}`
                    : "Select approver..."
                  }
                  <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search managers..." />
                  <CommandEmpty>No manager found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {managers.map((manager) => (
                        <CommandItem
                          key={manager.id}
                          onSelect={() => {
                            setFormData(prev => ({ ...prev, approved_by: manager.id }));
                            setManagerSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{manager.first_name} {manager.last_name}</span>
                            <span className="text-sm text-muted-foreground">
                              {manager.designation}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Leave Type */}
          <div className="space-y-2">
            <Label>Leave Type *</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
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

          {/* Days */}
          <div className="space-y-2">
            <Label>Days</Label>
            <Input 
              type="number"
              value={formData.days} 
              readOnly 
              className="bg-muted" 
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>From Date *</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => handleDateChange('start_date', e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>To Date</Label>
            <Input
              type="date"
              value={formData.end_date}
              onChange={(e) => handleDateChange('end_date', e.target.value)}
            />
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea
            placeholder="Optional reason for leave"
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            className="min-h-[60px]"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Record Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}