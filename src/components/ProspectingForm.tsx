import { useState, useEffect } from "react";
import { Lead } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SearchResult } from "@/types/search";
import { DashboardStats } from "./DashboardStats";
import { supabase } from "@/integrations/supabase/client";
import { TrialStatusBanner } from "./shared/TrialStatusBanner";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { SearchResults } from "./SearchResults";
import { SearchForm } from "./SearchForm";

interface ProspectingFormProps {
  onAddLeads: (leads: Lead[]) => void;
  searchType?: "places" | "websites";
}

export function ProspectingForm({ onAddLeads, searchType }: ProspectingFormProps) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { isTrialValid, checkLeadLimit, isFreePlan } = useTrialStatus(userProfile);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUserProfile(profile);
        }
      }
    };

    fetchUserProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search initiated with:", { query, location, searchType });
    
    if (!query.trim()) {
      toast({
        title: t("error"),
        description: t("searchTermRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!checkLeadLimit()) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const extractionDate = userProfile?.last_extraction_reset;
      const shouldResetCount = !extractionDate || 
        new Date(extractionDate).getMonth() !== currentMonth || 
        new Date(extractionDate).getFullYear() !== currentYear;

      if (shouldResetCount) {
        // Reset the counter for the new month
        if (userProfile) {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              extracted_leads_count: 0,
              last_extraction_reset: new Date().toISOString()
            })
            .eq('id', userProfile.id);

          if (error) {
            console.error('Error resetting extracted_leads_count:', error);
          }
        }
      } else {
        toast({
          title: "Limite atingido",
          description: "Você atingiu o limite de 10 leads para este mês no plano gratuito. Faça upgrade para continuar.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const functionName = searchType === "places" ? "google-places-search" : "google-custom-search";
      console.log(`Calling ${functionName} function with:`, { query, location });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: JSON.stringify({
          query: query.trim(),
          location: location.trim()
        })
      });

      console.log("Function response:", { data, error });

      if (error) {
        console.error(`Error in ${functionName}:`, error);
        throw error;
      }

      if (!data || !data.results) {
        console.error("Invalid response format:", data);
        throw new Error('Invalid response format');
      }

      const limitedResults = isFreePlan
        ? data.results.slice(0, 10)
        : data.results;

      console.log('Setting results:', limitedResults);
      setResults(limitedResults);

      if (limitedResults.length === 0) {
        toast({
          title: t("noResults"),
          description: t("tryDifferentSearch")
        });
      } else {
        toast({
          title: t("success"),
          description: isFreePlan
            ? `${limitedResults.length} resultados encontrados (limite do plano gratuito)`
            : `${limitedResults.length} resultados encontrados`
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("searchError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToLeads = async (selectedResults: SearchResult[]) => {
    if (!checkLeadLimit()) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const extractionDate = userProfile?.last_extraction_reset;
      const shouldResetCount = !extractionDate || 
        new Date(extractionDate).getMonth() !== currentMonth || 
        new Date(extractionDate).getFullYear() !== currentYear;

      if (shouldResetCount) {
        // Reset the counter for the new month
        if (userProfile) {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              extracted_leads_count: 0,
              last_extraction_reset: new Date().toISOString()
            })
            .eq('id', userProfile.id);

          if (error) {
            console.error('Error resetting extracted_leads_count:', error);
          }
        }
      } else {
        toast({
          title: "Limite atingido",
          description: "Você atingiu o limite de 10 leads para este mês no plano gratuito. Faça upgrade para continuar.",
          variant: "destructive",
        });
        return;
      }
    }

    const remainingLeads = isFreePlan ? 10 - (userProfile.extracted_leads_count || 0) : selectedResults.length;
    const leadsToAdd = selectedResults.slice(0, remainingLeads);

    const newLeads: Lead[] = leadsToAdd.map(result => ({
      id: crypto.randomUUID(),
      company_name: result.companyName || result.name || '',
      industry: result.category || null,
      location: result.location || null,
      contact_name: null,
      email: result.email || null,
      phone: result.phone || null,
      website: result.website || null,
      address: result.address || null,
      type: searchType === "places" ? "place" : "website",
      rating: result.rating || 0,
      user_ratings_total: result.user_ratings_total || 0,
      created_at: new Date().toISOString(),
      status: "new",
      deal_value: 0,
      tags: [],
    }));

    onAddLeads(newLeads);
    
    if (userProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          extracted_leads_count: (userProfile.extracted_leads_count || 0) + newLeads.length 
        })
        .eq('id', userProfile.id);

      if (error) {
        console.error('Error updating extracted_leads_count:', error);
      }
    }

    toast({
      title: t("success"),
      description: t("leadsAdded")
    });
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="p-6">
        <TrialStatusBanner userProfile={userProfile} />

        <SearchForm
          industry={query}
          location={location}
          isLoading={isLoading}
          searchType={searchType || "places"}
          onIndustryChange={setQuery}
          onLocationChange={setLocation}
          onSubmit={handleSubmit}
        />
      </Card>

      {results.length > 0 && (
        <>
          <DashboardStats results={results} searchType={searchType} />
          <SearchResults 
            results={results} 
            onAddLeads={handleAddToLeads} 
            searchQuery={query}
          />
        </>
      )}
    </div>
  );
}