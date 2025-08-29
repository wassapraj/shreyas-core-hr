import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle } from 'lucide-react';

const AdminSetup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const { toast } = useToast();

  const setupMasterAdmin = async () => {
    setIsLoading(true);
    
    try {
      // Step 1: Create the admin user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'raj@shreyasgroup.net',
        password: '8985141487',
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: 'Raj',
            role: 'super_admin'
          }
        }
      });

      if (authError) {
        // If user already exists, try to get their ID
        if (authError.message.includes('already registered')) {
          toast({
            title: 'Account exists',
            description: 'Admin account already exists. Setting up role assignment...',
          });
          
          // Try to assign role to existing user
          await assignAdminRole();
          return;
        }
        throw authError;
      }

      if (authData.user) {
        toast({
          title: 'Account created',
          description: 'Master admin account created successfully.',
        });
        
        // Step 2: Create employee record and assign role
        await setupAdminProfile(authData.user.id);
      }

    } catch (error: any) {
      console.error('Setup error:', error);
      toast({
        title: 'Setup failed',
        description: error.message || 'Failed to create master admin account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const assignAdminRole = async () => {
    try {
      // For existing users, we'll need to handle this manually
      // The user should sign in first, then we can assign the role
      toast({
        title: 'Manual setup required',
        description: 'Please sign in with raj@shreyasgroup.net first, then contact support to assign admin role.',
        variant: 'destructive',
      });
    } catch (error: any) {
      throw new Error(`Failed to assign admin role: ${error.message}`);
    }
  };

  const setupAdminProfile = async (userId: string) => {
    try {
      // Create employee record
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .upsert({
          user_id: userId,
          emp_code: 'ADMIN001',
          first_name: 'Raj',
          last_name: 'Admin',
          email: 'raj@shreyasgroup.net',
          department: 'Administration',
          designation: 'Master Admin',
          location: 'HQ',
          status: 'Active',
          doj: new Date().toISOString().split('T')[0],
          monthly_ctc: 0
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (empError) throw empError;

      // Assign super_admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'super_admin'
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) throw roleError;

      toast({
        title: 'Setup complete!',
        description: 'Master admin account is ready. You can now sign in.',
      });

      setSetupComplete(true);

    } catch (error: any) {
      throw new Error(`Failed to setup admin profile: ${error.message}`);
    }
  };

  if (setupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <CardTitle className="text-green-600">Setup Complete!</CardTitle>
            <CardDescription>
              Master admin account has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Admin Credentials</h4>
              <p className="text-sm text-green-700">
                <strong>Email:</strong> raj@shreyasgroup.net<br />
                <strong>Password:</strong> 8985141487<br />
                <strong>Role:</strong> Super Admin
              </p>
            </div>
            
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/auth'}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle>Master Admin Setup</CardTitle>
          <CardDescription>
            One-time setup to create the master administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Important</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  This will create a master admin account with full system access. 
                  This should only be done once during initial setup.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border rounded-lg">
            <h4 className="font-medium mb-2">Admin Account Details</h4>
            <div className="text-sm space-y-1">
              <p><strong>Email:</strong> raj@shreyasgroup.net</p>
              <p><strong>Password:</strong> 8985141487</p>
              <p><strong>Role:</strong> Super Admin</p>
              <p><strong>Employee Code:</strong> ADMIN001</p>
            </div>
          </div>

          <Button 
            onClick={setupMasterAdmin}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Setting up...' : 'Create Master Admin'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            After setup, you can access this page at /admin-setup
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;