import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { clientService, type Client } from '@/services/supabaseService';
import {
  Users,
  Loader2,
  Info,
  User,
  Briefcase,
  MapPin,
  Tag,
  Save
} from 'lucide-react';

interface EditClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client | null;
}

const CLIENT_TYPES = [
  { value: 'Sponsor', label: 'Sponsor', description: 'Financial supporters of exhibitions' },
  { value: 'Exhibitor', label: 'Exhibitor', description: 'Companies showcasing products/services' },
  { value: 'Partner', label: 'Partner', description: 'Strategic business partners' },
  { value: 'Vendor', label: 'Vendor', description: 'Service providers and suppliers' }
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 
  'Education', 'Hospitality', 'Real Estate', 'Automotive', 'Energy',
  'Food & Beverage', 'Beauty & Wellness', 'Home & Design', 'Green Manufacturing',
  'Entertainment', 'Media', 'Telecommunications', 'Transportation', 'Agriculture'
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' }
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'Inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
  { value: 'Prospect', label: 'Prospect', color: 'bg-blue-100 text-blue-800' }
];

export const EditClientDialog: React.FC<EditClientDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  client
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [countries, setCountries] = useState<{id: string, name: string, code: string}[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    type: 'Exhibitor',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    company_size: '',
    address: '',
    city: '',
    country: '',
    postal_code: '',
    status: 'Active',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && client) {
      loadData();
      populateForm();
    }
  }, [isOpen, client]);

  const loadData = async () => {
    try {
      // Load countries (mock data for now)
      setCountries([
        { id: 'us', name: 'United States', code: 'US' },
        { id: 'ca', name: 'Canada', code: 'CA' },
        { id: 'uk', name: 'United Kingdom', code: 'UK' },
        { id: 'de', name: 'Germany', code: 'DE' },
        { id: 'fr', name: 'France', code: 'FR' },
        { id: 'jp', name: 'Japan', code: 'JP' },
        { id: 'au', name: 'Australia', code: 'AU' },
        { id: 'sg', name: 'Singapore', code: 'SG' }
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const populateForm = () => {
    if (!client) return;
    
    setFormData({
      name: client.name || '',
      company: client.company || '',
      type: client.type || 'Exhibitor',
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      website: client.website || '',
      industry: client.industry || '',
      company_size: client.company_size || '',
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      postal_code: client.postal_code || '',
      status: client.status || 'Active',
      notes: client.notes || ''
    });
    setActiveTab('basic');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) errors.push('Client name is required');
    if (!formData.contact_person.trim()) errors.push('Contact person is required');
    if (!formData.email.trim()) errors.push('Email is required');
    if (!/\S+@\S+\.\S+/.test(formData.email)) errors.push('Email is invalid');
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) return;
    
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
      const updates: Partial<Client> = {
        name: formData.name.trim(),
        company: formData.company.trim() || undefined,
        type: formData.type,
        contact_person: formData.contact_person.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        website: formData.website.trim() || undefined,
        industry: formData.industry || undefined,
        company_size: formData.company_size || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        country: formData.country || undefined,
        postal_code: formData.postal_code.trim() || undefined,
        status: formData.status,
        notes: formData.notes.trim() || undefined
      };

      await clientService.update(client.id, updates);

      toast({
        title: "Client Updated",
        description: `Client "${formData.name}" has been updated successfully`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Users className="h-5 w-5 mr-2" />
            Edit Client: {client.name}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="business">Business Details</TabsTrigger>
            <TabsTrigger value="location">Location & Notes</TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <User className="h-5 w-5 mr-2" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="space-y-2">
                      <Label htmlFor="name">Client Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="e.g., EcoTech Solutions"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => handleInputChange('company', e.target.value)}
                        placeholder="e.g., EcoTech Solutions Inc."
                      />
                    </div>

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Client Type</Label>
                    <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENT_TYPES.map((type) => (
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="space-y-2">
                      <Label htmlFor="contact_person">Contact Person *</Label>
                      <Input
                        id="contact_person"
                        value={formData.contact_person}
                        onChange={(e) => handleInputChange('contact_person', e.target.value)}
                        placeholder="e.g., John Smith"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="e.g., john@ecotech.com"
                        required
                      />
                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="e.g., +1-555-0123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={formData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        placeholder="e.g., https://www.ecotech.com"
                      />
                    </div>

                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            {/* Business Details Tab */}
            <TabsContent value="business" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Briefcase className="h-5 w-5 mr-2" />
                    Business Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={formData.industry} onValueChange={(value) => handleInputChange('industry', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_size">Company Size</Label>
                    <Select value={formData.company_size} onValueChange={(value) => handleInputChange('company_size', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZES.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            {/* Location & Notes Tab */}
            <TabsContent value="location" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <MapPin className="h-5 w-5 mr-2" />
                    Location Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="e.g., 123 Business Avenue, Suite 100"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="e.g., San Francisco"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select value={formData.country} onValueChange={(value) => handleInputChange('country', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country.id} value={country.name}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => handleInputChange('postal_code', e.target.value)}
                        placeholder="e.g., 94105"
                      />
                    </div>

                  </div>

                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Tag className="h-5 w-5 mr-2" />
                    Status & Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="status">Client Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <div className="flex items-center">

                              <Badge className={`${status.color} mr-2`}>{status.label}</Badge>

                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Any additional information about this client..."
                      rows={4}
                    />
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t">

              <div className="flex items-center text-sm text-gray-500">
                <Info className="h-4 w-4 mr-1" />
                Fields marked with * are required
              </div>

              <div className="flex space-x-3">

                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating Client...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Client
                    </>
                  )}
                </Button>

              </div>

            </div>

          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};