import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  Calendar,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  AlertTriangle
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
  public_token: string;
  signed_at?: string;
  created_at: string;
}

const CandidateOfferView = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (token) {
      fetchOffer();
    }
  }, [token]);

  const fetchOffer = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('public_token', token)
        .single();

      if (error) throw error;
      setOffer(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Offer not found or invalid link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptOffer = async () => {
    try {
      setAccepting(true);
      const { data, error } = await supabase.functions.invoke('offer-accept', {
        body: { public_token: token }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Offer Accepted!',
          description: data.message,
        });
        setOffer(data.offer);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept offer',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const declineOffer = async () => {
    try {
      setDeclining(true);
      const { data, error } = await supabase.functions.invoke('offer-decline', {
        body: { 
          public_token: token,
          reason: declineReason 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Offer Declined',
          description: data.message,
        });
        setOffer(data.offer);
        setShowDeclineDialog(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to decline offer',
        variant: 'destructive',
      });
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading offer...</p>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Offer Not Found</h2>
            <p className="text-muted-foreground">
              The offer link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'Draft': 'secondary',
      'Sent': 'outline',
      'Accepted': 'default',
      'Declined': 'destructive',
      'Withdrawn': 'secondary'
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="text-sm">
        {status}
      </Badge>
    );
  };

  const isActionable = offer.status === 'Sent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/lovable-uploads/55fc8fc5-a89f-4a00-bcb1-ab0c5499703f.png" 
            alt="Shreyas Logo" 
            className="mx-auto mb-4 h-16"
          />
          <h1 className="text-2xl font-bold text-foreground">Shreyas Media</h1>
          <p className="text-muted-foreground">Job Offer Portal</p>
        </div>

        {/* Offer Status */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Job Offer - {offer.job_title}
                </CardTitle>
                <CardDescription>For {offer.candidate_name}</CardDescription>
              </div>
              {getStatusBadge(offer.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Joining: {new Date(offer.joining_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {offer.status === 'Accepted' && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <strong>Offer Accepted!</strong>
              </div>
              <p className="text-green-700 mt-2">
                Thank you for accepting our offer. Our HR team will contact you soon to complete the onboarding process.
              </p>
              {offer.signed_at && (
                <p className="text-sm text-green-600 mt-2">
                  Accepted on {new Date(offer.signed_at).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {offer.status === 'Declined' && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-5 w-5" />
                <strong>Offer Declined</strong>
              </div>
              <p className="text-red-700 mt-2">
                This offer has been declined. Thank you for your time and consideration.
              </p>
              {offer.signed_at && (
                <p className="text-sm text-red-600 mt-2">
                  Declined on {new Date(offer.signed_at).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {offer.status === 'Withdrawn' && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                <strong>Offer Withdrawn</strong>
              </div>
              <p className="text-yellow-700 mt-2">
                This offer has been withdrawn by the company.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Offer Letter */}
        {offer.offer_html && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Offer Letter</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: offer.offer_html }}
              />
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {isActionable && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-lg font-medium">
                  Please review the offer and respond below:
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Button 
                    size="lg"
                    onClick={acceptOffer}
                    disabled={accepting}
                    className="min-w-32"
                  >
                    {accepting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Accept Offer
                  </Button>
                  
                  <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        size="lg"
                        variant="outline"
                        className="min-w-32"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Decline Offer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Decline Offer</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to decline this offer? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="decline_reason">Reason (Optional)</Label>
                          <Textarea
                            id="decline_reason"
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Please let us know why you're declining..."
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowDeclineDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            variant="destructive"
                            onClick={declineOffer}
                            disabled={declining}
                          >
                            {declining ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            ) : null}
                            Decline Offer
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-sm text-muted-foreground">
                  This offer is valid for 7 days from the date of issue.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CandidateOfferView;