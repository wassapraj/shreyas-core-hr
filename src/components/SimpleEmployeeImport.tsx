import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SimpleEmployeeImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
  result?: {
    created: number;
    updated: number;
    errors: string[];
  };
}

export const SimpleEmployeeImport = ({ isOpen, onClose, onSuccess }: SimpleEmployeeImportProps) => {
  const { toast } = useToast();
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  const processFile = async (file: File) => {
    setUploadState({
      status: 'uploading',
      progress: 25,
      message: 'Reading file...'
    });

    try {
      // Convert file to base64 for reliable serialization
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      setUploadState({
        status: 'processing',
        progress: 50,
        message: 'Processing employee data...'
      });

      // Call the simple import function
      const { data, error } = await supabase.functions.invoke('simple-employee-import', {
        body: { 
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64
        }
      });

      if (error) throw error;

      setUploadState({
        status: 'success',
        progress: 100,
        message: `Import completed successfully!`,
        result: data
      });

      toast({
        title: 'Import Successful',
        description: `Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors?.length || 0}`
      });

      // Auto-close after success
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error processing file:', error);
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Processing failed'
      });
      
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to process file'
      });
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Check file size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please select a file smaller than 5MB'
      });
      return;
    }

    await processFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: uploadState.status === 'uploading' || uploadState.status === 'processing'
  });

  const handleClose = () => {
    setUploadState({ status: 'idle', progress: 0, message: '' });
    onClose();
  };

  const getStatusIcon = () => {
    switch (uploadState.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-8 h-8 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Upload className="w-8 h-8 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Employees</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {uploadState.status === 'idle' && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg">Drop the file here...</p>
              ) : (
                <>
                  <p className="text-lg mb-2">Drop CSV or Excel file here</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Or click to select file
                  </p>
                  <Button variant="outline" size="sm">
                    Select File
                  </Button>
                </>
              )}
            </div>
          )}

          {uploadState.status !== 'idle' && (
            <div className="text-center space-y-4">
              {getStatusIcon()}
              <div>
                <p className="font-medium">{uploadState.message}</p>
                {uploadState.progress > 0 && (
                  <Progress value={uploadState.progress} className="mt-2" />
                )}
              </div>

              {uploadState.result && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>✅ Created: {uploadState.result.created}</p>
                  <p>🔄 Updated: {uploadState.result.updated}</p>
                  {uploadState.result.errors.length > 0 && (
                    <p>⚠️ Errors: {uploadState.result.errors.length}</p>
                  )}
                </div>
              )}

              {uploadState.status === 'error' && (
                <Button onClick={() => setUploadState({ status: 'idle', progress: 0, message: '' })}>
                  Try Again
                </Button>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Expected CSV columns:</p>
            <p>first_name, last_name, email, phone, department, designation, emp_code, doj, monthly_ctc</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};