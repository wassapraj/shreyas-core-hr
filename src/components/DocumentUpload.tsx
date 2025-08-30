import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileText, Loader2 } from 'lucide-react';

interface DocumentUploadProps {
  employeeId: string;
  kind: string;
  label: string;
  currentFile?: string;
  onUploadComplete?: () => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  employeeId,
  kind,
  label,
  currentFile,
  onUploadComplete
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employee_id', employeeId);
      formData.append('kind', kind);
      formData.append('filename', file.name);

      const { data, error } = await supabase.functions.invoke('attach-employee-document', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${label} uploaded successfully`
      });

      setFile(null);
      if (onUploadComplete) onUploadComplete();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: `Failed to upload ${label}`,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentFile) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: {
          bucket: 'documents',
          path: currentFile
        }
      });

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      
      {currentFile && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded">
          <FileText className="h-4 w-4" />
          <span className="text-sm flex-1 truncate">
            {currentFile.split('/').pop()}
          </span>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileChange}
          className="flex-1"
        />
        <Button 
          onClick={handleUpload} 
          disabled={!file || uploading}
          size="sm"
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default DocumentUpload;