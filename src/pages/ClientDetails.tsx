import {ActivityTimeline} from './WorkflowWorkspace';
import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api, money, type Detail} from '@/crm/api';
import {Link, useNavigate} from 'react-router-dom';
import {EditClientDialog} from '@/components/forms/EditClientDialog';
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

  const navigate=useNavigate();
  const [client,setClient]=React.useState<any>(null);
  const [linkedDeals,setLinkedDeals]=React.useState<any[]>([]);
  const [relations,setRelations]=React.useState<Record<string,any[]>>({});
  const [payments,setPayments]=React.useState<any[]|null>(null);
  const [error,setError]=React.useState('');
  const [editing,setEditing]=React.useState(false);
  const [reload,setReload]=React.useState(0);
  React.useEffect(()=>{
    let active=true;setClient(null);setRelations({});setPayments(null);setLinkedDeals([]);setError('');
    (async()=>{
      const detail=await api<Detail>('records/clients/'+id);
      const clients=await apiAll('clients');
      if(!active)return;
      const c=clients.find(c=>String(c.id)===String(id));
      if(!c)throw new Error('Client not available.');
      setClient({...c,client_type:c.type,primary_contact:{name:c.contact_person,email:c.email,phone:c.phone,position:c.position||''}});
      setRelations(detail.relations);setLinkedDeals(detail.relations.deals||[]);
      try {
        const [schedules,receipts]=await Promise.all([apiAll('payment_schedules'),apiAll('payments')]);
        const dealIds=new Set((detail.relations.deals||[]).map(d=>String(d.id)));
        const scheduleIds=new Set(schedules.filter(s=>dealIds.has(String(s.deal_id))).map(s=>String(s.id)));
        if(active && detail.relations.deals)setPayments(receipts.filter(p=>scheduleIds.has(String(p.payment_schedule_id))));
      } catch { /* Retain unavailable state when financial access is denied. */ }
    })().catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[id,reload]);
  if(error)return <div role="alert">{error}</div>;
  if(!client)return <div role="status">Loading client…</div>;
  const records=(rows:any[]|undefined|null,route:string)=>rows==null?<p className="text-gray-600">Related records unavailable.</p>:rows.length===0?<p className="text-gray-600">No records recorded.</p>:<div className="space-y-3">{rows.map(row=><div key={row.id} className="flex items-center justify-between"><Link className="text-blue-600" to={route==='deals'?'/deals/'+row.id:'/'+route}>{row.name||row.reference_number||'#'+row.id}</Link><span>{row.status||''}{row.amount!==undefined && row.currency?' · '+money(row.amount,row.currency):''}</span></div>)}</div>;

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

          <Button variant="outline" onClick={()=>setEditing(true)}>Edit Client</Button>
          <Button onClick={()=>navigate('/deals?create=1')}>Create Deal</Button>

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
                  <span className="font-semibold">{linkedDeals.filter(d=>!['closed_won','closed_lost','cancelled'].includes(d.status)).length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Total Value</span>
                  <span className="font-semibold">{Object.entries(linkedDeals.reduce((totals:Record<string,number>,d)=>{if(d.amount!==undefined && d.currency)totals[d.currency]=(totals[d.currency]||0)+Number(d.amount);return totals;},{})).map(([currency,total])=>money(total,currency)).join(' · ')||'Unavailable'}</span>
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
                {id&&<ActivityTimeline resource="clients" id={id}/>}
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
              {records(relations.deals,'deals')}
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
              {records(payments,'payments')}
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
              {records(relations.documents,'contracts')}
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
              {records(relations.tickets,'tickets')}
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
              {id&&<ActivityTimeline resource="clients" id={id}/>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <EditClientDialog isOpen={editing} onClose={()=>setEditing(false)} onSuccess={()=>setReload(v=>v+1)} client={client}/>
    </div>

  );
}