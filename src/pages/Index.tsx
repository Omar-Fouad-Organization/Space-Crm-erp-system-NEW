import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const navigate = useNavigate();

  // Auto-redirect to CRM dashboard
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/crm/dashboard');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleEnterCRM = () => {
    navigate('/crm/dashboard');
  };

  return (
    <div className="min-h-screen bg-crm-background flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Building2 className="h-16 w-16 text-crm-accent" />
          </div>
          <h1 className="text-5xl font-bold text-crm-primary-text mb-4">
            SPACE CRM System
          </h1>
          <p className="text-xl text-crm-secondary-text mb-8">
            Enterprise-grade CRM for Space Organizing
          </p>
          <Button 
            onClick={handleEnterCRM}
            size="lg" 
            className="crm-button-primary text-lg px-8 py-3"
          >
            Enter CRM System
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="crm-card text-center">
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-crm-accent mx-auto mb-4" />
              <CardTitle>Deal Pipeline</CardTitle>
              <CardDescription>
                Complete sales pipeline management with automated workflows
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="crm-card text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-crm-accent mx-auto mb-4" />
              <CardTitle>Client Management</CardTitle>
              <CardDescription>
                Comprehensive client profiles with full interaction history
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="crm-card text-center">
            <CardHeader>
              <Calendar className="h-12 w-12 text-crm-accent mx-auto mb-4" />
              <CardTitle>Expo Management</CardTitle>
              <CardDescription>
                Multi-expo support with booth allocation and sponsorship tracking
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* System Features */}
        <Card className="crm-card">
          <CardHeader>
            <CardTitle className="text-center">Complete Enterprise Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-crm-primary-text">Core Modules</h4>
                <ul className="space-y-1 text-crm-secondary-text">
                  <li>• Dashboard & Analytics</li>
                  <li>• Expo Management</li>
                  <li>• Client Management</li>
                  <li>• Booth Management</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-crm-primary-text">Sales & Finance</h4>
                <ul className="space-y-1 text-crm-secondary-text">
                  <li>• Deals Pipeline</li>
                  <li>• Payment Tracking</li>
                  <li>• Commission Management</li>
                  <li>• Proposals & Contracts</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-crm-primary-text">Operations</h4>
                <ul className="space-y-1 text-crm-secondary-text">
                  <li>• Task Management</li>
                  <li>• Ticket System</li>
                  <li>• Internal Chat</li>
                  <li>• Document Management</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-crm-primary-text">Administration</h4>
                <ul className="space-y-1 text-crm-secondary-text">
                  <li>• User Management</li>
                  <li>• Role-based Access</li>
                  <li>• Audit Logs</li>
                  <li>• Client Portal</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-redirect notice */}
        <div className="text-center mt-8">
          <p className="text-sm text-crm-secondary-text">
            Automatically redirecting to CRM Dashboard in 3 seconds...
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
