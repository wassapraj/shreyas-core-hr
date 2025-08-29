import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { User, Calendar, Clock, Package } from 'lucide-react';

interface EmployeeData {
  profile: any;
  recentLeaves: any[];
  recentAttendance: any[];
  assets: any[];
}

const EmployeeProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<EmployeeData>({
    profile: null,
    recentLeaves: [],
    recentAttendance: [],
    assets: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // Fetch employee profile
      const { data: profile, error: profileError } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      if (profile) {
        // Fetch recent leaves
        const { data: leaves, error: leavesError } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('employee_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (leavesError) throw leavesError;

        // Fetch recent attendance
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance_status')
          .select('*')
          .eq('employee_id', profile.id)
          .order('date', { ascending: false })
          .limit(10);

        if (attendanceError) throw attendanceError;

        // Fetch assets
        const { data: assets, error: assetsError } = await supabase
          .from('asset_assignments')
          .select(`
            *,
            assets:asset_id(*)
          `)
          .eq('employee_id', profile.id)
          .is('returned_on', null);

        if (assetsError) throw assetsError;

        setData({
          profile,
          recentLeaves: leaves || [],
          recentAttendance: attendance || [],
          assets: assets || []
        });
      }

    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your profile data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'P': 'default',
      'A': 'destructive', 
      'HD': 'secondary',
      'L': 'outline',
      'WFH': 'secondary'
    };
    
    const labels: Record<string, string> = {
      'P': 'Present',
      'A': 'Absent',
      'HD': 'Half Day', 
      'L': 'Leave',
      'WFH': 'Work From Home'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getLeaveStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'Pending': 'secondary',
      'Approved': 'default',
      'Rejected': 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div className="text-center py-12">
        <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-muted-foreground mb-4">
          Your employee profile hasn't been created yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Please contact HR to set up your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <Button onClick={fetchEmployeeData}>
          Refresh
        </Button>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Employee Code</label>
              <p className="font-medium">{data.profile.emp_code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="font-medium">
                {data.profile.first_name} {data.profile.last_name}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="font-medium">{data.profile.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Phone</label>
              <p className="font-medium">{data.profile.phone || 'Not provided'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Department</label>
              <p className="font-medium">{data.profile.department}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Designation</label>
              <p className="font-medium">{data.profile.designation}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Location</label>
              <p className="font-medium">{data.profile.location}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date of Joining</label>
              <p className="font-medium">
                {data.profile.doj ? new Date(data.profile.doj).toLocaleDateString() : 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <p className="font-medium">
                {data.profile.dob ? new Date(data.profile.dob).toLocaleDateString() : 'Not provided'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leaves */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Leave Requests
            </CardTitle>
            <CardDescription>Your last 5 leave requests</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentLeaves.length === 0 ? (
              <p className="text-muted-foreground">No leave requests found</p>
            ) : (
              <div className="space-y-3">
                {data.recentLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">
                        {leave.start_date && leave.end_date 
                          ? `${new Date(leave.start_date).toLocaleDateString()} - ${new Date(leave.end_date).toLocaleDateString()}`
                          : 'Dates pending'
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {leave.type || 'Type pending'} • {leave.days || 0} days
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {leave.reason || 'No reason provided'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getLeaveStatusBadge(leave.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(leave.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Attendance
            </CardTitle>
            <CardDescription>Last 10 days attendance record</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentAttendance.length === 0 ? (
              <p className="text-muted-foreground">No attendance records found</p>
            ) : (
              <div className="space-y-2">
                {data.recentAttendance.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {new Date(att.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Work Hours: {att.work_hours?.toFixed(1) || '0'} hrs
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(att.status)}
                      <span className="text-xs text-muted-foreground capitalize">
                        {att.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assigned Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assigned Assets
          </CardTitle>
          <CardDescription>Equipment and assets assigned to you</CardDescription>
        </CardHeader>
        <CardContent>
          {data.assets.length === 0 ? (
            <p className="text-muted-foreground">No assets assigned</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.assets.map((assignment) => (
                <div key={assignment.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{assignment.assets?.asset_code}</h4>
                    <Badge variant="outline">{assignment.assets?.status}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Type: {assignment.assets?.type || 'Not specified'}</p>
                    <p>Model: {assignment.assets?.model || 'Not specified'}</p>
                    <p>Assigned: {new Date(assignment.assigned_on).toLocaleDateString()}</p>
                    <p>Condition: {assignment.condition || 'Good'}</p>
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

export default EmployeeProfile;