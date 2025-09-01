import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Download, Trash2, FileText, Loader2, Upload } from 'lucide-react';

interface OtherDocumentsProps {
  employeeId: string;
}

const OtherDocuments: React.FC<OtherDocumentsProps> = ({ employeeId }) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    file: null as File | null
  });

  useEffect(() => {
    loadDocuments();
  }, [employeeId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('employee_id', employeeId);
      formData.append('kind', 'other');
      formData.append('title', uploadForm.title);
      formData.append('filename', uploadForm.file.name);

      const { data, error } = await supabase.functions.invoke('attach-employee-document', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document uploaded successfully'
      });

      setUploadForm({ title: '', file: null });
      setShowUpload(false);
      loadDocuments();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: {
          key: document.file_path || document.s3_key
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
        description: 'Failed to download document',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document deleted successfully'
      });

      loadDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Other Documents</h4>
        <Button onClick={() => setShowUpload(true)} size="sm">
          <Plus className="h-3 w-3 mr-1" />
          Add Document
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          No additional documents uploaded
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 border rounded">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-sm">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(doc.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document Title</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter document title"
              />
            </div>
            <div>
              <Label>File</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleUpload} 
                disabled={!uploadForm.file || !uploadForm.title || uploading}
                className="flex-1"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload
              </Button>
              <Button variant="outline" onClick={() => setShowUpload(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OtherDocuments;