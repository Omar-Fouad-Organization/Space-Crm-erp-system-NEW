import { boothFootprint } from '@/lib/boothFootprint';
import { boothEditPricing } from '@/lib/boothEditPricing';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { boothService, expoService, clientService, type Booth, type Exhibition, type Client } from '@/services/supabaseService';
import {
  Building2,
  MapPin,
  Ruler,
  DollarSign,
  Users,
  Zap,
  Plus,
  X,
  Loader2,
  Info,
  Save
} from 'lucide-react';

interface EditBoothDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  booth: Booth | null;
}

const BOOTH_TYPES = [
  { value: 'Standard', label: 'Standard', description: 'Basic inline booth configuration' },
  { value: 'Premium', label: 'Premium', description: 'Enhanced location with premium features' },
  { value: 'Corner', label: 'Corner', description: 'Corner location with two open sides' },
  { value: 'Island', label: 'Island', description: 'Standalone booth with 360° access' },
  { value: 'Peninsula', label: 'Peninsula', description: 'Three open sides configuration' },
  { value: 'Inline', label: 'Inline', description: 'Standard inline configuration' },
  { value: 'Custom', label: 'Custom', description: 'Custom booth configuration' }
];

const BOOTH_STATUS = [
  { value: 'Available', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'Reserved', label: 'Reserved', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Booked', label: 'Booked', color: 'bg-blue-100 text-blue-800' },
  { value: 'Occupied', label: 'Occupied', color: 'bg-purple-100 text-purple-800' },
  { value: 'Maintenance', label: 'Maintenance', color: 'bg-orange-100 text-orange-800' },
  { value: 'Unavailable', label: 'Unavailable', color: 'bg-red-100 text-red-800' }
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' }
];

export const EditBoothDialog: React.FC<EditBoothDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  booth
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');

  const [formData, setFormData] = useState({
    booth_number: '',
    booth_code: '',
    exhibition_id: '',
    hall: '',
    zone: '',
    aisle: '',
    position: '',
    booth_type: 'Standard',
    size_sqm: '',
    width_m: '',
    length_m: '',
    height_m: '',
    status: 'Available',
    base_price: '',
    additional_costs: '',
    currency: 'USD',
    assigned_to_company: '',
    assigned_to_contact: '',
    assigned_to_email: '',
    assigned_to_phone: '',
    client_id: '',
    power_supply: '',
    internet_access: false,
    water_supply: false,
    compressed_air: false,
    description: '',
    notes: '',
    special_requirements: ''
  });

  useEffect(() => {
    if (isOpen && booth) {
      loadData();
      populateForm();
    }
  }, [isOpen, booth]);

  const loadData = async () => {
    try {
      const [exhibitionsData, clientsData] = await Promise.all([
        expoService.getAll(),
        clientService.getAll()
      ]);
      setExhibitions(exhibitionsData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const populateForm = () => {
    if (!booth) return;

    setFormData({
      booth_number: booth.booth_number || '',
      booth_code: booth.booth_code || '',
      exhibition_id: booth.exhibition_id || '',
      hall: booth.hall || '',
      zone: booth.zone || '',
      aisle: booth.aisle || '',
      position: booth.position || '',
      booth_type: booth.booth_type || 'Standard',
      size_sqm: booth.size_sqm?.toString() || '',
      width_m: booth.width_m?.toString() || '',
      length_m: booth.length_m?.toString() || '',
      height_m: booth.height_m?.toString() || '',
      status: booth.status || 'Available',
      base_price: boothEditPricing(booth, '', '', '').originalRate.toString(),
      additional_costs: booth.additional_costs?.toString() || '',
      currency: booth.currency || 'USD',
      assigned_to_company: booth.assigned_to_company || '',
      assigned_to_contact: booth.assigned_to_contact || '',
      assigned_to_email: booth.assigned_to_email || '',
      assigned_to_phone: booth.assigned_to_phone || '',
      client_id: booth.client_id || '',
      power_supply: booth.power_supply || '',
      internet_access: booth.internet_access || false,
      water_supply: booth.water_supply || false,
      compressed_air: booth.compressed_air || false,
      description: booth.description || '',
      notes: booth.notes || '',
      special_requirements: booth.special_requirements || ''
    });

    setFeatures(booth.features || []);
    setActiveTab('basic');
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field === 'exhibition_id' && value === 'none') {
      value = '';
    }
    if (field === 'client_id' && value === 'none') {
      value = '';
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures(prev => [...prev, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (feature: string) => {
    setFeatures(prev => prev.filter(f => f !== feature));
  };

  const dimensionalPolicy = exhibitions.find(expo => expo.id === formData.exhibition_id)?.booth_policy?.code === 'green_life_3x4_v1';
  const footprint = boothFootprint(formData.width_m, formData.length_m);
  const footprintEdited = formData.width_m !== String(booth?.width_m ?? '') || formData.length_m !== String(booth?.length_m ?? '');
  const canonicalFootprint = booth?.footprint_width_m != null;
  const requiresFootprint = dimensionalPolicy && (canonicalFootprint || footprintEdited || Number(formData.size_sqm) !== booth?.size_sqm);
  useEffect(() => { if (dimensionalPolicy && (canonicalFootprint || footprintEdited)) setFormData(prev => ({...prev, size_sqm: footprint.area})); }, [dimensionalPolicy, canonicalFootprint, footprintEdited, footprint.area]);

  const calculateTotalPrice = () => {
    return booth ? boothEditPricing(booth, formData.size_sqm, formData.base_price, formData.additional_costs).total : 0;
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (requiresFootprint && !footprint.compliant) errors.push(footprint.message);

    // Only booth_code is required now (booth_number is optional)
    if (!formData.booth_code.trim()) errors.push('Booth code is required');
    if (!formData.size_sqm || parseFloat(formData.size_sqm) <= 0) {
      errors.push('Size (sqm) must be greater than 0');
    }
    if (!formData.base_price || parseFloat(formData.base_price) < 0) {
      errors.push('Base price must be 0 or greater');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!booth) return;

    const errors = validateForm();
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 🔥 MINIMAL: Extremely clean booth data
      const boothData: Partial<Booth> = {
        ...(requiresFootprint ? {footprint_width_m: formData.width_m, footprint_depth_m: formData.length_m} : {}),
        booth_code: formData.booth_code.trim(),
        // Only include booth_number if it has a value
        ...(formData.booth_number.trim() && { booth_number: formData.booth_number.trim() }),
        // Foreign keys - send empty string if none selected (edge function will handle conversion)
        exhibition_id: formData.exhibition_id || '',
        client_id: formData.client_id || '',
        // Basic fields
        booth_type: formData.booth_type,
        size_sqm: parseFloat(formData.size_sqm) || 0,
        base_price: parseFloat(formData.base_price) || 0,
        price: calculateTotalPrice(),
        total_price: calculateTotalPrice(),
        status: formData.status,
        currency: formData.currency,
        // Optional fields
        hall: formData.hall.trim() || null,
        zone: formData.zone.trim() || null,
        aisle: formData.aisle.trim() || null,
        position: formData.position.trim() || null,
        width_m: formData.width_m ? parseFloat(formData.width_m) : null,
        length_m: formData.length_m ? parseFloat(formData.length_m) : null,
        height_m: formData.height_m ? parseFloat(formData.height_m) : null,
        additional_costs: parseFloat(formData.additional_costs) || 0,
        assigned_to_company: formData.assigned_to_company.trim() || null,
        assigned_to_contact: formData.assigned_to_contact.trim() || null,
        assigned_to_email: formData.assigned_to_email.trim() || null,
        assigned_to_phone: formData.assigned_to_phone.trim() || null,
        features: features,
        power_supply: formData.power_supply.trim() || null,
        internet_access: formData.internet_access,
        water_supply: formData.water_supply,
        compressed_air: formData.compressed_air,
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null,
        special_requirements: formData.special_requirements.trim() || null
      };

      console.log('✅ FIXED: Booth data with proper foreign key handling:', boothData);
      console.log('Updating booth with data (total_price removed):', boothData);

      await boothService.update(booth.id, boothData);

      toast({
        title: "Booth Updated",
        description: `Booth "${formData.booth_code}" has been updated successfully`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating booth:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update booth. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (!booth) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            Edit Booth - {booth.booth_code}
          </DialogTitle>
          <DialogDescription>
            Update booth details, pricing, and assignment information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 max-sm:[&>button]:whitespace-normal max-sm:[&>button]:px-1">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-4 w-4 mr-2" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="booth_number">Booth Number (Optional)</Label>
                      <Input
                        id="booth_number"
                        value={formData.booth_number}
                        onChange={(e) => handleInputChange('booth_number', e.target.value)}
                        placeholder="e.g., A001, B102 (optional)"
                      />
                    </div>

                    <div>
                      <Label htmlFor="booth_code">Booth Code *</Label>
                      <Input
                        id="booth_code"
                        value={formData.booth_code}
                        onChange={(e) => handleInputChange('booth_code', e.target.value)}
                        placeholder="e.g., GLE2024-A001"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="exhibition_id">Exhibition</Label>
                    <Select value={formData.exhibition_id} onValueChange={(value) => handleInputChange('exhibition_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select exhibition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Exhibition</SelectItem>
                        {exhibitions.map((exhibition) => (
                          <SelectItem key={exhibition.id} value={exhibition.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{exhibition.name}</span>
                              <span className="text-xs text-gray-500">
                                {exhibition.start_date} - {exhibition.location}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe the booth location, features, and any special characteristics..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Location Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hall">Hall</Label>
                      <Input
                        id="hall"
                        value={formData.hall}
                        onChange={(e) => handleInputChange('hall', e.target.value)}
                        placeholder="e.g., Hall A, Main Hall"
                      />
                    </div>

                    <div>
                      <Label htmlFor="zone">Zone</Label>
                      <Input
                        id="zone"
                        value={formData.zone}
                        onChange={(e) => handleInputChange('zone', e.target.value)}
                        placeholder="e.g., Zone 1, North Wing"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="aisle">Aisle</Label>
                      <Input
                        id="aisle"
                        value={formData.aisle}
                        onChange={(e) => handleInputChange('aisle', e.target.value)}
                        placeholder="e.g., A1, Main Aisle"
                      />
                    </div>

                    <div>
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        placeholder="e.g., Corner, Center, End"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Specifications Tab */}
            <TabsContent value="specifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-4 w-4 mr-2" />
                    Booth Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="booth_type">Booth Type</Label>
                      <Select value={formData.booth_type} onValueChange={(value) => handleInputChange('booth_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select booth type" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOTH_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{type.label}</span>
                                <span className="text-xs text-gray-500">{type.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOTH_STATUS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <div className="flex items-center">
                                <Badge className={status.color}>{status.label}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {dimensionalPolicy && <p role="status" className="text-sm text-muted-foreground mb-2">Legacy area-only booths retain their existing values. Material resizing requires verified dimensions; reserved or sold booths require commercial review. {requiresFootprint ? footprint.message : ''}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="size_sqm">Size (sqm) *</Label>
                      <Input
                        id="size_sqm"
                        type="number"
                        readOnly={dimensionalPolicy && (canonicalFootprint || footprintEdited)}
                          value={formData.size_sqm}
                        onChange={(e) => handleInputChange('size_sqm', e.target.value)}
                        placeholder="100"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="width_m">Width (m)</Label>
                      <Input
                        id="width_m"
                        type="number"
                        value={formData.width_m}
                        onChange={(e) => handleInputChange('width_m', e.target.value)}
                        placeholder="10"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <Label htmlFor="length_m">Length (m)</Label>
                      <Input
                        id="length_m"
                        type="number"
                        value={formData.length_m}
                        onChange={(e) => handleInputChange('length_m', e.target.value)}
                        placeholder="10"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <Label htmlFor="height_m">Height (m)</Label>
                      <Input
                        id="height_m"
                        type="number"
                        value={formData.height_m}
                        onChange={(e) => handleInputChange('height_m', e.target.value)}
                        placeholder="3"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pricing Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="base_price">Price per SQM *</Label>
                      <Input
                        id="base_price"
                        type="number"
                        value={formData.base_price}
                        onChange={(e) => handleInputChange('base_price', e.target.value)}
                        placeholder="100"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="additional_costs">Additional Costs</Label>
                      <Input
                        id="additional_costs"
                        type="number"
                        value={formData.additional_costs}
                        onChange={(e) => handleInputChange('additional_costs', e.target.value)}
                        placeholder="500"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={formData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Price (Calculated):</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(calculateTotalPrice())}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Formula: Size (SQM) × Price per SQM = Total Price
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      placeholder="Add a feature (e.g., Premium Location, High Traffic)"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    />
                    <Button type="button" onClick={addFeature}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {features.map((feature, index) => (
                      <Badge key={index} variant="outline" className="flex items-center gap-1">
                        {feature}
                        <button
                          type="button"
                          onClick={() => removeFeature(feature)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Assignment Tab */}
            <TabsContent value="assignment" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Assignment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="client_id">Assigned Client</Label>
                    <Select value={formData.client_id} onValueChange={(value) => handleInputChange('client_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Client Assigned</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{client.name}</span>
                              <span className="text-xs text-gray-500">{client.company}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="assigned_to_company">Company Name</Label>
                      <Input
                        id="assigned_to_company"
                        value={formData.assigned_to_company}
                        onChange={(e) => handleInputChange('assigned_to_company', e.target.value)}
                        placeholder="Company name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="assigned_to_contact">Contact Person</Label>
                      <Input
                        id="assigned_to_contact"
                        value={formData.assigned_to_contact}
                        onChange={(e) => handleInputChange('assigned_to_contact', e.target.value)}
                        placeholder="Contact person name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="assigned_to_email">Email</Label>
                      <Input
                        id="assigned_to_email"
                        type="email"
                        value={formData.assigned_to_email}
                        onChange={(e) => handleInputChange('assigned_to_email', e.target.value)}
                        placeholder="contact@company.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="assigned_to_phone">Phone</Label>
                      <Input
                        id="assigned_to_phone"
                        value={formData.assigned_to_phone}
                        onChange={(e) => handleInputChange('assigned_to_phone', e.target.value)}
                        placeholder="+1-555-0123"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Any additional notes about this booth..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="special_requirements">Special Requirements</Label>
                    <Textarea
                      id="special_requirements"
                      value={formData.special_requirements}
                      onChange={(e) => handleInputChange('special_requirements', e.target.value)}
                      placeholder="Any special requirements or restrictions..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="h-4 w-4 mr-2" />
                    Technical Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="power_supply">Power Supply</Label>
                    <Input
                      id="power_supply"
                      value={formData.power_supply}
                      onChange={(e) => handleInputChange('power_supply', e.target.value)}
                      placeholder="e.g., 220V/16A, 380V/32A"
                    />
                  </div>

                  <div>
                    <Label>Available Services</Label>
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="internet_access"
                          checked={formData.internet_access}
                          onChange={(e) => handleInputChange('internet_access', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="internet_access" className="text-sm">
                          Internet Access
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="water_supply"
                          checked={formData.water_supply}
                          onChange={(e) => handleInputChange('water_supply', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="water_supply" className="text-sm">
                          Water Supply
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="compressed_air"
                          checked={formData.compressed_air}
                          onChange={(e) => handleInputChange('compressed_air', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="compressed_air" className="text-sm">
                          Compressed Air
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Form Actions */}
            <div className="flex flex-wrap gap-2 items-center justify-between pt-6 border-t">
              <div className="text-sm text-gray-500">
                Fields marked with * are required
              </div>

              <div className="flex items-center space-x-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating Booth...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Booth
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};
