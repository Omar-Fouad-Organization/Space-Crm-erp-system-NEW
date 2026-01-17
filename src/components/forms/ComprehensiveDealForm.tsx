import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { dealService, type Deal, type Client, type Exhibition } from '@/services/supabaseService';

interface ComprehensiveDealFormProps {
  deal: Deal;
  clients: Client[];
  exhibitions: Exhibition[];
  onSuccess: (updatedDeal: Deal) => void;
  onCancel: () => void;
}

const ComprehensiveDealForm: React.FC<ComprehensiveDealFormProps> = ({
  deal,
  clients,
  exhibitions,
  onSuccess,
  onCancel
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [closeDate, setCloseDate] = useState<Date | undefined>(
    deal.close_date ? new Date(deal.close_date) : undefined
  );
  
  const [formData, setFormData] = useState({
    title: deal.title || '',
    description: deal.description || '',
    client_id: deal.client_id || '',
    deal_value: deal.deal_value?.toString() || '',
    status: deal.status || 'Talking',
    priority: deal.priority || 'Medium',
    exhibition_id: deal.exhibition_id || '',
    notes: deal.notes || '',
    assigned_to: deal.assigned_to || '',
    assigned_to_name: deal.assigned_to_name || ''
  });

  const handleInputChange = (field: string, value: string) => {
    // Handle special case for exhibition_id
    if (field === 'exhibition_id' && value === 'none') {
      value = '';
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Deal title is required",
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

    if (!formData.deal_value || parseFloat(formData.deal_value) <= 0) {
      toast({
        title: "Validation Error",
        description: "Deal value must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const updatedDeal: Partial<Deal> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        client_id: formData.client_id,
        deal_value: parseFloat(formData.deal_value),
        status: formData.status,
        stage: mapStatusToStage(formData.status),
        priority: formData.priority as 'High' | 'Medium' | 'Low',
        probability: calculateProbability(formData.status),
        close_date: closeDate?.toISOString(),
        exhibition_id: formData.exhibition_id || undefined,
        notes: formData.notes.trim() || undefined,
        assigned_to: formData.assigned_to || undefined,
        assigned_to_name: formData.assigned_to_name || undefined
      };

      const result = await dealService.update(deal.id, updatedDeal);
      
      toast({
        title: "Success",
        description: "Deal updated successfully",
      });
      
      onSuccess({ ...deal, ...result });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update deal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const mapStatusToStage = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'Talking': 'talking',
      'Meeting Scheduled': 'meeting_scheduled',
      'Proposal': 'strategy_proposal',
      'Negotiation': 'objection_handling',
      'Contract': 'terms_finalized',
      'Closed Won': 'closed_won',
      'Closed Lost': 'closed_lost',
      'Canceled': 'canceled',
    };
    return statusMap[status] || 'talking';
  };

  const calculateProbability = (status: string): number => {
    const probabilities: { [key: string]: number } = {
      'Talking': 10,
      'Meeting Scheduled': 25,
      'Proposal': 40,
      'Negotiation': 60,
      'Contract': 80,
      'Closed Won': 100,
      'Closed Lost': 0,
      'Canceled': 0,
    };
    return probabilities[status] || 10;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deal Overview */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Deal Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Created:</span>
              <span className="ml-2 font-medium">{new Date(deal.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Last Updated:</span>
              <span className="ml-2 font-medium">{new Date(deal.updated_at || deal.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Health Score:</span>
              <span className="ml-2 font-medium">{deal.health_score || 50}%</span>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Deal Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter deal title"
                required
              />
            </div>
            <div>
              <Label htmlFor="client">Client *</Label>
              <Select value={formData.client_id} onValueChange={(value) => handleInputChange('client_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {(clients || []).map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter deal description"
              rows={3}
            />
          </div>
        </div>

        {/* Deal Details */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Deal Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deal_value">Deal Value *</Label>
              <Input
                id="deal_value"
                type="number"
                value={formData.deal_value}
                onChange={(e) => handleInputChange('deal_value', e.target.value)}
                placeholder="Enter deal value"
                required
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Talking">Talking</SelectItem>
                  <SelectItem value="Meeting Scheduled">Meeting Scheduled</SelectItem>
                  <SelectItem value="Proposal">Proposal</SelectItem>
                  <SelectItem value="Negotiation">Negotiation</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Closed Won">Closed Won</SelectItem>
                  <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                  <SelectItem value="Canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exhibition">Exhibition</Label>
              <Select 
                value={formData.exhibition_id || 'none'} 
                onValueChange={(value) => handleInputChange('exhibition_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exhibition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Exhibition</SelectItem>
                  {(exhibitions || []).map((exhibition) => (
                    <SelectItem key={exhibition.id} value={exhibition.id}>
                      {exhibition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="close_date">Expected Close Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !closeDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {closeDate ? format(closeDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={closeDate}
                  onSelect={setCloseDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Assignment */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Assignment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assigned_to">Assigned To (ID)</Label>
              <Input
                id="assigned_to"
                value={formData.assigned_to}
                onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                placeholder="Enter user ID"
              />
            </div>
            <div>
              <Label htmlFor="assigned_to_name">Assigned To (Name)</Label>
              <Input
                id="assigned_to_name"
                value={formData.assigned_to_name}
                onChange={(e) => handleInputChange('assigned_to_name', e.target.value)}
                placeholder="Enter user name"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Additional Notes</h3>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add any additional notes about this deal..."
              rows={4}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Deal
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ComprehensiveDealForm;