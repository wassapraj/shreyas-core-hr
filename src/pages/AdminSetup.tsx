import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, Users, Database, CheckCircle, AlertCircle } from 'lucide-react';

const AdminSetup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const seedInitialUsers = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('seed-initial-users');

      if (error) {
        throw error;
      }

      setResults(data.results);
      setSetupComplete(true);
      
      toast({
        title: "Success",
        description: "Initial users and data have been seeded successfully",
      });

    } catch (error: any) {
      console.error('Error seeding users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to seed initial users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (setupComplete) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <img 
              src="/lovable-uploads/55fc8fc5-a89f-4a00-bcb1-ab0c5499703f.png" 
              alt="Shreyas Logo" 
              className="h-12 mx-auto mb-4"
            />
            <Shield className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h1 className="text-3xl font-bold text-green-600 mb-2">Setup Complete!</h1>
            <p className="text-muted-foreground">All initial users and data have been created successfully</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Seeding Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results?.users_created?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Users Created/Updated:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {results.users_created.map((user: any, index: number) => (
                      <div key={index} className="bg-muted/50 p-4 rounded-lg">
                        <div className="font-medium text-sm mb-2">{user.email}</div>
                        <div className={`text-xs px-2 py-1 rounded inline-block ${
                          user.status === 'created' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.status === 'created' ? 'Created' : 'Already Exists'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results?.employees_created?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Employee Records:</h4>
                  <div className="space-y-2">
                    {results.employees_created.map((emp: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-muted/50 p-3 rounded">
                        <span className="text-sm">{emp.email}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          emp.status === 'created' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {emp.status === 'created' ? 'Created' : 'Already Exists'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results?.errors?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Errors:
                  </h4>
                  <div className="space-y-1">
                    {results.errors.map((error: string, index: number) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Login credentials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Master Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p><strong>Email:</strong> admin@shreyasmedia.com</p>
                  <p><strong>Password:</strong> Admin@123</p>
                  <p><strong>Role:</strong> Super Admin</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">HR User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p><strong>Email:</strong> hr@shreyasmedia.com</p>
                  <p><strong>Password:</strong> HR@123</p>
                  <p><strong>Role:</strong> HR</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Employee Demo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p><strong>Email:</strong> employee.demo@shreyasmedia.com</p>
                  <p><strong>Password:</strong> Employee@123</p>
                  <p><strong>Role:</strong> Employee</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/auth'}
            >
              Go to Login Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <img 
            src="/lovable-uploads/55fc8fc5-a89f-4a00-bcb1-ab0c5499703f.png" 
            alt="Shreyas Logo" 
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold mb-2">Shreyas HRMS Setup</h1>
          <p className="text-muted-foreground">Initialize your HRMS with demo users and data</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seed Initial Users & Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Important</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This will create initial demo accounts with full system access. 
                      This should only be done once during initial setup.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">This will create:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">Master Admin</h4>
                    <p>admin@shreyasmedia.com</p>
                    <p className="text-xs text-muted-foreground">Password: Admin@123</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">HR User</h4>
                    <p>hr@shreyasmedia.com</p>
                    <p className="text-xs text-muted-foreground">Password: HR@123</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Employee Demo</h4>
                    <p>employee.demo@shreyasmedia.com</p>
                    <p className="text-xs text-muted-foreground">Password: Employee@123</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  + Employee record for Demo user with sample data
                </p>
              </div>

              <Button 
                onClick={seedInitialUsers} 
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                <Users className="h-4 w-4 mr-2" />
                {isLoading ? 'Seeding Data...' : 'Seed Initial Users & Data'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="outline" asChild>
            <a href="/auth">Go to Login Page</a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;