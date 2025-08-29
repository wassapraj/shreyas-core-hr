import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Send, 
  FileText, 
  Users, 
  Copy, 
  Eye,
  Calendar,
  Mail,
  Phone,
  MapPin,
  DollarSign
} from 'lucide-react';

interface Offer {
  id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  job_title: string;
  dept?: string;
  location?: string;
  ctc?: string;
  joining_date?: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn';
  offer_html?: string;
  public_token?: string;
  signed_at?: string;
  created_at: string;
}

const HROffers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewOfferDialog, setShowNewOfferDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [formData, setFormData] = useState({
    candidate_name: '',
    candidate_email: '',
    candidate_phone: '',
    job_title: '',
    dept: '',
    location: '',
    ctc: '',
    joining_date: '',
    remarks: ''
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch offers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      candidate_name: '',
      candidate_email: '',
      candidate_phone: '',
      job_title: '',
      dept: '',
      location: '',
      ctc: '',
      joining_date: '',
      remarks: ''
    });
  };

  const createOffer = async () => {
    try {
      if (!formData.candidate_name || !formData.candidate_email || !formData.job_title) {
        toast({
          title: 'Validation Error',
          description: 'Candidate name, email, and job title are required',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('offers')
        .insert({
          ...formData,
          recruiter_user_id: user?.id,
          joining_date: formData.joining_date || null
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Offer created successfully',
      });

      setShowNewOfferDialog(false);
      resetForm();
      fetchOffers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create offer',
        variant: 'destructive',
      });
    }
  };

  const generateOfferLetter = async (offer: Offer) => {
    try {
      const { data, error } = await supabase.functions.invoke('offer-generate-html', {
        body: {
          candidate_name: offer.candidate_name,
          job_title: offer.job_title,
          dept: offer.dept,
          ctc: offer.ctc,
          joining_date: offer.joining_date,
          location: offer.location,
          offer_id: offer.id
        }
      });

      if (error) throw error;

      if (data.success) {
        setPreviewHtml(data.html);
        setShowPreviewDialog(true);
        fetchOffers(); // Refresh to get updated offer_html
        toast({
          title: 'Success',
          description: 'Offer letter generated successfully',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate offer letter',
        variant: 'destructive',
      });
    }
  };

  const issueOffer = async (offer: Offer) => {
    try {
      if (!offer.offer_html) {
        toast({
          title: 'Error',
          description: 'Please generate the offer letter first',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('offer-issue', {
        body: { offer_id: offer.id }
      });

      if (error) throw error;

      if (data.success) {
        // Copy link to clipboard
        await navigator.clipboard.writeText(data.public_link);
        
        toast({
          title: 'Offer Sent!',
          description: 'Public link copied to clipboard. Share it with the candidate.',
        });

        fetchOffers();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to issue offer',
        variant: 'destructive',
      });
    }
  };

  const convertToEmployee = async (offer: Offer) => {
    try {
      const { data, error } = await supabase.functions.invoke('convert-to-employee', {
        body: { offer_id: offer.id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Success!',
          description: data.message,
        });

        fetchOffers();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to convert to employee',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'Draft': 'secondary',
      'Sent': 'outline',
      'Accepted': 'default',
      'Declined': 'destructive',
      'Withdrawn': 'secondary'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const filteredOffers = offers.filter(offer => 
    statusFilter === 'all' || offer.status === statusFilter
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Offers Management</h1>
        <Dialog open={showNewOfferDialog} onOpenChange={setShowNewOfferDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Offer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Offer</DialogTitle>
              <DialogDescription>
                Fill in the candidate details and position information
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidate_name">Candidate Name *</Label>
                <Input
                  id="candidate_name"
                  value={formData.candidate_name}
                  onChange={(e) => handleInputChange('candidate_name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate_email">Email *</Label>
                <Input
                  id="candidate_email"
                  type="email"
                  value={formData.candidate_email}
                  onChange={(e) => handleInputChange('candidate_email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate_phone">Phone</Label>
                <Input
                  id="candidate_phone"
                  value={formData.candidate_phone}
                  onChange={(e) => handleInputChange('candidate_phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => handleInputChange('job_title', e.target.value)}
                  placeholder="Position title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept">Department</Label>
                <Input
                  id="dept"
                  value={formData.dept}
                  onChange={(e) => handleInputChange('dept', e.target.value)}
                  placeholder="Department"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Work location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctc">CTC</Label>
                <Input
                  id="ctc"
                  value={formData.ctc}
                  onChange={(e) => handleInputChange('ctc', e.target.value)}
                  placeholder="e.g., 7.2 LPA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joining_date">Joining Date</Label>
                <Input
                  id="joining_date"
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => handleInputChange('joining_date', e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowNewOfferDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createOffer}>
                Create Offer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Offers</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Accepted">Accepted</SelectItem>
            <SelectItem value="Declined">Declined</SelectItem>
            <SelectItem value="Withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchOffers}>
          Refresh
        </Button>
      </div>

      {/* Offers List */}
      <div className="grid gap-4">
        {filteredOffers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No offers found</h3>
              <p className="text-muted-foreground">
                {statusFilter === 'all' 
                  ? 'Create your first job offer to get started.'
                  : `No offers with status "${statusFilter}".`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOffers.map((offer) => (
            <Card key={offer.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{offer.candidate_name}</CardTitle>
                    <CardDescription>{offer.job_title}</CardDescription>
                  </div>
                  {getStatusBadge(offer.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {offer.candidate_email}
                  </div>
                  {offer.candidate_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {offer.candidate_phone}
                    </div>
                  )}
                  {offer.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {offer.location}
                    </div>
                  )}
                  {offer.ctc && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {offer.ctc}
                    </div>
                  )}
                  {offer.joining_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(offer.joining_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {offer.status === 'Draft' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateOfferLetter(offer)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Letter
                      </Button>
                      {offer.offer_html && (
                        <Button
                          size="sm"
                          onClick={() => issueOffer(offer)}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send Offer
                        </Button>
                      )}
                    </>
                  )}

                  {offer.status === 'Sent' && offer.public_token && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const link = `${window.location.origin}/offer/${offer.public_token}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: 'Link copied to clipboard' });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                  )}

                  {offer.status === 'Accepted' && (
                    <Button
                      size="sm"
                      onClick={() => convertToEmployee(offer)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Convert to Employee
                    </Button>
                  )}

                  {offer.offer_html && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewHtml(offer.offer_html!);
                        setShowPreviewDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  )}
                </div>

                {offer.signed_at && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {offer.status === 'Accepted' ? 'Accepted' : 'Declined'} on{' '}
                    {new Date(offer.signed_at).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Offer Letter Preview</DialogTitle>
          </DialogHeader>
          <div
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HROffers;