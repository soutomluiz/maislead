import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lead } from "@/types/lead";
import { Card } from "@/components/ui/card";
import { LeadScore } from "@/components/leads/LeadScore";
import { Award, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const fetchLeads = async () => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(lead => ({
    ...lead,
    type: (lead.type || 'manual') as 'website' | 'place' | 'manual',
    status: (lead.status || 'new') as 'new' | 'qualified' | 'unqualified' | 'open',
    deal_value: lead.deal_value || 0,
    tags: lead.tags || []
  }));
};

export function LeadScorePage() {
  const { toast } = useToast();
  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['leads-score'],
    queryFn: fetchLeads,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    toast({
      title: "Erro ao carregar leads",
      description: "Não foi possível carregar os scores dos leads.",
      variant: "destructive",
    });
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Award className="h-12 w-12 mb-4" />
        <p>Erro ao carregar scores</p>
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Award className="h-12 w-12 mb-4" />
        <p>Nenhum lead encontrado para pontuação</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {leads.map((lead) => (
        <Card key={lead.id} className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-medium">{lead.company_name}</h3>
              <p className="text-sm text-muted-foreground">{lead.industry || 'Indústria não especificada'}</p>
            </div>
          </div>
          <LeadScore lead={lead} />
        </Card>
      ))}
    </div>
  );
}