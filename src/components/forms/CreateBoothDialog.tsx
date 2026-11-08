import { boothFootprint } from '@/lib/boothFootprint';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
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
  CheckCircle,
  AlertCircle,
  Calculator
} from 'lucide-react';

interface CreateBoothDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const CreateBoothDialog: React.FC<CreateBoothDialogProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);

  const [formData, setFormData] = useState({
    // Basic Information (removed booth_number, kept only booth_code)
    booth_code: '',
    exhibition_id: '',
    hall: '',
    zone: '',
    aisle: '',
    position: '',
    booth_type: 'Standard',

    // Dimensions
    size_sqm: '',
    width_m: '',
    length_m: '',
    height_m: '',

    // Status
    status: 'Available',

    // Pricing (updated with price per sqm)
    price_per_sqm: '',
    additional_costs: '',
    total_price: '',
    currency: 'EGP',

    // Assignment
    assigned_to_company: '',
    assigned_to_contact: '',
    assigned_to_email: '',
    assigned_to_phone: '',
    client_id: '',

    // Technical
    power_supply: '',
    internet_access: false,
    water_supply: false,
    compressed_air: false,

    // Additional
    description: '',
    notes: '',
    special_requirements: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetForm();
    }
  }, [isOpen]);

  const dimensionalPolicy = selectedExhibition?.booth_policy?.code === 'green_life_3x4_v1';
  const footprint = boothFootprint(formData.width_m, formData.length_m);
  useEffect(() => { if (dimensionalPolicy) setFormData(prev => ({...prev, size_sqm: footprint.area})); }, [dimensionalPolicy, footprint.area]);

  // Calculate total price when size_sqm or price_per_sqm changes
  useEffect(() => {
    const sizeSqm = parseFloat(formData.size_sqm) || 0;
    const pricePerSqm = parseFloat(formData.price_per_sqm) || 0;
    const additionalCosts = parseFloat(formData.additional_costs) || 0;

    const basePrice = sizeSqm * pricePerSqm;
    const totalPrice = basePrice + additionalCosts;

    setFormData(prev => ({
      ...prev,
      total_price: totalPrice.toFixed(2)
    }));
  }, [formData.size_sqm, formData.price_per_sqm, formData.additional_costs]);

  // Update client information when client is selected
  useEffect(() => {
    if (formData.client_id && clients.length > 0) {
      const client = clients.find(c => c.id === formData.client_id);
      if (client) {
        setSelectedClient(client);
        setFormData(prev => ({
          ...prev,
          assigned_to_company: client.company || '',
          assigned_to_contact: client.name || '',
          assigned_to_email: client.email || '',
          assigned_to_phone: client.phone || ''
        }));
      }
    } else {
      setSelectedClient(null);
    }
  }, [formData.client_id, clients]);

  // Update exhibition information when exhibition is selected
  useEffect(() => {
    if (formData.exhibition_id && exhibitions.length > 0) {
      const exhibition = exhibitions.find(e => e.id === formData.exhibition_id);
      setSelectedExhibition(exhibition || null);
    } else {
      setSelectedExhibition(null);
    }
  }, [formData.exhibition_id, exhibitions]);

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

  const resetForm = () => {
    setFormData({
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
      price_per_sqm: '',
      additional_costs: '',
      total_price: '',
      currency: 'EGP',
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
    setSelectedClient(null);
    setSelectedExhibition(null);
    setActiveTab('basic');
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (dimensionalPolicy && !footprint.compliant) { toast({title: 'Validation Error', description: footprint.message, variant: 'destructive'}); setLoading(false); return; }
      // Validate required fields (booth_code is now optional - will be auto-generated)
      if (!formData.exhibition_id || !formData.size_sqm || !formData.price_per_sqm) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields: Exhibition, Size (sqm), and Price per sqm",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Prepare booth data with corrected structure matching database schema
      const boothData = {
        ...(dimensionalPolicy ? {footprint_width_m: formData.width_m, footprint_depth_m: formData.length_m} : {}),
        // ✅ REQUIRED FIELDS (matching database schema)
        // booth_code will be auto-generated if empty
        booth_code: formData.booth_code?.trim() || '', // Will be auto-generated by service if empty
        exhibition_id: formData.exhibition_id,
        expo_name: selectedExhibition?.name || '',
        booth_type: formData.booth_type,
        size_sqm: parseFloat(formData.size_sqm) || 0,
        status: formData.status,
        base_price: parseFloat(formData.price_per_sqm) * parseFloat(formData.size_sqm) || 0,
        currency: formData.currency,
        created_by: 'current-user',

        // ✅ OPTIONAL FIELDS
        hall: formData.hall.trim() || null,
        zone: formData.zone.trim() || null,
        aisle: formData.aisle.trim() || null,
        position: formData.position.trim() || null,
        width_m: parseFloat(formData.width_m) || null,
        length_m: parseFloat(formData.length_m) || null,
        height_m: parseFloat(formData.height_m) || null,
        additional_costs: parseFloat(formData.additional_costs) || 0,
        assigned_to_company: formData.assigned_to_company.trim() || null,
        assigned_to_contact: formData.assigned_to_contact.trim() || null,
        assigned_to_email: formData.assigned_to_email.trim() || null,
        assigned_to_phone: formData.assigned_to_phone.trim() || null,
        client_id: formData.client_id || null,

        // ✅ FEATURES as JSON ARRAY (not string)
        features: [
          ...(formData.power_supply ? [`Power: ${formData.power_supply}`] : []),
          ...(formData.internet_access ? ['Internet Access'] : []),
          ...(formData.water_supply ? ['Water Supply'] : []),
          ...(formData.compressed_air ? ['Compressed Air'] : [])
        ],

        // ✅ TECHNICAL FIELDS
        power_supply: formData.power_supply.trim() || null,
        internet_access: Boolean(formData.internet_access),
        water_supply: Boolean(formData.water_supply),
        compressed_air: Boolean(formData.compressed_air),
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null,
        special_requirements: formData.special_requirements.trim() || null

        // ❌ REMOVED total_price (GENERATED column in database)
        // ❌ REMOVED created_at, updated_at (handled by service)
      };

      console.log('Sending corrected booth data:', boothData);

      await boothService.create(boothData);

      toast({
        title: "Booth Created Successfully!",
        description: `Booth "${formData.booth_code}" has been created successfully`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating booth:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      let errorMessage = "Failed to create booth. Please try again.";

      // Handle specific error types
      if (error?.code === '23505') {
        if (error.message?.includes('booth_code')) {
          errorMessage = "Booth code already exists. The system will generate a unique code automatically.";
        } else {
          errorMessage = "A booth with similar details already exists. Please check your input.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error Creating Booth",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            Create New Booth
          </DialogTitle>
          <DialogDescription>
            Create a new booth and assign it to an exhibition
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
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
                      <Label htmlFor="booth_code">Booth Code *</Label>
                      <Input
                        id="booth_code"
                        value={formData.booth_code}
                        onChange={(e) => handleInputChange('booth_code', e.target.value)}
                        placeholder="e.g., A-101, B-205"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="exhibition_id">Exhibition *</Label>
                      <Select value={formData.exhibition_id} onValueChange={(value) => handleInputChange('exhibition_id', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exhibition" />
                        </SelectTrigger>
                        <SelectContent>
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
                  </div>

                  {selectedExhibition && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-900">{selectedExhibition.name}</h4>
                            <p className="text-sm text-blue-700">{selectedExhibition.description}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-blue-600">
                              <span>{selectedExhibition.start_date} - {selectedExhibition.end_date}</span>
                              <span>{selectedExhibition.location}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

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

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3 flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Location Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hall">Hall</Label>
                        <Input
                          id="hall"
                          value={formData.hall}
                          onChange={(e) => handleInputChange('hall', e.target.value)}
                          placeholder="e.g., Hall A"
                        />
                      </div>
                      <div>
                        <Label htmlFor="zone">Zone</Label>
                        <Input
                          id="zone"
                          value={formData.zone}
                          onChange={(e) => handleInputChange('zone', e.target.value)}
                          placeholder="e.g., Zone 1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="aisle">Aisle</Label>
                        <Input
                          id="aisle"
                          value={formData.aisle}
                          onChange={(e) => handleInputChange('aisle', e.target.value)}
                          placeholder="e.g., Aisle A"
                        />
                      </div>
                      <div>
                        <Label htmlFor="position">Position</Label>
                        <Input
                          id="position"
                          value={formData.position}
                          onChange={(e) => handleInputChange('position', e.target.value)}
                          placeholder="e.g., Left"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3 flex items-center">
                      <Ruler className="h-4 w-4 mr-2" />
                      Dimensions
                    </h4>
                    {dimensionalPolicy && <p role="status" className="text-sm text-muted-foreground mb-2">Green Life Expo minimum: 3 × 4 m (12 m²). {footprint.message}</p>}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="size_sqm">Size (sqm) *</Label>
                        <Input
                          id="size_sqm"
                          type="number"
                          readOnly={dimensionalPolicy}
                          value={formData.size_sqm}
                          onChange={(e) => handleInputChange('size_sqm', e.target.value)}
                          placeholder="0"
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
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="length_m">Length (m)</Label>
                        <Input
                          id="length_m"
                          type="number"
                          value={formData.length_m}
                          onChange={(e) => handleInputChange('length_m', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="height_m">Height (m)</Label>
                        <Input
                          id="height_m"
                          type="number"
                          value={formData.height_m}
                          onChange={(e) => handleInputChange('height_m', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pricing Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price_per_sqm">Price per sqm *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="price_per_sqm"
                          type="number"
                          value={formData.price_per_sqm}
                          onChange={(e) => handleInputChange('price_per_sqm', e.target.value)}
                          placeholder="0"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="additional_costs">Additional Costs</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="additional_costs"
                          type="number"
                          value={formData.additional_costs}
                          onChange={(e) => handleInputChange('additional_costs', e.target.value)}
                          placeholder="0"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price Calculation Display */}
                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3 flex items-center">
                        <Calculator className="h-4 w-4 mr-2" />
                        Price Calculation
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Size (sqm):</span>
                          <span>{formData.size_sqm || '0'} sqm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Price per sqm:</span>
                          <span>{formatAmount(parseFloat(formData.price_per_sqm) || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Base Price:</span>
                          <span>{formatAmount((parseFloat(formData.size_sqm) || 0) * (parseFloat(formData.price_per_sqm) || 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Additional Costs:</span>
                          <span>{formatAmount(parseFloat(formData.additional_costs) || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total Price:</span>
                          <span>{formatAmount(parseFloat(formData.total_price) || 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                    <Label htmlFor="client_id">Assign to Client</Label>
                    <Select value={formData.client_id} onValueChange={(value) => handleInputChange('client_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
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

                  {selectedClient && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-green-900">Selected Client</h4>
                            <div className="text-sm text-green-700 space-y-1">
                              <div>Name: {selectedClient.name}</div>
                              <div>Company: {selectedClient.company}</div>
                              <div>Email: {selectedClient.email}</div>
                              <div>Phone: {selectedClient.phone}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="assigned_to_company">Company</Label>
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
                        <Label htmlFor="internet_access">Internet Access</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="water_supply"
                          checked={formData.water_supply}
                          onChange={(e) => handleInputChange('water_supply', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="water_supply">Water Supply</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="compressed_air"
                          checked={formData.compressed_air}
                          onChange={(e) => handleInputChange('compressed_air', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="compressed_air">Compressed Air</Label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Booth description..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="special_requirements">Special Requirements</Label>
                    <Textarea
                      id="special_requirements"
                      value={formData.special_requirements}
                      onChange={(e) => handleInputChange('special_requirements', e.target.value)}
                      placeholder="Any special requirements..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>

              <div className="flex items-center space-x-3">
                {activeTab !== 'basic' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const tabs = ['basic', 'pricing', 'assignment', 'technical'];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex > 0) {
                        setActiveTab(tabs[currentIndex - 1]);
                      }
                    }}
                  >
                    Previous
                  </Button>
                )}
                {activeTab !== 'technical' ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const tabs = ['basic', 'pricing', 'assignment', 'technical'];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex < tabs.length - 1) {
                        setActiveTab(tabs[currentIndex + 1]);
                      }
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Booth...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Booth
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { CreateBoothDialog };
