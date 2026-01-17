import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { DashboardKPI, Deal, DealStatus } from '@/types';

// Mock data for demonstration
const kpiData: DashboardKPI[] = [
  {
    label: 'Total Revenue',
    value: '$2,847,500',
    change: 12.5,
    trend: 'up',
    format: 'currency'
  },
  {
    label: 'Active Deals',
    value: '47',
    change: -3.2,
    trend: 'down',
    format: 'number'
  },
  {
    label: 'Conversion Rate',
    value: '68.4%',
    change: 5.1,
    trend: 'up',
    format: 'percentage'
  },
  {
    label: 'Active Clients',
    value: '234',
    change: 8.7,
    trend: 'up',
    format: 'number'
  }
];

const revenueData = [
  { month: 'Jan', revenue: 245000, deals: 12 },
  { month: 'Feb', revenue: 289000, deals: 15 },
  { month: 'Mar', revenue: 324000, deals: 18 },
  { month: 'Apr', revenue: 378000, deals: 22 },
  { month: 'May', revenue: 445000, deals: 28 },
  { month: 'Jun', revenue: 512000, deals: 31 }
];

const dealStatusData = [
  { name: 'Lead Created', value: 15, color: '#E4E7EC' },
  { name: 'Talking', value: 12, color: '#2BB0E6' },
  { name: 'Meeting', value: 8, color: '#10B981' },
  { name: 'Strategy Proposal', value: 6, color: '#F59E0B' },
  { name: 'Terms Finalized', value: 4, color: '#8B5CF6' },
  { name: 'Closed Won', value: 18, color: '#059669' }
];

const topDeals = [
  {
    id: '1',
    name: 'Tech Expo 2024 - Premium Booth',
    client: 'TechCorp Solutions',
    value: 125000,
    status: 'terms_finalized' as DealStatus,
    probability: 85,
    close_date: '2024-02-15'
  },
  {
    id: '2',
    name: 'Healthcare Summit - Platinum Sponsorship',
    client: 'MedTech Industries',
    value: 89000,
    status: 'strategy_proposal' as DealStatus,
    probability: 70,
    close_date: '2024-02-20'
  },
  {
    id: '3',
    name: 'Green Energy Expo - Gold Package',
    client: 'EcoSolutions Ltd',
    value: 67000,
    status: 'meeting' as DealStatus,
    probability: 60,
    close_date: '2024-02-28'
  }
];

const upcomingTasks = [
  {
    id: '1',
    title: 'Follow up with TechCorp on contract terms',
    due_date: '2024-01-18',
    priority: 'high' as const,
    deal: 'Tech Expo 2024'
  },
  {
    id: '2',
    title: 'Prepare proposal for MedTech Industries',
    due_date: '2024-01-19',
    priority: 'medium' as const,
    deal: 'Healthcare Summit'
  },
  {
    id: '3',
    title: 'Schedule meeting with EcoSolutions',
    due_date: '2024-01-20',
    priority: 'medium' as const,
    deal: 'Green Energy Expo'
  }
];

const getStatusColor = (status: DealStatus) => {
  const colors = {
    lead_created: 'bg-gray-100 text-gray-800',
    talking: 'bg-blue-100 text-blue-800',
    meeting: 'bg-green-100 text-green-800',
    strategy_proposal: 'bg-yellow-100 text-yellow-800',
    objection_handling: 'bg-orange-100 text-orange-800',
    terms_finalized: 'bg-purple-100 text-purple-800',
    closed_won: 'bg-emerald-100 text-emerald-800',
    closed_lost: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getPriorityColor = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
  const colors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return colors[priority];
};

export default function Dashboard() {
  const [selectedExpo, setSelectedExpo] = useState('all');
  const [dateRange, setDateRange] = useState('6m');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Dashboard</h1>
          <p className="text-crm-secondary-text">Welcome back! Here's what's happening with your business.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={selectedExpo} onValueChange={setSelectedExpo}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Expo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Expos</SelectItem>
              <SelectItem value="tech-expo-2024">Tech Expo 2024</SelectItem>
              <SelectItem value="healthcare-summit">Healthcare Summit</SelectItem>
              <SelectItem value="green-energy-expo">Green Energy Expo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 Month</SelectItem>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => (
          <Card key={index} className="crm-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-crm-secondary-text">{kpi.label}</p>
                  <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{kpi.value}</p>
                </div>
                <div className={`flex items-center space-x-1 text-sm ${
                  kpi.trend === 'up' ? 'text-crm-success' : 'text-crm-error'
                }`}>
                  {kpi.trend === 'up' ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span>{Math.abs(kpi.change || 0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="crm-card">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue and deal count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="month" stroke="#667085" />
                <YAxis stroke="#667085" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E4E7EC',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#2BB0E6" 
                  fill="#2BB0E6" 
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Deal Status Distribution */}
        <Card className="crm-card">
          <CardHeader>
            <CardTitle>Deal Pipeline</CardTitle>
            <CardDescription>Current deal status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dealStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {dealStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {dealStatusData.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-crm-secondary-text">{item.name}</span>
                  <span className="text-xs font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Deals */}
        <Card className="crm-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Deals</CardTitle>
              <CardDescription>Highest value deals in pipeline</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDeals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-3 border border-crm-border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-crm-primary-text">{deal.name}</h4>
                    <p className="text-sm text-crm-secondary-text">{deal.client}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge className={getStatusColor(deal.status)}>
                        {deal.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-crm-secondary-text">
                        {deal.probability}% probability
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-crm-primary-text font-tabular">
                      ${deal.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-crm-secondary-text">{deal.close_date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="crm-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Tasks</CardTitle>
              <CardDescription>Tasks due in the next few days</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 border border-crm-border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-crm-primary-text">{task.title}</h4>
                    <p className="text-sm text-crm-secondary-text">{task.deal}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-crm-secondary-text">
                        Due: {task.due_date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}