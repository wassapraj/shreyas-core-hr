import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

const EmployeeCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    location: '',
    doj: '',
    monthly_ctc: '',
    manager_employee_id: '',
    current_address: '',
    permanent_address: ''
  });

  const departments = [
    'Engineering', 'Human Resources', 'Finance', 'Marketing', 
    'Sales', 'Operations', 'Legal', 'Administration'
  ];

  const locations = [
    'Hyderabad', 'Bangalore', 'Chennai', 'Mumbai', 'Delhi', 'Remote'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateEmpCode = async (): Promise<string> => {
    // First try to get from emp_code_pool
    const { data: poolCode, error: poolError } = await supabase
      .from('emp_code_pool')
      .select('code')
      .limit(1)
      .single();

    if (poolCode && !poolError) {
      // Remove from pool
      await supabase
        .from('emp_code_pool')
        .delete()
        .eq('code', poolCode.code);
      
      return poolCode.code;
    }

    // Generate new code by finding max emp_code
    const { data: employees, error } = await supabase
      .from('employees')
      .select('emp_code')
      .order('emp_code', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching emp_code:', error);
      return 'EMP001';
    }

    if (!employees || employees.length === 0) {
      return 'EMP001';
    }

    const lastCode = employees[0].emp_code;
    const match = lastCode.match(/EMP(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1]) + 1;
      return `EMP${nextNumber.toString().padStart(3, '0')}`;
    }

    return 'EMP001';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.email) {
      toast({ 
        variant: 'destructive',
        title: 'Error',
        description: 'First name and email are required'
      });
      return;
    }

    setLoading(true);

    try {
      const empCode = await generateEmpCode();
      
      const { data: employee, error } = await supabase
        .from('employees')
        .insert({
          emp_code: empCode,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department || null,
          designation: formData.designation || null,
          location: formData.location || null,
          doj: formData.doj || null,
          monthly_ctc: formData.monthly_ctc ? parseFloat(formData.monthly_ctc) : null,
          current_address: formData.current_address || null,
          permanent_address: formData.permanent_address || null,
          status: 'Active'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Employee ${empCode} created successfully`
      });

      navigate(`/hr/employees/${employee.id}`);
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast({ 
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create employee'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/hr/employees')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
        <h1 className="text-3xl font-bold">Add New Employee</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) => handleInputChange('designation', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="location">Location</Label>
                <Select value={formData.location} onValueChange={(value) => handleInputChange('location', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="doj">Date of Joining</Label>
                <Input
                  id="doj"
                  type="date"
                  value={formData.doj}
                  onChange={(e) => handleInputChange('doj', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="monthly_ctc">Monthly CTC</Label>
                <Input
                  id="monthly_ctc"
                  type="number"
                  value={formData.monthly_ctc}
                  onChange={(e) => handleInputChange('monthly_ctc', e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="current_address">Current Address</Label>
                <Textarea
                  id="current_address"
                  value={formData.current_address}
                  onChange={(e) => handleInputChange('current_address', e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="permanent_address">Permanent Address</Label>
                <Textarea
                  id="permanent_address"
                  value={formData.permanent_address}
                  onChange={(e) => handleInputChange('permanent_address', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/hr/employees')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Creating...' : 'Create Employee'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmployeeCreate;