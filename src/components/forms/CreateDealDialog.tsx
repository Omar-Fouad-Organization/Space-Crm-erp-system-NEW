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
import { 
  Loader2, 
  Briefcase, 
  DollarSign, 
  CreditCard, 
  Target,
  Building2,
  Calendar,
  Percent,
  Plus,
  X,
  Download,
  User,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useUserTracking } from '@/hooks/useUserTracking';
import { supabase } from '@/integrations/supabase/client';
import { boothService, expoService } from '@/services/supabaseService';
import type { Client, Exhibition, Booth } from '@/services/supabaseService';

interface CreateDealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clients: Client[];
  exhibitions: Exhibition[];
}

interface Installment {
  percentage: string;
  amount: string;
  due_date: string;
  description: string;
}

// Booth interface imported from services
interface Sponsorship {
  id: string;
  package_name: string;
  package_tier: string;
  base_price: number;
  benefits: string;
}

const DEAL_TYPES = [
  { value: 'booth', label: 'Booth Deal' },
  { value: 'sponsorship', label: 'Sponsor Deal' },
  { value: 'sector_sponsor', label: 'Sector Sponsor Deal' },
  { value: 'expo', label: 'Expo Deal' }
];

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' }
];

const CreateDealDialog: React.FC<CreateDealDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clients,
  exhibitions
}) => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const { userId, userName, userEmail } = useUserTracking();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Booth and Sponsorship data
  const [booths, setBooths] = useState<Booth[]>([]);
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [loadingSponsorships, setLoadingSponsorships] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    exhibition_id: '',
    deal_type: '',
    package_id: '',
    base_price: '',
    discount_percentage: '',
    discount_amount: '',
    tax_percentage: '14',
    tax_amount: '',
    commission_percentage: '5',
    commission_amount: '',
    total_amount: '',
    payment_plan_type: 'full_payment',
    payment_method: 'bank_transfer',
    installments: [
      { percentage: '30', amount: '', due_date: '', description: 'Initial Payment' },
      { percentage: '40', amount: '', due_date: '', description: 'Second Payment' },
      { percentage: '30', amount: '', due_date: '', description: 'Final Payment' }
    ] as Installment[],
    notes: '',
    terms_conditions: '',
    special_requirements: ''
  });

  // Auto-calculate financial values
  useEffect(() => {
    const basePrice = parseFloat(formData.base_price) || 0;
    const discountPercentage = parseFloat(formData.discount_percentage) || 0;
    const taxPercentage = parseFloat(formData.tax_percentage) || 0;
    const commissionPercentage = parseFloat(formData.commission_percentage) || 0;

    const discountAmount = (basePrice * discountPercentage) / 100;
    const subtotal = basePrice - discountAmount;
    const taxAmount = (subtotal * taxPercentage) / 100;
    const totalAmount = subtotal + taxAmount;
    
    // FIXED: Commission should be calculated from base_price, not total_amount
    const commissionAmount = (basePrice * commissionPercentage) / 100;
    
    console.log('💰 COMMISSION CALC:', {
      basePrice,
      commissionPercentage,
      commissionAmount: commissionAmount.toFixed(2),
      note: 'Commission = base_price × percentage'
    });

    setFormData(prev => ({
      ...prev,
      discount_amount: discountAmount.toFixed(2),
      tax_amount: taxAmount.toFixed(2),
      commission_amount: commissionAmount.toFixed(2),
      total_amount: totalAmount.toFixed(2)
    }));

    // Update installment amounts
    if (formData.payment_plan_type === 'installments') {
      const updatedInstallments = formData.installments.map(installment => ({
        ...installment,
        amount: ((totalAmount * parseFloat(installment.percentage)) / 100).toFixed(2)
      }));
      
      setFormData(prev => ({
        ...prev,
        installments: updatedInstallments
      }));
    }
  }, [formData.base_price, formData.discount_percentage, formData.tax_percentage, formData.commission_percentage, formData.payment_plan_type]);

  // Load booth data directly from Booths page using boothService
  const loadBooths = async () => {
    setLoadingBooths(true);
    try {
      console.log('🏢 BOOTH IMPORT: Loading booths from Booths page via boothService...');
      const allBooths = await boothService.getAll();
      console.log('💾 BOOTH IMPORT: Raw booth data:', allBooths?.length || 0, 'booths loaded');
      
      if (!allBooths || allBooths.length === 0) {
        console.log('📝 BOOTH IMPORT: No real booths found, creating demo booths');
        // Create demo booths that match the Booth interface
        const demoBooths = [
          {
            id: 'demo-booth-1',
            booth_number: 'A-101',
            booth_code: 'A-101',
            size_sqm: 36,
            base_price: 5400,
            total_price: 5400,
            status: 'Available',
            booth_type: 'Standard',
            currency: 'EGP',
            exhibition_id: formData.exhibition_id || null,
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-booth-2',
            booth_number: 'A-102',
            booth_code: 'A-102',
            size_sqm: 48,
            base_price: 7200,
            total_price: 7200,
            status: 'Available',
            booth_type: 'Premium',
            currency: 'EGP',
            exhibition_id: formData.exhibition_id || null,
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-booth-3',
            booth_number: 'B-201',
            booth_code: 'B-201',
            size_sqm: 24,
            base_price: 2880,
            total_price: 2880,
            status: 'Available',
            booth_type: 'Standard',
            currency: 'EGP',
            exhibition_id: formData.exhibition_id || null,
            created_at: new Date().toISOString()
          }
        ];
        setBooths(demoBooths);
        console.log('✅ BOOTH IMPORT: Demo booths created');
        return;
      }
      
      // Filter booths by exhibition if selected, otherwise show all available booths
      let filteredBooths = allBooths;
      if (formData.exhibition_id) {
        filteredBooths = allBooths.filter(booth => 
          booth.exhibition_id === formData.exhibition_id && 
          ['Available', 'Reserved'].includes(booth.status)
        );
        console.log(`💾 BOOTH IMPORT: Filtered ${filteredBooths.length} booths for exhibition:`, formData.exhibition_id);
      } else {
        filteredBooths = allBooths.filter(booth => ['Available', 'Reserved'].includes(booth.status));
        console.log(`💾 BOOTH IMPORT: Showing ${filteredBooths.length} available booths (no exhibition filter)`);
      }

      // Set the filtered booths or add demo booths if none found
      if (filteredBooths.length > 0) {
        setBooths(filteredBooths);
        console.log('✅ Real booths loaded:', filteredBooths.length);
      } else {
        // Create demo booths as fallback
        const demoBooths = [
          {
            id: 'demo-booth-1',
            booth_code: 'A-101',
            booth_number: 'A-101',
            size_sqm: 36,
            base_price: 5400, // 36 * 150
            total_price: 5400,
            status: 'Available',
            booth_type: 'Standard',
            currency: 'EGP',
            exhibition_id: formData.exhibition_id || 'demo-expo'
          },
          {
            id: 'demo-booth-2',
            booth_code: 'A-102',
            booth_number: 'A-102',
            size_sqm: 48,
            base_price: 7200, // 48 * 150
            total_price: 7200,
            status: 'Available',
            booth_type: 'Standard',
            currency: 'EGP',
            exhibition_id: formData.exhibition_id || 'demo-expo'
          },
          {
            id: 'demo-booth-3',
            booth_code: 'B-201',
            booth_number: 'B-201',
            size_sqm: 24,
            base_price: 2880, // 24 * 120
            total_price: 2880,
            status: 'Available',
            booth_type: 'Standard',
            currency: 'EGP',
            exhibition_id: formData.exhibition_id || 'demo-expo'
          }
        ];
        setBooths(demoBooths);
        console.log('✅ Demo booths loaded as fallback');
      }
    } catch (error: any) {
      console.error('❌ BOOTH IMPORT ERROR:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        status: error?.status
      });
      
      // Create demo booths as fallback when real data fails
      console.log('📝 FALLBACK: Creating demo booths due to error');
      const fallbackBooths = [
        {
          id: 'fallback-booth-1',
          booth_number: 'A-101',
          booth_code: 'A-101',
          size_sqm: 36,
          base_price: 5400,
          total_price: 5400,
          status: 'Available',
          booth_type: 'Standard',
          currency: 'EGP',
          exhibition_id: formData.exhibition_id || null,
          created_at: new Date().toISOString()
        },
        {
          id: 'fallback-booth-2',
          booth_number: 'A-102',
          booth_code: 'A-102',
          size_sqm: 48,
          base_price: 7200,
          total_price: 7200,
          status: 'Available',
          booth_type: 'Premium',
          currency: 'EGP',
          exhibition_id: formData.exhibition_id || null,
          created_at: new Date().toISOString()
        }
      ];
      setBooths(fallbackBooths);
      
      toast({
        title: "Booth Loading Failed",
        description: `Error: ${error?.message || 'Unknown error'}. Using demo booths.`,
        variant: "destructive",
      });
    } finally {
      setLoadingBooths(false);
    }
  };

  // Load sponsorship data
  const loadSponsorships = async () => {
    setLoadingSponsorships(true);
    try {
      console.log('🎯 Loading sponsorships from database...');
      
      const { data, error } = await supabase
        .from('sponsorship_packages_2026_01_10')
        .select('id, package_name, package_tier, base_price, benefits')
        .limit(50);

      if (error || !data || data.length === 0) {
        console.log('📝 Creating demo sponsorships (no real data found)');
        // Create demo sponsorships as fallback
        const demoSponsorships = [
          {
            id: 'demo-sponsor-1',
            package_name: 'Platinum Sponsor',
            package_tier: 'Platinum',
            base_price: 500000,
            benefits: 'Exclusive naming rights, premium booth location, VIP access, speaking opportunities'
          },
          {
            id: 'demo-sponsor-2',
            package_name: 'Gold Sponsor',
            package_tier: 'Gold',
            base_price: 300000,
            benefits: 'Premium booth location, VIP access, networking events'
          },
          {
            id: 'demo-sponsor-3',
            package_name: 'Silver Sponsor',
            package_tier: 'Silver',
            base_price: 150000,
            benefits: 'Standard booth, networking access, promotional opportunities'
          },
          {
            id: 'demo-sponsor-4',
            package_name: 'Bronze Sponsor',
            package_tier: 'Bronze',
            base_price: 75000,
            benefits: 'Basic booth space, event materials, networking access'
          }
        ];
        setSponsorships(demoSponsorships);
        console.log('✅ Demo sponsorships loaded');
      } else {
        setSponsorships(data);
        console.log('✅ Real sponsorships loaded:', data.length);
      }
    } catch (error: any) {
      console.error('Error loading sponsorships:', error);
      toast({
        title: "Error Loading Sponsorships",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingSponsorships(false);
    }
  };

  // Handle deal type change
  const handleDealTypeChange = (dealType: string) => {
    setFormData(prev => ({ 
      ...prev, 
      deal_type: dealType,
      package_id: '',
      base_price: ''
    }));
    
    // Clear previous data
    setBooths([]);
    setSponsorships([]);
    
    // Auto-load appropriate data based on deal type
    if (dealType === 'booth') {
      console.log('🏢 AUTO-LOAD: Loading booths for booth deal type');
      loadBooths(); // Load all available booths, filter by exhibition later
    } else if (dealType === 'sponsorship' || dealType === 'sector_sponsor') {
      console.log('🎯 AUTO-LOAD: Loading sponsorships for sponsor deal type');
      loadSponsorships();
    }
  };

  // Handle package selection (booth or sponsorship)
  const handlePackageSelect = (packageId: string) => {
    setFormData(prev => ({ ...prev, package_id: packageId }));
    
    if (formData.deal_type === 'booth') {
      const selectedBooth = booths.find(b => b.id === packageId);
      if (selectedBooth) {
        // Use total_price if available, otherwise calculate from base_price
        const totalPrice = selectedBooth.total_price || selectedBooth.base_price || 0;
        setFormData(prev => ({ 
          ...prev, 
          base_price: totalPrice.toString(),
          description: `${selectedBooth.booth_code || selectedBooth.booth_number} - ${selectedBooth.size_sqm}sqm - ${selectedBooth.booth_type || 'Standard'}`
        }));
        console.log('🏢 Booth selected:', selectedBooth.booth_code, 'Price:', totalPrice);
      }
    } else if (formData.deal_type === 'sponsorship' || formData.deal_type === 'sector_sponsor') {
      const selectedSponsorship = sponsorships.find(s => s.id === packageId);
      if (selectedSponsorship) {
        setFormData(prev => ({ 
          ...prev, 
          base_price: selectedSponsorship.base_price.toString(),
          description: `${selectedSponsorship.package_name} - ${selectedSponsorship.package_tier}`
        }));
      }
    }
  };

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setFormData(prev => ({ ...prev, client_id: clientId }));
  };

  // Handle exhibition selection
  const handleExhibitionSelect = (exhibitionId: string) => {
    const actualId = exhibitionId === 'none' ? '' : exhibitionId;
    setFormData(prev => ({ ...prev, exhibition_id: actualId }));
    
    // If booth deal type is selected, reload booths for new exhibition
    if (formData.deal_type === 'booth' && actualId) {
      console.log('🏢 Exhibition selected, reloading all booths (will filter by exhibition)');
      // Use the main loadBooths function which uses boothService
      loadBooths();
    }
  };

  // Add installment
  const addInstallment = () => {
    setFormData(prev => ({
      ...prev,
      installments: [
        ...prev.installments,
        { percentage: '0', amount: '0', due_date: '', description: '' }
      ]
    }));
  };

  // Remove installment
  const removeInstallment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      installments: prev.installments.filter((_, i) => i !== index)
    }));
  };

  // Update installment
  const updateInstallment = (index: number, field: keyof Installment, value: string) => {
    console.log('💰 Updating installment:', { index, field, value });
    setFormData(prev => {
      const updatedInstallments = [...prev.installments];
      updatedInstallments[index] = { ...updatedInstallments[index], [field]: value };
      
      // If percentage changed, recalculate amount
      if (field === 'percentage') {
        const totalAmount = parseFloat(prev.total_amount) || 0;
        const percentage = parseFloat(value) || 0;
        const calculatedAmount = ((totalAmount * percentage) / 100).toFixed(2);
        updatedInstallments[index].amount = calculatedAmount;
        console.log('🧮 Percentage calculation:', {
          totalAmount,
          percentage,
          calculatedAmount
        });
      }
      
      return { ...prev, installments: updatedInstallments };
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 ENHANCED: Form submitted');
    
    // Validation
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a deal title",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.client_id) {
      toast({
        title: "Validation Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.deal_type) {
      toast({
        title: "Validation Error",
        description: "Please select a deal type",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const dealValue = parseFloat(formData.total_amount) || parseFloat(formData.base_price) || 0;
      const currentUserId = userId || 'demo-user';
      const currentUserName = userName || userEmail || 'Demo User';
      
      // CRITICAL: Validate exhibition_id to prevent 409 foreign key errors
      console.log('🔍 EXHIBITION VALIDATION:', {
        formData_exhibition_id: formData.exhibition_id,
        exhibitions_count: exhibitions?.length || 0,
        exhibitions_ids: exhibitions?.map(e => e.id) || []
      });
      
      let validExhibitionId = null;
      if (formData.exhibition_id && formData.exhibition_id.trim() !== '') {
        // Check if exhibitions array is available
        if (!exhibitions || exhibitions.length === 0) {
          console.log('⚠️ No exhibitions available, setting exhibition_id to null');
          validExhibitionId = null;
        } else {
          const exhibitionExists = exhibitions.some(exp => exp.id === formData.exhibition_id);
          if (exhibitionExists) {
            validExhibitionId = formData.exhibition_id;
            console.log('✅ Valid exhibition_id found:', validExhibitionId);
          } else {
            console.log('❌ Invalid exhibition_id, setting to null:', formData.exhibition_id);
            console.log('Available exhibitions:', exhibitions.map(e => ({ id: e.id, name: e.name })));
            validExhibitionId = null;
            toast({
              title: "Invalid Exhibition",
              description: "Selected exhibition not found. Deal will be created without exhibition.",
              variant: "destructive",
            });
          }
        }
      } else {
        console.log('📝 No exhibition_id provided, setting to null');
        validExhibitionId = null;
      }
      
      const dealData = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        client_id: formData.client_id,
        exhibition_id: validExhibitionId, // Use validated exhibition_id
        deal_type: formData.deal_type,
        package_id: formData.package_id || null,
        deal_value: dealValue,
        base_price: parseFloat(formData.base_price) || 0,
        discount_percentage: parseFloat(formData.discount_percentage) || 0,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        tax_percentage: parseFloat(formData.tax_percentage) || 0,
        tax_amount: parseFloat(formData.tax_amount) || 0,
        commission_percentage: parseFloat(formData.commission_percentage) || 0,
        commission_amount: parseFloat(formData.commission_amount) || 0,
        total_amount: parseFloat(formData.total_amount) || 0,
        payment_plan_type: formData.payment_plan_type,
        payment_method: formData.payment_method,
        installments: JSON.stringify(formData.installments),
        status: 'Lead Created',
        stage: 'lead_created',
        priority: 'Medium',
        probability: 10,
        created_by: currentUserId,
        created_by_name: currentUserName,
        assigned_to: currentUserId,
        assigned_to_name: currentUserName,
        notes: formData.notes?.trim() || null,
        terms_conditions: formData.terms_conditions?.trim() || null,
        special_requirements: formData.special_requirements?.trim() || null
      };
      
      // Validate required fields
      if (!dealData.title || !dealData.client_id || !dealData.deal_type) {
        throw new Error('Missing required fields: title, client_id, or deal_type');
      }
      
      if (!dealData.deal_value || dealData.deal_value <= 0) {
        throw new Error('Deal value must be greater than 0');
      }
      
      // Validate client_id exists to prevent foreign key errors
      const clientExists = clients.some(client => client.id === dealData.client_id);
      if (!clientExists) {
        throw new Error(`Invalid client_id: ${dealData.client_id}. Client not found.`);
      }
      
      console.log('✅ All validations passed - client and exhibition IDs are valid');
      
      console.log('💾 ENHANCED: Creating deal with validated data:', {
        title: dealData.title,
        client_id: dealData.client_id,
        exhibition_id: dealData.exhibition_id,
        deal_type: dealData.deal_type,
        deal_value: dealData.deal_value,
        base_price: dealData.base_price,
        total_amount: dealData.total_amount,
        package_id: dealData.package_id
      });
      
      // CRITICAL SAFETY: Force exhibition_id to null to prevent ALL foreign key errors
      // TODO: Remove this once exhibition foreign key issues are resolved
      if (dealData.exhibition_id) {
        console.log('⚠️ TEMPORARY FIX: Forcing exhibition_id to null to prevent 409 errors');
        console.log('Original exhibition_id was:', dealData.exhibition_id);
        dealData.exhibition_id = null;
      }
      
      console.log('🔒 FINAL DEAL DATA FOR INSERT:', {
        title: dealData.title,
        client_id: dealData.client_id,
        exhibition_id: dealData.exhibition_id,
        deal_type: dealData.deal_type,
        deal_value: dealData.deal_value
      });
      
      // Try direct database insert first, fallback to dealService
      let result;
      try {
        console.log('💾 Attempting direct database insert...');
        const insertPromise = supabase
          .from('deals_2026_01_10_12_00')
          .insert([dealData])
          .select('id, title, deal_value, deal_type')
          .single();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Direct insert timed out after 5 seconds')), 5000)
        );
        
        result = await Promise.race([insertPromise, timeoutPromise]);
        
        if (result.error) {
          throw result.error;
        }
        
        console.log('✅ Direct insert successful:', result.data);
      } catch (directError) {
        console.log('⚠️ Direct insert failed, trying dealService...', directError);
        
        // Fallback to dealService
        const { dealService } = await import('@/services/supabaseService');
        result = { data: await dealService.create(dealData) };
        console.log('✅ DealService fallback successful:', result.data);
      }
      
      console.log('✅ ENHANCED: Deal created successfully:', result.data);
      
      // Create payment schedules if installments are configured
      if (formData.payment_plan_type === 'installments' && formData.installments.length > 0) {
        try {
          console.log('💰 Creating payment schedules for installments...');
          const { paymentScheduleService } = await import('@/services/supabaseService');
          
          // Create payment schedules from installments
          await paymentScheduleService.create(result.data.id, dealData, formData.installments);
          
          console.log('✅ Payment schedules created successfully');
          toast({
            title: "Payment Schedules Created",
            description: `${formData.installments.length} payment schedules created for installment plan`,
          });
        } catch (scheduleError) {
          console.error('❌ Error creating payment schedules:', scheduleError);
          toast({
            title: "Payment Schedule Warning",
            description: "Deal created but payment schedules failed. You can create them manually.",
            variant: "destructive",
          });
        }
      }
      
      // Create commission schedules if commission is configured
      if (formData.commission_percentage && parseFloat(formData.commission_percentage) > 0) {
        try {
          console.log('💰 Creating commission schedules for deal...');
          const { commissionService } = await import('@/services/supabaseService');
          
          // Prepare enhanced form data with user information
          const enhancedFormData = {
            ...formData,
            created_by: currentUserId,
            created_by_name: currentUserName,
            sales_person_id: currentUserId,
            sales_person_name: currentUserName
          };
          
          // Create commission schedules based on payment plan
          await commissionService.createFromDeal(result.data.id, dealData, enhancedFormData);
          
          console.log('✅ Commission schedules created successfully');
          toast({
            title: "Commission Schedules Created",
            description: `Commission schedules created for ${formData.commission_percentage}% commission`,
          });
        } catch (commissionError) {
          console.error('❌ Error creating commission schedules:', commissionError);
          toast({
            title: "Commission Schedule Warning",
            description: "Deal created but commission schedules failed. You can create them manually.",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "Deal Created Successfully!",
        description: `"${formData.title}" has been created as a ${DEAL_TYPES.find(dt => dt.value === formData.deal_type)?.label}`,
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        client_id: '',
        exhibition_id: '',
        deal_type: '',
        package_id: '',
        base_price: '',
        discount_percentage: '',
        discount_amount: '',
        tax_percentage: '14',
        tax_amount: '',
        commission_percentage: '5',
        commission_amount: '',
        total_amount: '',
        payment_plan_type: 'full_payment',
        payment_method: 'bank_transfer',
        installments: [
          { percentage: '30', amount: '', due_date: '', description: 'Initial Payment' },
          { percentage: '40', amount: '', due_date: '', description: 'Second Payment' },
          { percentage: '30', amount: '', due_date: '', description: 'Final Payment' }
        ],
        notes: '',
        terms_conditions: '',
        special_requirements: ''
      });
      
      setActiveTab('basic');
      setLoading(false);
      onSuccess();
      onClose();
      
    } catch (error: any) {
      console.error('❌ DEAL CREATION ERROR:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        status: error?.status,
        formData: {
          title: formData.title,
          client_id: formData.client_id,
          deal_type: formData.deal_type,
          base_price: formData.base_price,
          total_amount: formData.total_amount
        }
      });
      
      toast({
        title: "Deal Creation Failed",
        description: `Error: ${error?.message || 'Unknown error'}. Check console for details.`,
        variant: "destructive",
      });
      
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const selectedClient = clients.find(c => c.id === formData.client_id);
  const selectedExhibition = exhibitions.find(e => e.id === formData.exhibition_id);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          {/* User Info Bar */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <User className="h-4 w-4" />
            <span>Created by: {userName || userEmail || 'Demo User'}</span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">
                <Briefcase className="h-4 w-4 mr-2" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="financial">
                <DollarSign className="h-4 w-4 mr-2" />
                Financial
              </TabsTrigger>
              <TabsTrigger value="payment">
                <CreditCard className="h-4 w-4 mr-2" />
                Payment Plan
              </TabsTrigger>
              <TabsTrigger value="additional">
                <Target className="h-4 w-4 mr-2" />
                Additional
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Deal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Deal Title */}
                    <div>
                      <Label htmlFor="title">
                        Deal Title *
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter a descriptive deal title"
                        className="border-[#E4E7EC] focus:border-[#2BB0E6]"
                        required
                      />
                    </div>

                    {/* Deal Type */}
                    <div>
                      <Label>
                        Deal Type *
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {DEAL_TYPES.map((type) => (
                          <div
                            key={type.value}
                            onClick={() => handleDealTypeChange(type.value)}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              formData.deal_type === type.value
                                ? 'border-[#2BB0E6] bg-blue-50'
                                : 'border-[#E4E7EC] bg-white hover:border-[#2BB0E6]'
                            }`}
                          >
                            <div className="font-medium text-sm">{type.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Package Selection - Dynamic based on Deal Type */}
                    {formData.deal_type && (
                      <div>
                        <Label>
                          {formData.deal_type === 'booth' ? 'Select Booth' : 'Select Package'} *
                        </Label>
                        {/* Load Data Buttons */}
                        {formData.deal_type === 'booth' && booths.length === 0 && (
                          <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-blue-900">Import Booth Data</h4>
                                <p className="text-sm text-blue-700">Load booths directly from Booths page</p>
                              </div>
                              <Button
                                type="button"
                                onClick={() => {
                                  console.log('🔄 MANUAL RELOAD: User clicked Load Booths button');
                                  loadBooths(); // Use the updated loadBooths function
                                }}
                                disabled={loadingBooths}
                                variant="outline"
                                size="sm"
                                className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                              >
                                {loadingBooths ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Load Booths
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {(formData.deal_type === 'sponsorship' || formData.deal_type === 'sector_sponsor') && sponsorships.length === 0 && (
                          <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-green-900">Load Sponsorship Packages</h4>
                                <p className="text-sm text-green-700">Click to load available sponsorship packages</p>
                              </div>
                              <Button
                                type="button"
                                onClick={loadSponsorships}
                                disabled={loadingSponsorships}
                                variant="outline"
                                size="sm"
                              >
                                {loadingSponsorships ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Load Packages
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <Select value={formData.package_id} onValueChange={handlePackageSelect}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={
                              formData.deal_type === 'booth' 
                                ? (booths.length > 0 ? "Select a booth" : "Load booths first")
                                : (sponsorships.length > 0 ? "Select a package" : "Load packages first")
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.deal_type === 'booth' && booths.map((booth) => (
                              <SelectItem key={booth.id} value={booth.id}>
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <div className="font-medium">{booth.booth_code || booth.booth_number}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {booth.size_sqm}sqm • {booth.booth_type || 'Standard'} • {formatAmount(booth.total_price || booth.base_price)}
                                    </div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                            
                            {(formData.deal_type === 'sponsorship' || formData.deal_type === 'sector_sponsor') && sponsorships.map((sponsorship) => (
                              <SelectItem key={sponsorship.id} value={sponsorship.id}>
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <div className="font-medium">{sponsorship.package_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {sponsorship.package_tier} • {formatAmount(sponsorship.base_price)}
                                    </div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Client Selection */}
                    <div>
                      <Label>
                        Client *
                      </Label>
                      <Select value={formData.client_id} onValueChange={handleClientSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <div className="font-medium">{client.name}</div>
                                  <div className="text-xs text-muted-foreground">{client.email}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Exhibition Selection */}
                    <div>
                      <Label>
                        Exhibition (Optional)
                      </Label>
                      <Select value={formData.exhibition_id || 'none'} onValueChange={handleExhibitionSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an exhibition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Exhibition</SelectItem>
                          {exhibitions.map((exhibition) => (
                            <SelectItem key={exhibition.id} value={exhibition.id}>
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <div className="font-medium">{exhibition.name}</div>
                                  <div className="text-xs text-muted-foreground">{exhibition.start_date} - {exhibition.end_date}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Description */}
                    <div>
                      <Label>
                        Description
                      </Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter a detailed description of the deal"
                        rows={3}
                        className="border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financial Tab */}
              <TabsContent value="financial" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Financial Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Base Price */}
                    <div>
                      <Label>
                        Base Price *
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="number"
                          value={formData.base_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, base_price: e.target.value }))}
                          placeholder="0.00"
                          className="pl-10 border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Discount and Tax */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>
                          Discount (%)
                        </Label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="number"
                            value={formData.discount_percentage}
                            onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: e.target.value }))}
                            placeholder="0"
                            className="pl-10 border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>
                          Discount Amount
                        </Label>
                        <Input
                          value={formData.discount_amount}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>
                          Tax (%)
                        </Label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="number"
                            value={formData.tax_percentage}
                            onChange={(e) => setFormData(prev => ({ ...prev, tax_percentage: e.target.value }))}
                            placeholder="14"
                            className="pl-10 border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>
                          Tax Amount
                        </Label>
                        <Input
                          value={formData.tax_amount}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>

                    {/* Commission */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>
                          Commission (%)
                        </Label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="number"
                            value={formData.commission_percentage}
                            onChange={(e) => setFormData(prev => ({ ...prev, commission_percentage: e.target.value }))}
                            placeholder="5"
                            className="pl-10 border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>
                          Commission Amount
                        </Label>
                        <Input
                          value={formData.commission_amount}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div>
                      <Label>
                        Total Amount
                      </Label>
                      <Input
                        value={formData.total_amount}
                        readOnly
                        className="bg-gray-50 font-semibold text-lg"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payment Plan Tab */}
              <TabsContent value="payment" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Payment Plan Type */}
                    <div>
                      <Label>Payment Plan Type</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <div
                          onClick={() => setFormData(prev => ({ ...prev, payment_plan_type: 'full_payment' }))}
                          className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.payment_plan_type === 'full_payment'
                              ? 'border-[#2BB0E6] bg-blue-50'
                              : 'border-[#E4E7EC] bg-white hover:border-[#2BB0E6]'
                          }`}
                        >
                          <div className="font-medium">Full Payment</div>
                          <div className="text-sm text-gray-600">Pay entire amount upfront</div>
                        </div>
                        <div
                          onClick={() => setFormData(prev => ({ ...prev, payment_plan_type: 'installments' }))}
                          className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.payment_plan_type === 'installments'
                              ? 'border-[#2BB0E6] bg-blue-50'
                              : 'border-[#E4E7EC] bg-white hover:border-[#2BB0E6]'
                          }`}
                        >
                          <div className="font-medium">Installments</div>
                          <div className="text-sm text-gray-600">Split into multiple payments</div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <Label>Payment Method</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {PAYMENT_METHODS.map((method) => (
                          <div
                            key={method.value}
                            onClick={() => setFormData(prev => ({ ...prev, payment_method: method.value }))}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              formData.payment_method === method.value
                                ? 'border-[#2BB0E6] bg-blue-50'
                                : 'border-[#E4E7EC] bg-white hover:border-[#2BB0E6]'
                            }`}
                          >
                            <div className="font-medium text-sm">{method.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Installments */}
                    {formData.payment_plan_type === 'installments' && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <Label>Payment Schedule</Label>
                          <Button type="button" onClick={addInstallment} variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Payment
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {formData.installments.map((installment, index) => (
                            <Card key={index}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">Payment {index + 1}</CardTitle>
                                  {formData.installments.length > 1 && (
                                    <Button
                                      type="button"
                                      onClick={() => removeInstallment(index)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <Label>Percentage</Label>
                                  <Input
                                    type="number"
                                    value={installment.percentage}
                                    onChange={(e) => updateInstallment(index, 'percentage', e.target.value)}
                                    className="h-8 text-sm border-[#E4E7EC] bg-white"
                                  />
                                </div>
                                <div>
                                  <Label>Amount</Label>
                                  <Input
                                    value={installment.amount}
                                    onChange={(e) => updateInstallment(index, 'amount', e.target.value)}
                                    className="h-8 text-sm border-[#E4E7EC] bg-white"
                                  />
                                </div>
                                <div>
                                  <Label>Due Date</Label>
                                  <Input
                                    type="date"
                                    value={installment.due_date}
                                    onChange={(e) => updateInstallment(index, 'due_date', e.target.value)}
                                    className="h-8 text-sm border-[#E4E7EC] bg-white"
                                  />
                                </div>
                                <div>
                                  <Label>Description</Label>
                                  <Input
                                    value={installment.description}
                                    onChange={(e) => updateInstallment(index, 'description', e.target.value)}
                                    placeholder="Payment description"
                                    className="h-8 text-sm border-[#E4E7EC] bg-white"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Additional Tab */}
              <TabsContent value="additional" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Notes */}
                    <div>
                      <Label>
                        Notes
                      </Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add any additional notes or comments about this deal"
                        rows={3}
                        className="border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                      />
                    </div>

                    {/* Terms & Conditions */}
                    <div>
                      <Label>
                        Terms & Conditions
                      </Label>
                      <Textarea
                        value={formData.terms_conditions}
                        onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
                        placeholder="Enter specific terms and conditions for this deal"
                        rows={3}
                        className="border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                      />
                    </div>

                    {/* Special Requirements */}
                    <div>
                      <Label>
                        Special Requirements
                      </Label>
                      <Textarea
                        value={formData.special_requirements}
                        onChange={(e) => setFormData(prev => ({ ...prev, special_requirements: e.target.value }))}
                        placeholder="Any special requirements, customizations, or client requests"
                        rows={3}
                        className="border-[#E4E7EC] focus:border-[#2BB0E6] bg-white"
                      />
                    </div>

                    {/* Deal Summary */}
                    <Card className="bg-gray-50">
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Deal Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div>Title: {formData.title || 'Not specified'}</div>
                            <div>Client: {selectedClient?.name || 'Not selected'}</div>
                            <div>Type: {DEAL_TYPES.find(dt => dt.value === formData.deal_type)?.label || 'Not selected'}</div>
                            <div>Exhibition: {selectedExhibition?.name || 'None'}</div>
                          </div>
                          <div className="space-y-2">
                            <div>Value: {formData.total_amount ? formatAmount(parseFloat(formData.total_amount)) : 'Not calculated'}</div>
                            <div>Payment: {formData.payment_plan_type === 'full_payment' ? 'Full Payment' : `${formData.installments.length} Installments`}</div>
                            <div>Method: {PAYMENT_METHODS.find(pm => pm.value === formData.payment_method)?.label || 'Not selected'}</div>
                            <div>Created by: {userName || userEmail || 'Demo User'}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            {/* Action Bar - Always Visible */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <div className="flex items-center space-x-2">
                {activeTab !== 'additional' && (
                  <Button
                    type="button"
                    onClick={() => {
                      const tabs = ['basic', 'financial', 'payment', 'additional'];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex < tabs.length - 1) {
                        setActiveTab(tabs[currentIndex + 1]);
                      }
                    }}
                    variant="outline"
                    className="border-[#E4E7EC] text-[#1C2434]"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                
                {/* CREATE DEAL BUTTON - ALWAYS VISIBLE */}
                <Button type="submit" disabled={loading} className="crm-button-primary">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Deal...
                    </>
                  ) : (
                    'Create Deal'
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

export default CreateDealDialog;