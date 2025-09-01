
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import EmployeeSnapshotHeader from '@/components/EmployeeSnapshotHeader';
import EmployeeProfileTabs from '@/components/EmployeeProfileTabs';

const EmployeeProfileDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
      if (id || searchParams.get('code')) {
        fetchEmployee();
      }
    }
  }, [user, id, searchParams]);

  const fetchUserRoles = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      setUserRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const resolveEmployee = async (identifier: string) => {
    // First try by emp_code (WM pattern)
    if (/^WM\d{4}$/i.test(identifier)) {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('emp_code', identifier)
        .maybeSingle();
      
      if (!error && data) return data;
    }
    
    // Try by UUID
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', identifier)
      .maybeSingle();
      
    if (!error && data) return data;
    
    return null;
  };

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      
      // Support routing by emp_code via query parameter or direct id
      const empCode = searchParams.get('code');
      const identifier = empCode || id;
      
      if (!identifier) {
        throw new Error('No employee identifier provided');
      }

      const data = await resolveEmployee(identifier);

      if (!data) {
        throw new Error('Employee not found');
      }

      // Check if user can view this employee
      const isHR = userRoles.includes('hr') || userRoles.includes('super_admin');
      const isOwnProfile = data.user_id === user?.id;

      if (!isHR && !isOwnProfile) {
        throw new Error('Unauthorized to view this profile');
      }

      setEmployee(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee profile',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded-lg mb-6"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Employee Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The employee profile you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <button 
          onClick={() => window.history.back()} 
          className="text-primary hover:underline"
        >
          ← Back to previous page
        </button>
      </div>
    );
  }

  const isHR = userRoles.includes('hr') || userRoles.includes('super_admin');
  const isSuperAdmin = userRoles.includes('super_admin');

  return (
    <div className="space-y-6">
      <EmployeeSnapshotHeader 
        employeeId={employee.id}
        isHR={isHR}
        isSelfView={employee.user_id === user?.id}
      />
      
      <EmployeeProfileTabs
        employee={employee}
        isHR={isHR}
        isSuperAdmin={isSuperAdmin}
        onEmployeeUpdate={fetchEmployee}
      />
    </div>
  );
};

export default EmployeeProfileDetail;
