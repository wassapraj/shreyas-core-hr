import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import EmployeeSnapshotHeader from '@/components/EmployeeSnapshotHeader';
import EmployeeProfileTabs from '@/components/EmployeeProfileTabs';

const EmployeeProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEmployee();
    }
  }, [user]);

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your profile',
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
        <h2 className="text-2xl font-bold mb-2">Employee Profile Not Found</h2>
        <p className="text-muted-foreground">
          Your employee profile hasn't been created yet. Please contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EmployeeSnapshotHeader 
        employeeId={employee.id}
      />
      
      <EmployeeProfileTabs
        employee={employee}
        isHR={false}
        isSuperAdmin={false}
        onEmployeeUpdate={fetchEmployee}
      />
    </div>
  );
};

export default EmployeeProfile;