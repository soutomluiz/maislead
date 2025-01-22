import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lead } from "@/types/lead";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ExtractionEfficiencyChart } from "./ExtractionEfficiencyChart";
import { IndustryDistributionChart } from "./IndustryDistributionChart";
import { ActivityTimelineChart } from "./ActivityTimelineChart";
import { ReportsFilters } from "./ReportsFilters";
import { DealMetricsCard } from "./DealMetricsCard";
import { TagsDistributionChart } from "./TagsDistributionChart";
import { startOfDay, subDays, subWeeks, subMonths, parseISO } from 'date-fns';

export function ReportsPage() {
  const [filters, setFilters] = useState({
    dateRange: "month" as "today" | "week" | "month" | "custom",
    customDate: undefined as Date | undefined,
    leadType: "all",
    leadStatus: "all"
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-reports', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    }
  });

  const filteredLeads = leads.filter(lead => {
    const createdAt = lead.created_at ? parseISO(lead.created_at) : null;
    if (!createdAt) return false;

    // Filtro de data
    let startDate;
    if (filters.dateRange === "today") {
      startDate = startOfDay(new Date());
    } else if (filters.dateRange === "week") {
      startDate = subWeeks(new Date(), 1);
    } else if (filters.dateRange === "month") {
      startDate = subMonths(new Date(), 1);
    } else if (filters.dateRange === "custom" && filters.customDate) {
      startDate = startOfDay(filters.customDate);
    } else {
      startDate = subMonths(new Date(), 1); // Default para último mês
    }

    const passesDateFilter = createdAt >= startDate;
    const passesTypeFilter = filters.leadType === "all" || lead.type === filters.leadType;
    const passesStatusFilter = filters.leadStatus === "all" || lead.status === filters.leadStatus;

    return passesDateFilter && passesTypeFilter && passesStatusFilter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <ReportsFilters onFilterChange={setFilters} currentFilters={filters} />

      <div className="grid gap-4 md:grid-cols-2">
        <DealMetricsCard leads={filteredLeads} />
        <TagsDistributionChart leads={filteredLeads} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Eficiência de Extração</h3>
          <div className="h-[300px]">
            <ExtractionEfficiencyChart leads={filteredLeads} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Indústria</h3>
          <div className="h-[300px]">
            <IndustryDistributionChart leads={filteredLeads} />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Timeline de Atividade</h3>
        <div className="h-[300px]">
          <ActivityTimelineChart leads={filteredLeads} />
        </div>
      </Card>
    </div>
  );
}