import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Upload, Download, Copy, Play, Check, AlertTriangle, Users, FileText, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

interface PreviewResult {
  ok: boolean;
  columns: string[];
  sample: any[];
  counts: {
    total: number;
    create: number;
    update: number;
    invalid: number;
  };
  errors: ValidationError[];
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  generated_codes: Array<{email: string, emp_code: string}>;
  warnings: string[];
}

const SAMPLE_HEADERS = [
  'emp_code', 'first_name', 'last_name', 'email', 'phone', 'department', 'designation', 
  'doj', 'location', 'status', 'monthly_ctc', 'aadhaar_number', 'pan_number'
];

export default function EmployeesImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [csvText, setCsvText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState(',');
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Import settings
  const [autoPrefix, setAutoPrefix] = useState('SM');
  const [startNumber, setStartNumber] = useState<number | undefined>();
  const [dryRun, setDryRun] = useState(true);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvText(content);
      };
      reader.readAsText(file);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = [
      SAMPLE_HEADERS.join(','),
      'SM-0001,John,Doe,john.doe@company.com,9876543210,Digital,Software Engineer,2024-01-15,Bangalore,Active,600000,123456789012,ABCDE1234F',
      'SM-0002,Jane,Smith,jane.smith@company.com,9876543211,Finance,Accountant,2024-01-20,Mumbai,Active,450000,123456789013,ABCDE1235F'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!csvText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide CSV content to preview'
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('employees-import-preview', {
        body: { csvText, delimiter }
      });

      if (error) {
        throw error;
      }

      setPreviewResult(data);
      setImportResult(null);

      if (data.ok) {
        toast({
          title: 'Preview Generated',
          description: `Found ${data.counts.total} rows: ${data.counts.create} new, ${data.counts.update} updates`
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Preview Failed',
          description: data.error
        });
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate preview'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (isDryRun: boolean = true) => {
    if (!csvText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide CSV content to import'
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('employees-import-commit', {
        body: {
          csvText,
          autoPrefix,
          startNumber,
          dryRun: isDryRun
        }
      });

      if (error) {
        throw error;
      }

      setImportResult(data);

      const action = isDryRun ? 'simulated' : 'completed';
      toast({
        title: `Import ${action}`,
        description: `Created: ${data.created}, Updated: ${data.updated}, Skipped: ${data.skipped}`
      });

      if (!isDryRun) {
        setDryRun(true); // Reset to dry run for safety
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error.message || 'An unexpected error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyErrors = () => {
    if (!previewResult?.errors.length) return;
    
    const errorsText = previewResult.errors
      .map(err => `Row ${err.rowIndex}: ${err.field} - ${err.message}`)
      .join('\n');
    
    navigator.clipboard.writeText(errorsText);
    toast({
      title: 'Copied',
      description: 'Errors copied to clipboard'
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/hr/employees')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Import Employees</h1>
          <p className="text-muted-foreground">Upload and validate employee data from CSV files</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Upload CSV Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Upload File</label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Delimiter</label>
                <Select value={delimiter} onValueChange={setDelimiter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="\t">Tab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Or Paste CSV Content</label>
              <Textarea
                placeholder="Paste your CSV content here..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handlePreview} disabled={loading}>
                <FileText className="w-4 h-4 mr-2" />
                {loading ? 'Processing...' : 'Preview'}
              </Button>
              
              <Button variant="outline" onClick={downloadSampleCSV}>
                <Download className="w-4 h-4 mr-2" />
                Download Sample CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Validation Results Card */}
        {previewResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Validation Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Count Chips */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Total: {previewResult.counts.total}
                </Badge>
                <Badge variant="default" className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Create: {previewResult.counts.create}
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Settings className="w-3 h-3" />
                  Update: {previewResult.counts.update}
                </Badge>
                {previewResult.counts.invalid > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Invalid: {previewResult.counts.invalid}
                  </Badge>
                )}
              </div>

              {/* Errors Table */}
              {previewResult.errors.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-destructive">Validation Errors</h4>
                    <Button size="sm" variant="outline" onClick={copyErrors}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Errors
                    </Button>
                  </div>
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResult.errors.slice(0, 50).map((error, index) => (
                          <TableRow key={index}>
                            <TableCell>{error.rowIndex}</TableCell>
                            <TableCell className="font-medium">{error.field}</TableCell>
                            <TableCell>{error.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {previewResult.errors.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Showing first 50 of {previewResult.errors.length} errors
                    </p>
                  )}
                </div>
              )}

              {/* Sample Data Preview */}
              {previewResult.sample.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Sample Data (First 10 Rows)</h4>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Intent</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Emp Code</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResult.sample.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant={row._intent === 'create' ? 'default' : 'secondary'}>
                                {row._intent}
                              </Badge>
                            </TableCell>
                            <TableCell>{row.email}</TableCell>
                            <TableCell>{row.first_name} {row.last_name}</TableCell>
                            <TableCell>
                              {row.emp_code || <span className="text-muted-foreground">Auto-generate</span>}
                            </TableCell>
                            <TableCell>{row.department}</TableCell>
                            <TableCell>{row.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Import Settings Card */}
        {previewResult?.ok && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Import Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Auto Emp Code Prefix</label>
                  <Input
                    value={autoPrefix}
                    onChange={(e) => setAutoPrefix(e.target.value)}
                    placeholder="SM"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Number</label>
                  <Input
                    type="number"
                    value={startNumber || ''}
                    onChange={(e) => setStartNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto-detect"
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="dry-run"
                    checked={dryRun}
                    onCheckedChange={(checked) => setDryRun(checked === true)}
                  />
                  <label htmlFor="dry-run" className="text-sm font-medium">
                    Dry Run (Preview Only)
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => handleImport(true)}
                  disabled={loading || previewResult.counts.invalid > 0}
                  variant="outline"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {loading ? 'Running...' : 'Run Dry Import'}
                </Button>
                
                <Button
                  onClick={() => handleImport(false)}
                  disabled={loading || dryRun || previewResult.counts.invalid > 0}
                  variant="default"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Commit Import
                </Button>
              </div>

              {previewResult.counts.invalid > 0 && (
                <div className="text-sm text-destructive">
                  ⚠️ Cannot import while validation errors exist. Please fix the errors first.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Import Results Card */}
        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                  <div className="text-sm text-muted-foreground">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
              </div>

              {importResult.generated_codes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Generated Employee Codes</h4>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {importResult.generated_codes.map((item, index) => (
                      <div key={index} className="text-sm">
                        <strong>{item.emp_code}</strong> → {item.email}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-yellow-600">Warnings</h4>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {importResult.warnings.map((warning, index) => (
                      <div key={index} className="text-sm text-yellow-700">{warning}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}