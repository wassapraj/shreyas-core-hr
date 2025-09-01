import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploaded' | 'processing' | 'parsed' | 'failed';
  progress: number;
  error?: string;
  parsedData?: any[];
}

interface EmployeeRow {
  id: string;
  emp_code?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  location?: string;
  doj?: string;
  status?: string;
  monthly_ctc?: number;
  isValid: boolean;
  validationErrors: string[];
  shouldSave: boolean;
  isExisting?: boolean;
}

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const departments = [
  'Digital', 'Film Events', 'Utsav Events', 'Corp Events', 
  'Finance', 'Housekeeping', 'Admin/IT', 'Creative', 'Managerial', 'Others'
];

const statusOptions = ['Active', 'Inactive', 'On Hold', 'Terminated'];

export const SmartImportModal = ({ isOpen, onClose, onSuccess }: SmartImportModalProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const validateEmployee = (employee: Partial<EmployeeRow>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!employee.first_name?.trim()) {
      errors.push('First name is required');
    }
    
    if (employee.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
      errors.push('Invalid email format');
    }
    
    if (employee.department && !departments.includes(employee.department)) {
      errors.push('Invalid department');
    }
    
    if (employee.status && !statusOptions.includes(employee.status)) {
      errors.push('Invalid status');
    }
    
    if (employee.doj && !/^\d{4}-\d{2}-\d{2}$/.test(employee.doj)) {
      errors.push('Date of joining must be in YYYY-MM-DD format');
    }

    return { isValid: errors.length === 0, errors };
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploaded',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Process each file
    for (const uploadedFile of newFiles) {
      try {
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadedFile.id ? { ...f, status: 'processing', progress: 25 } : f
        ));

        // Upload to S3 and parse
        const { data, error } = await supabase.functions.invoke('employee-import-process', {
          body: { 
            fileName: uploadedFile.file.name,
            fileType: uploadedFile.file.type,
            fileSize: uploadedFile.file.size,
            fileData: await uploadedFile.file.arrayBuffer()
          }
        });

        if (error) throw error;

        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadedFile.id ? { 
            ...f, 
            status: 'parsed', 
            progress: 100,
            parsedData: data.employees 
          } : f
        ));

        // Add parsed data to employee rows
        if (data.employees?.length > 0) {
          const newRows: EmployeeRow[] = data.employees.map((emp: any) => {
            const validation = validateEmployee(emp);
            return {
              id: crypto.randomUUID(),
              ...emp,
              isValid: validation.isValid,
              validationErrors: validation.errors,
              shouldSave: validation.isValid
            };
          });
          
          setEmployeeRows(prev => [...prev, ...newRows]);
        }

      } catch (error) {
        console.error('Error processing file:', error);
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadedFile.id ? { 
            ...f, 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Processing failed'
          } : f
        ));
      }
    }

    // Switch to review tab when files are processed
    if (newFiles.length > 0) {
      setTimeout(() => setActiveTab('review'), 1000);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    multiple: true
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setEmployeeRows(prev => prev.filter(row => !uploadedFiles.find(f => f.id === fileId)?.parsedData?.some((d: any) => d.id === row.id)));
  };

  const updateEmployeeRow = (rowId: string, updates: Partial<EmployeeRow>) => {
    setEmployeeRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const updated = { ...row, ...updates };
        const validation = validateEmployee(updated);
        return {
          ...updated,
          isValid: validation.isValid,
          validationErrors: validation.errors
        };
      }
      return row;
    }));
  };

  const toggleRowSave = (rowId: string) => {
    setEmployeeRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, shouldSave: !row.shouldSave } : row
    ));
  };

  const saveAllEmployees = async () => {
    const rowsToSave = employeeRows.filter(row => row.shouldSave && row.isValid);
    
    if (rowsToSave.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to Save',
        description: 'No valid rows selected for saving.'
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('employee-import-save', {
        body: { employees: rowsToSave }
      });

      if (error) throw error;

      toast({
        title: 'Import Successful',
        description: `Created: ${data.created}, Updated: ${data.updated}, Skipped: ${data.skipped}`
      });

      onSuccess();
      onClose();
      
    } catch (error) {
      console.error('Error saving employees:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save employees'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setUploadedFiles([]);
    setEmployeeRows([]);
    setActiveTab('upload');
    onClose();
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploaded':
        return <Upload className="w-4 h-4 text-blue-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'parsed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import Employees</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
            <TabsTrigger value="review" disabled={employeeRows.length === 0}>
              Review & Save ({employeeRows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="flex-1 space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg">Drop the files here...</p>
              ) : (
                <>
                  <p className="text-lg mb-2">Drag & drop files here, or click to select</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supports CSV, XLSX, XLS, PDF, DOCX, JPG, PNG
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Tip:</strong> You can drop resumes (PDF/DOCX/JPG/PNG) or spreadsheets (CSV/XLSX). 
                    The system will parse and prefill employee data using AI. You can review before saving.
                  </p>
                </>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Processing Files</h3>
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {getStatusIcon(file.status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{file.file.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={file.progress} className="flex-1 h-2" />
                        <Badge variant={
                          file.status === 'parsed' ? 'default' :
                          file.status === 'failed' ? 'destructive' :
                          'secondary'
                        }>
                          {file.status}
                        </Badge>
                      </div>
                      {file.error && (
                        <p className="text-sm text-destructive mt-1">{file.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="review" className="flex-1 overflow-hidden">
            {employeeRows.length > 0 && (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {employeeRows.filter(r => r.shouldSave).length} of {employeeRows.length} selected
                    </span>
                    <Badge variant={employeeRows.filter(r => !r.isValid).length > 0 ? 'destructive' : 'default'}>
                      {employeeRows.filter(r => r.isValid).length} valid, {employeeRows.filter(r => !r.isValid).length} invalid
                    </Badge>
                  </div>
                  <Button onClick={saveAllEmployees} disabled={isSaving || employeeRows.filter(r => r.shouldSave && r.isValid).length === 0}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save All ({employeeRows.filter(r => r.shouldSave && r.isValid).length})
                  </Button>
                </div>

                <div className="flex-1 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Save</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Emp Code</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>DOJ</TableHead>
                        <TableHead>Monthly CTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeRows.map((row) => (
                        <TableRow key={row.id} className={!row.isValid ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={row.shouldSave}
                              onCheckedChange={() => toggleRowSave(row.id)}
                              disabled={!row.isValid}
                            />
                          </TableCell>
                          <TableCell>
                            {row.isValid ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <div 
                                className="w-4 h-4 text-red-500 relative group" 
                                title={row.validationErrors.join(', ')}
                              >
                                <AlertCircle className="w-4 h-4" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.emp_code || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { emp_code: e.target.value })}
                              placeholder="Auto-generated"
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.first_name}
                              onChange={(e) => updateEmployeeRow(row.id, { first_name: e.target.value })}
                              className="w-32"
                              required
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.last_name || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { last_name: e.target.value })}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.email || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { email: e.target.value })}
                              type="email"
                              className="w-40"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.phone || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { phone: e.target.value })}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.department || ''}
                              onValueChange={(value) => updateEmployeeRow(row.id, { department: value })}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {departments.map(dept => (
                                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.designation || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { designation: e.target.value })}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.doj || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { doj: e.target.value })}
                              type="date"
                              className="w-36"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.monthly_ctc || ''}
                              onChange={(e) => updateEmployeeRow(row.id, { monthly_ctc: parseFloat(e.target.value) || undefined })}
                              type="number"
                              className="w-32"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};