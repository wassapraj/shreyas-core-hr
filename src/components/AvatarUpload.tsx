import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeAvatar } from './EmployeeAvatar';

interface AvatarUploadProps {
  employee: any;
  onAvatarUpdated: () => void;
}

export const AvatarUpload = ({ employee, onAvatarUpdated }: AvatarUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please select a JPG or PNG image file.'
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Image size must be less than 5MB.'
      });
      return;
    }

    uploadAvatar(file);
  };

  const uploadAvatar = async (file: File) => {
    setIsUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      // Upload via upload-employee-document function
      const { data, error } = await supabase.functions.invoke('upload-employee-document', {
        body: {
          employeeId: employee.id,
          documentKind: 'avatar',
          fileName: `avatar.${file.type.split('/')[1]}`,
          fileData: base64Data,
          contentType: file.type
        }
      });

      if (error) {
        throw error;
      }

      // Update employee record with new avatar URL
      const { error: updateError } = await supabase
        .from('employees')
        .update({ 
          avatar_url: data.s3Key,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Avatar Updated',
        description: 'Profile picture has been updated successfully.'
      });

      onAvatarUpdated();

    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload avatar'
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Picture
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <EmployeeAvatar
              avatarUrl={employee.avatar_url}
              firstName={employee.first_name}
              lastName={employee.last_name}
              size="lg"
              className="border-4 border-background shadow-lg"
            />
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Upload a profile picture for {employee.first_name} {employee.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                Supports JPG and PNG files up to 5MB
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            
            <Button
              onClick={triggerFileSelect}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {employee.avatar_url ? 'Change Picture' : 'Upload Picture'}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};