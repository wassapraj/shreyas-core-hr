import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Eye, 
  Trash2,
  Package,
  Calendar,
  Monitor
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Asset {
  id: string;
  asset_code: string;
  type: string;
  model: string;
  serial: string;
  purchase_date: string;
  warranty_till: string;
  status: string;
  created_at: string;
}

const HRAssets = () => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState({
    asset_code: '',
    type: '',
    model: '',
    serial: '',
    purchase_date: '',
    warranty_till: ''
  });

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load assets"
      });
    } finally {
      setLoading(false);
    }
  };

  const createAsset = async () => {
    if (!assetForm.asset_code || !assetForm.type) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Asset code and type are required"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('assets')
        .insert({
          ...assetForm,
          status: 'InUse'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Asset created successfully"
      });

      setCreateModalOpen(false);
      setAssetForm({
        asset_code: '',
        type: '',
        model: '',
        serial: '',
        purchase_date: '',
        warranty_till: ''
      });
      loadAssets();
    } catch (error: any) {
      console.error('Error creating asset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create asset"
      });
    }
  };

  const updateAsset = async () => {
    if (!selectedAsset || !assetForm.asset_code || !assetForm.type) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Asset code and type are required"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('assets')
        .update(assetForm)
        .eq('id', selectedAsset.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Asset updated successfully"
      });

      setEditModalOpen(false);
      setSelectedAsset(null);
      loadAssets();
    } catch (error: any) {
      console.error('Error updating asset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update asset"
      });
    }
  };

  const retireAsset = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ status: 'Retired' })
        .eq('id', assetId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Asset retired successfully"
      });

      loadAssets();
    } catch (error: any) {
      console.error('Error retiring asset:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to retire asset"
      });
    }
  };

  const openEditModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssetForm({
      asset_code: asset.asset_code,
      type: asset.type,
      model: asset.model || '',
      serial: asset.serial || '',
      purchase_date: asset.purchase_date || '',
      warranty_till: asset.warranty_till || ''
    });
    setEditModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'InUse': 'default',
      'Available': 'secondary',
      'UnderMaintenance': 'outline',
      'Retired': 'destructive'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const statusCounts = {
    InUse: assets.filter(a => a.status === 'InUse').length,
    Available: assets.filter(a => a.status === 'Available').length,
    UnderMaintenance: assets.filter(a => a.status === 'UnderMaintenance').length,
    Retired: assets.filter(a => a.status === 'Retired').length
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold gradient-text">Assets Management</h1>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold gradient-text">Assets Management</h1>
        
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
              <DialogDescription>
                Create a new asset record for tracking and assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset_code">Asset Code *</Label>
                  <Input
                    id="asset_code"
                    placeholder="e.g., LAP-001"
                    value={assetForm.asset_code}
                    onChange={(e) => setAssetForm({ ...assetForm, asset_code: e.target.value })}
                    className="form-modern"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                    <SelectTrigger className="form-modern">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laptop">Laptop</SelectItem>
                      <SelectItem value="Desktop">Desktop</SelectItem>
                      <SelectItem value="Monitor">Monitor</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="Tablet">Tablet</SelectItem>
                      <SelectItem value="Printer">Printer</SelectItem>
                      <SelectItem value="Projector">Projector</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    placeholder="e.g., Dell Latitude 7420"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                    className="form-modern"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number</Label>
                  <Input
                    id="serial"
                    placeholder="Serial number"
                    value={assetForm.serial}
                    onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })}
                    className="form-modern"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={assetForm.purchase_date}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                    className="form-modern"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="warranty_till">Warranty Till</Label>
                  <Input
                    id="warranty_till"
                    type="date"
                    value={assetForm.warranty_till}
                    onChange={(e) => setAssetForm({ ...assetForm, warranty_till: e.target.value })}
                    className="form-modern"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createAsset}>Create Asset</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Monitor className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">In Use</p>
                <p className="text-2xl font-bold">{statusCounts.InUse}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold">{statusCounts.Available}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Maintenance</p>
                <p className="text-2xl font-bold">{statusCounts.UnderMaintenance}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Trash2 className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Retired</p>
                <p className="text-2xl font-bold">{statusCounts.Retired}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Assets Inventory</CardTitle>
          <CardDescription>
            Manage all company assets and their assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No assets found. Add your first asset to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{asset.asset_code}</h3>
                      {getStatusBadge(asset.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {asset.type} {asset.model && `• ${asset.model}`}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {asset.serial && <span>S/N: {asset.serial}</span>}
                      {asset.purchase_date && (
                        <span>Purchased: {new Date(asset.purchase_date).toLocaleDateString()}</span>
                      )}
                      {asset.warranty_till && (
                        <span>Warranty: {new Date(asset.warranty_till).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link to={`/hr/assets/${asset.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(asset)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    
                    {asset.status !== 'Retired' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retireAsset(asset.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Retire
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Asset Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update asset information and details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_asset_code">Asset Code *</Label>
                <Input
                  id="edit_asset_code"
                  placeholder="e.g., LAP-001"
                  value={assetForm.asset_code}
                  onChange={(e) => setAssetForm({ ...assetForm, asset_code: e.target.value })}
                  className="form-modern"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_type">Type *</Label>
                <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                  <SelectTrigger className="form-modern">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Laptop">Laptop</SelectItem>
                    <SelectItem value="Desktop">Desktop</SelectItem>
                    <SelectItem value="Monitor">Monitor</SelectItem>
                    <SelectItem value="Phone">Phone</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                    <SelectItem value="Printer">Printer</SelectItem>
                    <SelectItem value="Projector">Projector</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_model">Model</Label>
                <Input
                  id="edit_model"
                  placeholder="e.g., Dell Latitude 7420"
                  value={assetForm.model}
                  onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  className="form-modern"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_serial">Serial Number</Label>
                <Input
                  id="edit_serial"
                  placeholder="Serial number"
                  value={assetForm.serial}
                  onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })}
                  className="form-modern"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_purchase_date">Purchase Date</Label>
                <Input
                  id="edit_purchase_date"
                  type="date"
                  value={assetForm.purchase_date}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                  className="form-modern"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_warranty_till">Warranty Till</Label>
                <Input
                  id="edit_warranty_till"
                  type="date"
                  value={assetForm.warranty_till}
                  onChange={(e) => setAssetForm({ ...assetForm, warranty_till: e.target.value })}
                  className="form-modern"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateAsset}>Update Asset</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRAssets;