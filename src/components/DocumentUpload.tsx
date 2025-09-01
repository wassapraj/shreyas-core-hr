import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, Trash2, File, AlertCircle } from 'lucide-react';

interface DocumentUploadProps {
  employee: any;
  isHR: boolean;
  onDocumentUpdate: () => void;
}

interface DocumentItem {
  id: string;
  title: string;
  file_path?: string;
  s3_key?: string;
  content_type?: string;
  size?: number;
  created_at: string;
  employee_id?: string;
  signed_url?: string;
  updated_at?: string;
}

const documentTypes = [
  { key: 'aadhaar', label: 'Aadhaar Card', field: 'aadhaar_key' },
  { key: 'pan', label: 'PAN Card', field: 'pan_key' },
  { key: 'qualification', label: 'Qualification Certificate', field: 'qualification_key' },
  { key: 'photo', label: 'Profile Photo', field: 'photo_key' },
  { key: 'passport_photo', label: 'Passport Size Photo', field: 'passport_photo_key' },
  { key: 'regular_photo', label: 'Regular Photo', field: 'regular_photo_key' }
];

export const DocumentUpload = ({ employee, isHR, onDocumentUpdate }: DocumentUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [otherDocs, setOtherDocs] = useState<DocumentItem[]>([]);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  React.useEffect(() => {
    fetchOtherDocuments();
  }, [employee.id]);

  const fetchOtherDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOtherDocs(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileUpload = async (file: File, kind: string) => {
    if (!file) return;

    setUploading(kind);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });

      const base64Data = (reader.result as string).split(',')[1];

      const { data, error } = await supabase.functions.invoke('upload-employee-document', {
        body: {
          employeeId: employee.id,
          documentKind: kind,
          fileName: file.name,
          fileData: base64Data,
          contentType: file.type
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${kind} uploaded successfully`
      });

      onDocumentUpdate();
      if (kind === 'other') {
        fetchOtherDocuments();
        setUploaderOpen(false);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: `Failed to upload ${kind}`,
        variant: 'destructive'
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (s3Key: string, filename: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: { 
          key: s3Key,
          bucket: 'documents'
        }
      });

      if (error) throw error;

      // Open the signed URL in a new tab
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive'
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Standard Documents */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Standard Documents</h3>
          {documentTypes.map(docType => {
            const hasDocument = employee[docType.field];
            const isUploading = uploading === docType.key;

            return (
              <Card key={docType.key}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">{docType.label}</Label>
                      {hasDocument ? (
                        <Badge variant="secondary" className="ml-2">
                          Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-2">
                          Not uploaded
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {hasDocument && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(employee[docType.field], `${docType.label}.pdf`)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                      {isHR && (
                        <div className="relative">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, docType.key);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isUploading}
                          />
                          <Button size="sm" disabled={isUploading}>
                            <Upload className="w-4 h-4 mr-1" />
                            {isUploading ? 'Uploading...' : hasDocument ? 'Replace' : 'Upload'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Right Column - Other Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Other Documents</h3>
            {isHR && (
              <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Select File</Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'other');
                        }}
                        disabled={uploading === 'other'}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {otherDocs.length > 0 ? (
            <div className="space-y-3">
              {otherDocs.map(doc => (
                <Card key={doc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <File className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(doc.size)} • {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(doc.s3_key, doc.title)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {isHR && (
                          <Button size="sm" variant="destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No additional documents uploaded</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};