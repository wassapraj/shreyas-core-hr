import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Package } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Asset {
  id: string;
  asset_code: string;
  type: string;
  model: string;
  serial: string;
  status: string;
}

interface AddAssetDialogProps {
  employeeId: string;
  onAssetAssigned?: () => void;
}

export default function AddAssetDialog({ employeeId, onAssetAssigned }: AddAssetDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [formData, setFormData] = useState({
    asset_id: "",
    assigned_on: new Date().toISOString().split('T')[0],
    condition: "Good",
    notes: ""
  });

  useEffect(() => {
    if (isOpen) {
      loadAvailableAssets();
    }
  }, [isOpen]);

  const loadAvailableAssets = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .in('status', ['Idle', 'InUse'])
      .order('asset_code');

    if (error) {
      console.error('Error loading assets:', error);
      toast({
        title: "Error",
        description: "Failed to load available assets",
        variant: "destructive"
      });
    } else {
      setAssets(data || []);
    }
  };

  const handleSubmit = async () => {
    if (!formData.asset_id || !formData.assigned_on || !formData.condition) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Create asset assignment
      const { error: assignError } = await supabase
        .from('asset_assignments')
        .insert({
          asset_id: formData.asset_id,
          employee_id: employeeId,
          assigned_on: formData.assigned_on,
          condition: formData.condition,
          notes: formData.notes || null
        });

      if (assignError) throw assignError;

      // Update asset status to InUse
      const { error: updateError } = await supabase
        .from('assets')
        .update({ status: 'InUse' })
        .eq('id', formData.asset_id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Asset assigned successfully"
      });

      // Reset form
      setFormData({
        asset_id: "",
        assigned_on: new Date().toISOString().split('T')[0],
        condition: "Good",
        notes: ""
      });

      setIsOpen(false);
      onAssetAssigned?.();

    } catch (error) {
      console.error('Error assigning asset:', error);
      toast({
        title: "Error",
        description: "Failed to assign asset",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAsset = assets.find(a => a.id === formData.asset_id);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Asset to Employee</DialogTitle>
          <DialogDescription>
            Select an asset to assign to this employee
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Selection */}
          <div className="space-y-2">
            <Label>Asset *</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="w-full justify-between"
                >
                  {selectedAsset
                    ? `${selectedAsset.asset_code} - ${selectedAsset.type}`
                    : "Select asset..."
                  }
                  <Package className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search assets..." />
                  <CommandEmpty>No asset found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {assets.map((asset) => (
                        <CommandItem
                          key={asset.id}
                          onSelect={() => {
                            setFormData(prev => ({ ...prev, asset_id: asset.id }));
                            setSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{asset.asset_code} - {asset.type}</span>
                            <span className="text-sm text-muted-foreground">
                              {asset.model} • S/N: {asset.serial} • Status: {asset.status}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignment Date */}
          <div className="space-y-2">
            <Label>Assignment Date *</Label>
            <Input
              type="date"
              value={formData.assigned_on}
              onChange={(e) => setFormData(prev => ({ ...prev, assigned_on: e.target.value }))}
            />
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label>Condition *</Label>
            <Select 
              value={formData.condition} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Fair">Fair</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes about the assignment"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Assign Asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}