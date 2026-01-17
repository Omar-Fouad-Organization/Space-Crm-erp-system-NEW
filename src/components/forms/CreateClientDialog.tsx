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
import { clientService, expoService, type Client, type Exhibition } from '@/services/supabaseService';
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Users,
  Plus,
  X,
  Loader2,
  Info,
  Save,
  User,
  Briefcase,
  Hash,
  Calendar,
  Tag
} from 'lucide-react';

interface CreateClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  { value: 'Prospect', label: 'Prospect', color: 'bg-blue-100 text-blue-800' },
  { value: 'Interested', label: 'Interested', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Not Interested', label: 'Not Interested', color: 'bg-red-100 text-red-800' }
];

export const CreateClientDialog: React.FC<CreateClientDialogProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [countries, setCountries] = useState<{id: string, name: string, code: string}[]>([]);
  
  const [formData, setFormData] = useState({
    // Basic Information
    name: '',
    company: '',
    type: 'Exhibitor',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    
    // Business Details
    industry: '',
    company_size: '',
    
    // Location
    address: '',
    city: '',
    country: '',
    postal_code: '',
    
    // Additional
    status: 'Active',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetForm();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      // Load exhibitions
      const exhibitionsData = await expoService.getAll();
      setExhibitions(exhibitionsData || []);
      
      // Load all countries in the world
      setCountries([
        { id: 'af', name: 'Afghanistan', code: 'AF' },
        { id: 'al', name: 'Albania', code: 'AL' },
        { id: 'dz', name: 'Algeria', code: 'DZ' },
        { id: 'as', name: 'American Samoa', code: 'AS' },
        { id: 'ad', name: 'Andorra', code: 'AD' },
        { id: 'ao', name: 'Angola', code: 'AO' },
        { id: 'ai', name: 'Anguilla', code: 'AI' },
        { id: 'aq', name: 'Antarctica', code: 'AQ' },
        { id: 'ag', name: 'Antigua and Barbuda', code: 'AG' },
        { id: 'ar', name: 'Argentina', code: 'AR' },
        { id: 'am', name: 'Armenia', code: 'AM' },
        { id: 'aw', name: 'Aruba', code: 'AW' },
        { id: 'au', name: 'Australia', code: 'AU' },
        { id: 'at', name: 'Austria', code: 'AT' },
        { id: 'az', name: 'Azerbaijan', code: 'AZ' },
        { id: 'bs', name: 'Bahamas', code: 'BS' },
        { id: 'bh', name: 'Bahrain', code: 'BH' },
        { id: 'bd', name: 'Bangladesh', code: 'BD' },
        { id: 'bb', name: 'Barbados', code: 'BB' },
        { id: 'by', name: 'Belarus', code: 'BY' },
        { id: 'be', name: 'Belgium', code: 'BE' },
        { id: 'bz', name: 'Belize', code: 'BZ' },
        { id: 'bj', name: 'Benin', code: 'BJ' },
        { id: 'bm', name: 'Bermuda', code: 'BM' },
        { id: 'bt', name: 'Bhutan', code: 'BT' },
        { id: 'bo', name: 'Bolivia', code: 'BO' },
        { id: 'ba', name: 'Bosnia and Herzegovina', code: 'BA' },
        { id: 'bw', name: 'Botswana', code: 'BW' },
        { id: 'bv', name: 'Bouvet Island', code: 'BV' },
        { id: 'br', name: 'Brazil', code: 'BR' },
        { id: 'io', name: 'British Indian Ocean Territory', code: 'IO' },
        { id: 'bn', name: 'Brunei Darussalam', code: 'BN' },
        { id: 'bg', name: 'Bulgaria', code: 'BG' },
        { id: 'bf', name: 'Burkina Faso', code: 'BF' },
        { id: 'bi', name: 'Burundi', code: 'BI' },
        { id: 'kh', name: 'Cambodia', code: 'KH' },
        { id: 'cm', name: 'Cameroon', code: 'CM' },
        { id: 'ca', name: 'Canada', code: 'CA' },
        { id: 'cv', name: 'Cape Verde', code: 'CV' },
        { id: 'ky', name: 'Cayman Islands', code: 'KY' },
        { id: 'cf', name: 'Central African Republic', code: 'CF' },
        { id: 'td', name: 'Chad', code: 'TD' },
        { id: 'cl', name: 'Chile', code: 'CL' },
        { id: 'cn', name: 'China', code: 'CN' },
        { id: 'cx', name: 'Christmas Island', code: 'CX' },
        { id: 'cc', name: 'Cocos (Keeling) Islands', code: 'CC' },
        { id: 'co', name: 'Colombia', code: 'CO' },
        { id: 'km', name: 'Comoros', code: 'KM' },
        { id: 'cg', name: 'Congo', code: 'CG' },
        { id: 'cd', name: 'Congo, Democratic Republic', code: 'CD' },
        { id: 'ck', name: 'Cook Islands', code: 'CK' },
        { id: 'cr', name: 'Costa Rica', code: 'CR' },
        { id: 'ci', name: 'Cote D\'Ivoire', code: 'CI' },
        { id: 'hr', name: 'Croatia', code: 'HR' },
        { id: 'cu', name: 'Cuba', code: 'CU' },
        { id: 'cy', name: 'Cyprus', code: 'CY' },
        { id: 'cz', name: 'Czech Republic', code: 'CZ' },
        { id: 'dk', name: 'Denmark', code: 'DK' },
        { id: 'dj', name: 'Djibouti', code: 'DJ' },
        { id: 'dm', name: 'Dominica', code: 'DM' },
        { id: 'do', name: 'Dominican Republic', code: 'DO' },
        { id: 'ec', name: 'Ecuador', code: 'EC' },
        { id: 'eg', name: 'Egypt', code: 'EG' },
        { id: 'sv', name: 'El Salvador', code: 'SV' },
        { id: 'gq', name: 'Equatorial Guinea', code: 'GQ' },
        { id: 'er', name: 'Eritrea', code: 'ER' },
        { id: 'ee', name: 'Estonia', code: 'EE' },
        { id: 'et', name: 'Ethiopia', code: 'ET' },
        { id: 'fk', name: 'Falkland Islands (Malvinas)', code: 'FK' },
        { id: 'fo', name: 'Faroe Islands', code: 'FO' },
        { id: 'fj', name: 'Fiji', code: 'FJ' },
        { id: 'fi', name: 'Finland', code: 'FI' },
        { id: 'fr', name: 'France', code: 'FR' },
        { id: 'gf', name: 'French Guiana', code: 'GF' },
        { id: 'pf', name: 'French Polynesia', code: 'PF' },
        { id: 'tf', name: 'French Southern Territories', code: 'TF' },
        { id: 'ga', name: 'Gabon', code: 'GA' },
        { id: 'gm', name: 'Gambia', code: 'GM' },
        { id: 'ge', name: 'Georgia', code: 'GE' },
        { id: 'de', name: 'Germany', code: 'DE' },
        { id: 'gh', name: 'Ghana', code: 'GH' },
        { id: 'gi', name: 'Gibraltar', code: 'GI' },
        { id: 'gr', name: 'Greece', code: 'GR' },
        { id: 'gl', name: 'Greenland', code: 'GL' },
        { id: 'gd', name: 'Grenada', code: 'GD' },
        { id: 'gp', name: 'Guadeloupe', code: 'GP' },
        { id: 'gu', name: 'Guam', code: 'GU' },
        { id: 'gt', name: 'Guatemala', code: 'GT' },
        { id: 'gn', name: 'Guinea', code: 'GN' },
        { id: 'gw', name: 'Guinea-Bissau', code: 'GW' },
        { id: 'gy', name: 'Guyana', code: 'GY' },
        { id: 'ht', name: 'Haiti', code: 'HT' },
        { id: 'hm', name: 'Heard Island & Mcdonald Islands', code: 'HM' },
        { id: 'va', name: 'Holy See (Vatican City State)', code: 'VA' },
        { id: 'hn', name: 'Honduras', code: 'HN' },
        { id: 'hk', name: 'Hong Kong', code: 'HK' },
        { id: 'hu', name: 'Hungary', code: 'HU' },
        { id: 'is', name: 'Iceland', code: 'IS' },
        { id: 'in', name: 'India', code: 'IN' },
        { id: 'id', name: 'Indonesia', code: 'ID' },
        { id: 'ir', name: 'Iran, Islamic Republic Of', code: 'IR' },
        { id: 'iq', name: 'Iraq', code: 'IQ' },
        { id: 'ie', name: 'Ireland', code: 'IE' },
        { id: 'il', name: 'Israel', code: 'IL' },
        { id: 'it', name: 'Italy', code: 'IT' },
        { id: 'jm', name: 'Jamaica', code: 'JM' },
        { id: 'jp', name: 'Japan', code: 'JP' },
        { id: 'jo', name: 'Jordan', code: 'JO' },
        { id: 'kz', name: 'Kazakhstan', code: 'KZ' },
        { id: 'ke', name: 'Kenya', code: 'KE' },
        { id: 'ki', name: 'Kiribati', code: 'KI' },
        { id: 'kp', name: 'Korea, Democratic People\'s Republic Of', code: 'KP' },
        { id: 'kr', name: 'Korea, Republic of', code: 'KR' },
        { id: 'kw', name: 'Kuwait', code: 'KW' },
        { id: 'kg', name: 'Kyrgyzstan', code: 'KG' },
        { id: 'la', name: 'Lao People\'s Democratic Republic', code: 'LA' },
        { id: 'lv', name: 'Latvia', code: 'LV' },
        { id: 'lb', name: 'Lebanon', code: 'LB' },
        { id: 'ls', name: 'Lesotho', code: 'LS' },
        { id: 'lr', name: 'Liberia', code: 'LR' },
        { id: 'ly', name: 'Libyan Arab Jamahiriya', code: 'LY' },
        { id: 'li', name: 'Liechtenstein', code: 'LI' },
        { id: 'lt', name: 'Lithuania', code: 'LT' },
        { id: 'lu', name: 'Luxembourg', code: 'LU' },
        { id: 'mo', name: 'Macao', code: 'MO' },
        { id: 'mk', name: 'Macedonia', code: 'MK' },
        { id: 'mg', name: 'Madagascar', code: 'MG' },
        { id: 'mw', name: 'Malawi', code: 'MW' },
        { id: 'my', name: 'Malaysia', code: 'MY' },
        { id: 'mv', name: 'Maldives', code: 'MV' },
        { id: 'ml', name: 'Mali', code: 'ML' },
        { id: 'mt', name: 'Malta', code: 'MT' },
        { id: 'mh', name: 'Marshall Islands', code: 'MH' },
        { id: 'mq', name: 'Martinique', code: 'MQ' },
        { id: 'mr', name: 'Mauritania', code: 'MR' },
        { id: 'mu', name: 'Mauritius', code: 'MU' },
        { id: 'yt', name: 'Mayotte', code: 'YT' },
        { id: 'mx', name: 'Mexico', code: 'MX' },
        { id: 'fm', name: 'Micronesia, Federated States Of', code: 'FM' },
        { id: 'md', name: 'Moldova, Republic of', code: 'MD' },
        { id: 'mc', name: 'Monaco', code: 'MC' },
        { id: 'mn', name: 'Mongolia', code: 'MN' },
        { id: 'me', name: 'Montenegro', code: 'ME' },
        { id: 'ms', name: 'Montserrat', code: 'MS' },
        { id: 'ma', name: 'Morocco', code: 'MA' },
        { id: 'mz', name: 'Mozambique', code: 'MZ' },
        { id: 'mm', name: 'Myanmar', code: 'MM' },
        { id: 'na', name: 'Namibia', code: 'NA' },
        { id: 'nr', name: 'Nauru', code: 'NR' },
        { id: 'np', name: 'Nepal', code: 'NP' },
        { id: 'nl', name: 'Netherlands', code: 'NL' },
        { id: 'an', name: 'Netherlands Antilles', code: 'AN' },
        { id: 'nc', name: 'New Caledonia', code: 'NC' },
        { id: 'nz', name: 'New Zealand', code: 'NZ' },
        { id: 'ni', name: 'Nicaragua', code: 'NI' },
        { id: 'ne', name: 'Niger', code: 'NE' },
        { id: 'ng', name: 'Nigeria', code: 'NG' },
        { id: 'nu', name: 'Niue', code: 'NU' },
        { id: 'nf', name: 'Norfolk Island', code: 'NF' },
        { id: 'mp', name: 'Northern Mariana Islands', code: 'MP' },
        { id: 'no', name: 'Norway', code: 'NO' },
        { id: 'om', name: 'Oman', code: 'OM' },
        { id: 'pk', name: 'Pakistan', code: 'PK' },
        { id: 'pw', name: 'Palau', code: 'PW' },
        { id: 'ps', name: 'Palestinian Territory, Occupied', code: 'PS' },
        { id: 'pa', name: 'Panama', code: 'PA' },
        { id: 'pg', name: 'Papua New Guinea', code: 'PG' },
        { id: 'py', name: 'Paraguay', code: 'PY' },
        { id: 'pe', name: 'Peru', code: 'PE' },
        { id: 'ph', name: 'Philippines', code: 'PH' },
        { id: 'pn', name: 'Pitcairn', code: 'PN' },
        { id: 'pl', name: 'Poland', code: 'PL' },
        { id: 'pt', name: 'Portugal', code: 'PT' },
        { id: 'pr', name: 'Puerto Rico', code: 'PR' },
        { id: 'qa', name: 'Qatar', code: 'QA' },
        { id: 're', name: 'Reunion', code: 'RE' },
        { id: 'ro', name: 'Romania', code: 'RO' },
        { id: 'ru', name: 'Russian Federation', code: 'RU' },
        { id: 'rw', name: 'Rwanda', code: 'RW' },
        { id: 'sh', name: 'Saint Helena', code: 'SH' },
        { id: 'kn', name: 'Saint Kitts And Nevis', code: 'KN' },
        { id: 'lc', name: 'Saint Lucia', code: 'LC' },
        { id: 'pm', name: 'Saint Pierre And Miquelon', code: 'PM' },
        { id: 'vc', name: 'Saint Vincent And Grenadines', code: 'VC' },
        { id: 'ws', name: 'Samoa', code: 'WS' },
        { id: 'sm', name: 'San Marino', code: 'SM' },
        { id: 'st', name: 'Sao Tome And Principe', code: 'ST' },
        { id: 'sa', name: 'Saudi Arabia', code: 'SA' },
        { id: 'sn', name: 'Senegal', code: 'SN' },
        { id: 'rs', name: 'Serbia', code: 'RS' },
        { id: 'sc', name: 'Seychelles', code: 'SC' },
        { id: 'sl', name: 'Sierra Leone', code: 'SL' },
        { id: 'sg', name: 'Singapore', code: 'SG' },
        { id: 'sk', name: 'Slovakia', code: 'SK' },
        { id: 'si', name: 'Slovenia', code: 'SI' },
        { id: 'sb', name: 'Solomon Islands', code: 'SB' },
        { id: 'so', name: 'Somalia', code: 'SO' },
        { id: 'za', name: 'South Africa', code: 'ZA' },
        { id: 'gs', name: 'South Georgia And Sandwich Isl.', code: 'GS' },
        { id: 'es', name: 'Spain', code: 'ES' },
        { id: 'lk', name: 'Sri Lanka', code: 'LK' },
        { id: 'sd', name: 'Sudan', code: 'SD' },
        { id: 'sr', name: 'Suriname', code: 'SR' },
        { id: 'sj', name: 'Svalbard And Jan Mayen', code: 'SJ' },
        { id: 'sz', name: 'Swaziland', code: 'SZ' },
        { id: 'se', name: 'Sweden', code: 'SE' },
        { id: 'ch', name: 'Switzerland', code: 'CH' },
        { id: 'sy', name: 'Syrian Arab Republic', code: 'SY' },
        { id: 'tw', name: 'Taiwan', code: 'TW' },
        { id: 'tj', name: 'Tajikistan', code: 'TJ' },
        { id: 'tz', name: 'Tanzania', code: 'TZ' },
        { id: 'th', name: 'Thailand', code: 'TH' },
        { id: 'tl', name: 'Timor-Leste', code: 'TL' },
        { id: 'tg', name: 'Togo', code: 'TG' },
        { id: 'tk', name: 'Tokelau', code: 'TK' },
        { id: 'to', name: 'Tonga', code: 'TO' },
        { id: 'tt', name: 'Trinidad And Tobago', code: 'TT' },
        { id: 'tn', name: 'Tunisia', code: 'TN' },
        { id: 'tr', name: 'Turkey', code: 'TR' },
        { id: 'tm', name: 'Turkmenistan', code: 'TM' },
        { id: 'tc', name: 'Turks And Caicos Islands', code: 'TC' },
        { id: 'tv', name: 'Tuvalu', code: 'TV' },
        { id: 'ug', name: 'Uganda', code: 'UG' },
        { id: 'ua', name: 'Ukraine', code: 'UA' },
        { id: 'ae', name: 'United Arab Emirates', code: 'AE' },
        { id: 'gb', name: 'United Kingdom', code: 'GB' },
        { id: 'us', name: 'United States', code: 'US' },
        { id: 'um', name: 'United States Outlying Islands', code: 'UM' },
        { id: 'uy', name: 'Uruguay', code: 'UY' },
        { id: 'uz', name: 'Uzbekistan', code: 'UZ' },
        { id: 'vu', name: 'Vanuatu', code: 'VU' },
        { id: 've', name: 'Venezuela', code: 'VE' },
        { id: 'vn', name: 'Viet Nam', code: 'VN' },
        { id: 'vg', name: 'Virgin Islands, British', code: 'VG' },
        { id: 'vi', name: 'Virgin Islands, U.S.', code: 'VI' },
        { id: 'wf', name: 'Wallis And Futuna', code: 'WF' },
        { id: 'eh', name: 'Western Sahara', code: 'EH' },
        { id: 'ye', name: 'Yemen', code: 'YE' },
        { id: 'zm', name: 'Zambia', code: 'ZM' },
        { id: 'zw', name: 'Zimbabwe', code: 'ZW' }
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const resetForm = () => {
    setFormData({
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
      const clientData: Partial<Client> = {
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

      await clientService.create(clientData);

      toast({
        title: "Client Created",
        description: `Client "${formData.name}" has been created successfully`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create client. Please try again.",
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
          <DialogTitle className="flex items-center text-xl">
            <Plus className="h-5 w-5 mr-2" />
            Create New Client
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
                      Creating Client...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Client
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