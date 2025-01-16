import { useState } from "react";
import { LeadForm } from "@/components/LeadForm";
import { LeadTable } from "@/components/LeadTable";
import { DashboardStats } from "@/components/Dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Lead {
  id: number;
  companyName: string;
  industry: string;
  location: string;
  contactName: string;
  email: string;
  phone: string;
}

const Index = () => {
  const [leads, setLeads] = useState<Lead[]>([]);

  const handleAddLead = (data: Omit<Lead, "id">) => {
    const newLead = {
      ...data,
      id: leads.length + 1,
    };
    setLeads([...leads, newLead]);
  };

  const uniqueLocations = new Set(leads.map((lead) => lead.location)).size;
  const uniqueIndustries = new Set(leads.map((lead) => lead.industry)).size;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-center mb-8 animate-fadeIn">
          Lead Management Dashboard
        </h1>

        <DashboardStats
          totalLeads={leads.length}
          uniqueLocations={uniqueLocations}
          uniqueIndustries={uniqueIndustries}
        />

        <Tabs defaultValue="table" className="w-full animate-fadeIn">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="table">View Leads</TabsTrigger>
            <TabsTrigger value="form">Add Lead</TabsTrigger>
          </TabsList>
          <TabsContent value="table" className="mt-6">
            <LeadTable leads={leads} />
          </TabsContent>
          <TabsContent value="form" className="mt-6">
            <div className="flex justify-center">
              <LeadForm onSubmit={handleAddLead} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;