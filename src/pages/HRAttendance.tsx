import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  Play, 
  Eye,
  Calendar,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

interface AttendanceUpload {
  date: string;
  emp_code: string;
  first_swipe?: string;
  last_swipe?: string;
  device_id?: string;
  location?: string;
}

interface AttendanceStatus {
  id: string;
  date: string;
  employee_id: string;
  status: 'P' | 'A' | 'HD' | 'L' | 'OD' | 'WFH';
  work_hours: number;
  source: 'device' | 'leave' | 'override' | 'none';
  remarks?: string;
  employees: {
    first_name: string;
    last_name: string;
    emp_code: string;
    department?: string;
  };
}

const HRAttendance = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [previewData, setPreviewData] = useState<AttendanceUpload[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Process State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [processing, setProcessing] = useState(false);

  // Table State
  const [attendanceData, setAttendanceData] = useState<AttendanceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('30');

  useEffect(() => {
    // Set default date range (last 31 days)
    const today = new Date();
    const thirtyOneDaysAgo = new Date(today);
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    
    setStartDate(thirtyOneDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);

    fetchAttendanceStatus();
  }, []);

  const fetchAttendanceStatus = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - parseInt(dateRangeFilter));

      let query = supabase
        .from('attendance_status')
        .select(`
          *,
          employees:employee_id(first_name, last_name, emp_code, department)
        `)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'P' | 'A' | 'HD' | 'L' | 'OD' | 'WFH');
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (departmentFilter !== 'all') {
        filteredData = filteredData.filter(item => 
          item.employees?.department === departmentFilter
        );
      }

      setAttendanceData(filteredData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch attendance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const parseCsv = (text: string): AttendanceUpload[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data: AttendanceUpload[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === 0 || !values.some(v => v)) continue;

      const row: AttendanceUpload = {
        date: '',
        emp_code: ''
      };

      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        if (header.includes('date')) {
          row.date = value;
        } else if (header.includes('emp') || header.includes('code')) {
          row.emp_code = value;
        } else if (header.includes('first') || header.includes('in')) {
          row.first_swipe = value || undefined;
        } else if (header.includes('last') || header.includes('out')) {
          row.last_swipe = value || undefined;
        } else if (header.includes('device')) {
          row.device_id = value || undefined;
        } else if (header.includes('location')) {
          row.location = value || undefined;
        }
      });

      if (row.date && row.emp_code) {
        data.push(row);
      }
    }

    return data;
  };

  const handleCsvPreview = () => {
    if (!csvText.trim()) {
      toast({
        title: 'Error',
        description: 'Please paste CSV data first',
        variant: 'destructive',
      });
      return;
    }

    try {
      const parsed = parseCsv(csvText);
      setPreviewData(parsed.slice(0, 10)); // Show first 10 rows
      setPreviewOpen(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to parse CSV data. Please check the format.',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      handleCsvPreview();
    };
    reader.readAsText(file);
  };

  const importCsvData = async () => {
    try {
      setImporting(true);
      const fullData = parseCsv(csvText);
      
      if (fullData.length === 0) {
        throw new Error('No valid data to import');
      }

      const { error } = await supabase
        .from('attendance_upload')
        .insert(fullData);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Imported ${fullData.length} rows to attendance_upload`,
      });

      setCsvText('');
      setPreviewData([]);
      setPreviewOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import CSV data',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const processAttendance = async () => {
    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('attendance-process', {
        body: { start_date: startDate, end_date: endDate }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Processing Complete!',
          description: data.message,
        });

        // Show unmatched emp codes if any
        if (data.unmatched_emp_codes && data.unmatched_emp_codes.length > 0) {
          setTimeout(() => {
            toast({
              title: 'Unmatched Employee Codes',
              description: `${data.unmatched_emp_codes.join(', ')} - Please verify these codes`,
              variant: 'destructive',
            });
          }, 1000);
        }

        fetchAttendanceStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process attendance',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'P': 'default',
      'A': 'destructive',
      'HD': 'secondary',
      'L': 'outline',
      'OD': 'secondary',
      'WFH': 'secondary'
    };

    const labels: Record<string, string> = {
      'P': 'Present',
      'A': 'Absent',
      'HD': 'Half Day',
      'L': 'Leave',
      'OD': 'On Duty',
      'WFH': 'Work From Home'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const scrollToTable = () => {
    document.getElementById('attendance-table')?.scrollIntoView({ 
      behavior: 'smooth' 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <Button variant="outline" onClick={fetchAttendanceStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Card 1: Biometric Paste/Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Biometric Data Import
          </CardTitle>
          <CardDescription>
            Import attendance data from CSV format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-text">
              Paste CSV Data (Date, EmpCode, FirstSwipe, LastSwipe, DeviceID, Location)
            </Label>
            <Textarea
              id="csv-text"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="2024-01-15,WM0001,2024-01-15 09:15:00,2024-01-15 18:30:00,DEV001,HYD"
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Supported date formats: yyyy-mm-dd; times: yyyy-mm-dd hh:mm
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleCsvPreview} disabled={!csvText.trim()}>
              <FileText className="h-4 w-4 mr-2" />
              Preview & Import
            </Button>
            
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV File
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Process Attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Process Attendance
          </CardTitle>
          <CardDescription>
            Convert uploaded biometric data to attendance status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={processAttendance}
              disabled={processing}
              size="lg"
            >
              {processing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Process Now
            </Button>

            <Button variant="outline" onClick={scrollToTable}>
              <Eye className="h-4 w-4 mr-2" />
              View Latest Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Attendance Status Table */}
      <Card id="attendance-table">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Status (Last 30 days)
          </CardTitle>
          <CardDescription>
            Processed attendance records with filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Label>Filters:</Label>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="P">Present</SelectItem>
                <SelectItem value="A">Absent</SelectItem>
                <SelectItem value="HD">Half Day</SelectItem>
                <SelectItem value="L">Leave</SelectItem>
                <SelectItem value="WFH">Work From Home</SelectItem>
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="Events">Events</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Administration">Administration</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="15">Last 15 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchAttendanceStatus}>
              Apply Filters
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading attendance data...</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Work Hours</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No attendance records found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {record.employees?.first_name} {record.employees?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {record.employees?.emp_code} • {record.employees?.department}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(record.status)}
                        </TableCell>
                        <TableCell>
                          {record.work_hours?.toFixed(1) || '0.0'} hrs
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {record.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSV Preview</DialogTitle>
            <DialogDescription>
              Showing first 10 rows. Total parsed: {parseCsv(csvText).length} rows
            </DialogDescription>
          </DialogHeader>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Emp Code</TableHead>
                  <TableHead>First Swipe</TableHead>
                  <TableHead>Last Swipe</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.emp_code}</TableCell>
                    <TableCell>{row.first_swipe || '-'}</TableCell>
                    <TableCell>{row.last_swipe || '-'}</TableCell>
                    <TableCell>{row.device_id || '-'}</TableCell>
                    <TableCell>{row.location || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={importCsvData} disabled={importing}>
              {importing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Import {parseCsv(csvText).length} Rows
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRAttendance;