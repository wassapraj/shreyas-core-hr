import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  Search, 
  Filter, 
  Save, 
  Loader2, 
  Building, 
  Tag, 
  CheckCircle,
  AlertCircle 
} from 'lucide-react';


interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  brand: string | null;
  status: 'Active' | 'Inactive' | 'Terminated';
}

const DEPARTMENTS = [
  'Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 
  'Legal', 'Administration', 'IT Support', 'Customer Success'
];

const BRANDS = [
  'Shreyas Web Media', 'Shreyas Digital', 'Shreyas Consulting', 
  'Shreyas Labs', 'Shreyas Ventures'
];

const BulkAssignment = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'missing_brand' | 'missing_department' | 'all_active'>('all_active');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [bulkBrand, setBulkBrand] = useState('');
  const [bulkDepartment, setBulkDepartment] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, searchTerm, selectedFilter]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('employees')
        .select('id, emp_code, first_name, last_name, email, department, brand, status', { count: 'exact' })
        .eq('status', 'Active');

      // Apply search filter
      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,emp_code.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Apply specific filters
      switch (selectedFilter) {
        case 'missing_brand':
          query = query.is('brand', null);
          break;
        case 'missing_department':
          query = query.is('department', null);
          break;
        case 'all_active':
          // No additional filter - already filtered by Active status
          break;
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('first_name', { ascending: true });

      if (error) throw error;

      setEmployees(data || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load employees'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all non-terminated employees
      const selectableIds = employees
        .filter(emp => emp.status !== 'Terminated')
        .map(emp => emp.id);
      setSelectedEmployees(selectableIds);
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));
    }
  };

  const handleBulkAssignment = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Selection',
        description: 'Please select employees to update'
      });
      return;
    }

    if (!bulkBrand && !bulkDepartment) {
      toast({
        variant: 'destructive',
        title: 'No Changes',
        description: 'Please select brand or department to assign'
      });
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {};
      if (bulkBrand) updateData.brand = bulkBrand;
      if (bulkDepartment) updateData.department = bulkDepartment;

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .in('id', selectedEmployees)
        .not('status', 'eq', 'Terminated'); // Safety check

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Updated ${selectedEmployees.length} employee(s) successfully`
      });

      // Reset selection and refresh
      setSelectedEmployees([]);
      setBulkBrand('');
      setBulkDepartment('');
      fetchEmployees();
    } catch (error) {
      console.error('Error updating employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update employees'
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.emp_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectableEmployees = employees.filter(emp => emp.status !== 'Terminated');
  const allSelected = selectableEmployees.length > 0 && selectedEmployees.length === selectableEmployees.length;
  const someSelected = selectedEmployees.length > 0 && selectedEmployees.length < selectableEmployees.length;

  return (
    <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Bulk Brand & Department Assignment
            </h1>
            <p className="text-muted-foreground">
              Assign brands and departments to multiple employees at once
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter */}
          <Select value={selectedFilter} onValueChange={(value: any) => setSelectedFilter(value)}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_active">All Active Employees</SelectItem>
              <SelectItem value="missing_brand">Missing Brand</SelectItem>
              <SelectItem value="missing_department">Missing Department</SelectItem>
            </SelectContent>
          </Select>

          {/* Bulk Brand */}
          <Select value={bulkBrand} onValueChange={setBulkBrand}>
            <SelectTrigger>
              <Tag className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— No Change —</SelectItem>
              {BRANDS.map(brand => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk Department */}
          <Select value={bulkDepartment} onValueChange={setBulkDepartment}>
            <SelectTrigger>
              <Building className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— No Change —</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedEmployees.length > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span className="font-medium">
                    {selectedEmployees.length} employee(s) selected
                  </span>
                </div>
                <Button 
                  onClick={handleBulkAssignment} 
                  disabled={saving || (!bulkBrand && !bulkDepartment)}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Apply Changes
                </Button>
              </div>
              {(bulkBrand || bulkDepartment) && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Will assign: {bulkBrand && `Brand: ${bulkBrand}`} {bulkBrand && bulkDepartment && ' • '} {bulkDepartment && `Department: ${bulkDepartment}`}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Employee List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Employee List ({employees.length})</span>
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEmployees.includes(employee.id)}
                            onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                            disabled={employee.status === 'Terminated'}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {employee.emp_code}
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>
                          {employee.brand ? (
                            <Badge variant="secondary">{employee.brand}</Badge>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Not Set
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {employee.department ? (
                            <Badge variant="outline">{employee.department}</Badge>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Not Set
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.status === 'Active' ? 'default' : 'destructive'}>
                            {employee.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, employees.length)} of {employees.length} employees
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkAssignment;