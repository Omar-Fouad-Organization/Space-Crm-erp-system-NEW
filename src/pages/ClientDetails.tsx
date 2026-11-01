import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api} from '@/crm/api';
import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Ticket,
  Activity
} from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();

  const [client,setClient]=React.useState<any>(null);const [linkedDeals,setLinkedDeals]=React.useState<any[]>([]);
  React.useEffect(()=>{Promise.all([apiAll('clients'),apiAll('deals')]).then(([clients,deals])=>{const c=clients.find(c=>c.id===id);if(c)setClient({...c,client_type:c.type,primary_contact:{name:c.contact_person,email:c.email,phone:c.phone,position:c.position||''}});setLinkedDeals(deals.filter(d=>d.client_id===id));});},[id]);
  if(!client)return <div role="status">Loading client…</div>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div className="flex items-center space-x-4">

          <div className="p-3 bg-blue-100 rounded-lg">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>

          <div>

            <h1 className="text-3xl font-bold text-gray-900">
              {client.company_name}
            </h1>

            <div className="flex items-center space-x-4 mt-2">
              <Badge variant="outline" className="capitalize">
                {client.client_type.replace('_', ' ')}
              </Badge>
              <span className="text-gray-600">{client.industry}</span>
              <div className="flex items-center text-gray-600">
                <MapPin className="h-4 w-4 mr-1" />
                {client.country}
              </div>
            </div>

          </div>

        </div>

        <div className="flex space-x-3">

          <Button variant="outline">Edit Client</Button>
          <Button>Create Deal</Button>

        </div>

      </div>

      {/* Client Details Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Primary Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                <div>
                  <p className="font-medium text-gray-900">{client.primary_contact.name}</p>
                  <p className="text-sm text-gray-600">{client.primary_contact.position}</p>
                </div>

                <div className="space-y-2">

                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{client.primary_contact.email}</span>
                  </div>

                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{client.primary_contact.phone}</span>
                  </div>

                </div>

              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                <div className="flex justify-between">
                  <span className="text-gray-600">Active Deals</span>
                  <span className="font-semibold">{linkedDeals.filter(d=>!['closed_won','closed_lost','cancelled'].includes(d.stage)).length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Total Value</span>
                  <span className="font-semibold">{linkedDeals.reduce((sum,d)=>sum+d.deal_value,0).toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Last Activity</span>
                  <span className="font-semibold">{String(client.updated_at||client.created_at).slice(0,10)}</span>
                </div>

              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                <div className="space-y-3">

                  <div className="flex items-start space-x-3">

                    <div className="p-1 bg-blue-100 rounded">
                      <DollarSign className="h-3 w-3 text-blue-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Deal updated</p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>

                  </div>

                  <div className="flex items-start space-x-3">

                    <div className="p-1 bg-green-100 rounded">
                      <DollarSign className="h-3 w-3 text-green-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Payment received</p>
                      <p className="text-xs text-gray-500">1 day ago</p>
                    </div>

                  </div>

                </div>

              </CardContent>
            </Card>
          </div>

        </TabsContent>
        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle>Client Deals</CardTitle>
              <CardDescription>All deals associated with this client</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Deal management interface would be here...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Payment records and upcoming payments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Payment tracking interface would be here...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Proposals, contracts, and other documents</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Document management interface would be here...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>Client support requests and issues</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Ticket management interface would be here...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Complete activity history for this client</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Activity timeline would be here...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

  );
}