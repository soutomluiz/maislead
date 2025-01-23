import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SearchForm } from "./SearchForm";
import { SearchResults } from "./SearchResults";
import { DashboardStats } from "./DashboardStats";
import { SearchResult } from "@/types/search";
import { useNavigate } from "react-router-dom";
import { AdvancedSearchForm } from "./search/AdvancedSearchForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const ProspectingForm = ({
  onAddLeads,
  searchType = "places"
}: {
  onAddLeads: (leads: any[]) => void;
  searchType?: "places" | "websites";
}) => {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const capitalizeFirstLetter = (string: string) => {
    return string.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const handleAdvancedSearch = async (params: {
    type: 'competitors' | 'opportunities',
    industry?: string,
    location?: string,
    radius?: number
  }) => {
    setIsLoading(true);
    const capitalizedLocation = params.location ? capitalizeFirstLetter(params.location) : '';
    const searchQuery = `${params.industry} em ${capitalizedLocation}`;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Autenticação necessária",
          description: "Por favor, faça login para continuar.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "google-places-search",
        {
          body: {
            query: searchQuery,
            type: params.type,
            radius: params.radius
          },
        }
      );

      if (error) throw error;

      if (data.status === "REQUEST_DENIED") {
        throw new Error("Erro na configuração da API do Google Maps");
      }

      if (data.results && Array.isArray(data.results)) {
        const formattedResults: SearchResult[] = data.results
          .map((result: any) => ({
            title: result.name,
            link: `https://www.google.com/maps/place/?q=place_id:${result.place_id}`,
            description: result.formatted_address || "Endereço não disponível",
            companyName: result.name,
            address: result.formatted_address || "",
            phone: result.formatted_phone_number || "",
            email: "",
            keyword: params.industry || "",
            city: capitalizedLocation,
            extractionDate: new Date().toISOString(),
            rating: result.rating,
            user_ratings_total: result.user_ratings_total,
            opening_date: result.opening_hours?.weekday_text?.[0] || "",
            website: result.website || "",
            type: "place",
            hasWebPresence: !!result.website || result.rating > 0
          }))
          .filter(result => {
            if (params.type === 'opportunities') {
              return !result.hasWebPresence;
            }
            return true;
          });

        setResults(formattedResults);
        
        toast({
          title: "Busca realizada com sucesso",
          description: `Encontrados ${formattedResults.length} resultados`,
        });
      }
    } catch (error) {
      console.error("Erro na busca:", error);
      toast({
        title: "Erro na busca",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível realizar a busca. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBasicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const capitalizedLocation = capitalizeFirstLetter(location);
    const searchQuery = `${industry} em ${capitalizedLocation}`;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Autenticação necessária",
          description: "Por favor, faça login para continuar.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      if (searchType === "places") {
        const { data, error } = await supabase.functions.invoke(
          "google-places-search",
          {
            body: {
              query: searchQuery
            },
          }
        );

        if (error) throw error;

        if (data.status === "REQUEST_DENIED") {
          throw new Error("Erro na configuração da API do Google Maps");
        }

        if (data.results && Array.isArray(data.results)) {
          const formattedResults: SearchResult[] = data.results.map((result: any) => ({
            title: result.name,
            link: `https://www.google.com/maps/place/?q=place_id:${result.place_id}`,
            description: result.formatted_address || "Endereço não disponível",
            companyName: result.name,
            address: result.formatted_address || "",
            phone: result.formatted_phone_number || "",
            email: "",
            keyword: industry,
            city: capitalizedLocation,
            extractionDate: new Date().toISOString(),
            rating: result.rating,
            user_ratings_total: result.user_ratings_total,
            opening_date: result.opening_hours?.weekday_text?.[0] || "",
            website: result.website || "",
            type: "place"
          }));

          setResults(formattedResults);
          
          toast({
            title: "Busca realizada com sucesso",
            description: `Encontrados ${formattedResults.length} resultados`,
          });
        }
      } else {
        const { data, error } = await supabase.functions.invoke(
          "google-custom-search",
          {
            body: {
              query: searchQuery,
            },
          }
        );

        if (error) throw error;

        if (data.results) {
          const formattedResults = data.results.map((result: SearchResult) => ({
            ...result,
            city: capitalizedLocation
          }));
          setResults(formattedResults);
          toast({
            title: "Busca realizada com sucesso",
            description: `Encontrados ${data.results.length} resultados`,
          });
        }
      }
    } catch (error) {
      console.error("Erro na busca:", error);
      toast({
        title: "Erro na busca",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível realizar a busca. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToLeads = async (selectedResults: SearchResult[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Autenticação necessária",
          description: "Por favor, faça login para salvar leads.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const newLeads = selectedResults.map((result) => ({
        company_name: result.companyName,
        industry: result.keyword,
        location: result.city,
        address: result.address || "",
        contact_name: "",
        email: result.email || "",
        phone: result.phone || "",
        extraction_date: result.extractionDate,
        type: searchType === "places" ? "place" : "website",
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        opening_date: result.opening_date || "",
        website: result.website || "",
        user_id: user.id
      }));

      const { error } = await supabase
        .from('leads')
        .insert(newLeads);

      if (error) throw error;

      onAddLeads(newLeads);
      toast({
        title: "Leads adicionados",
        description: `${newLeads.length} leads foram salvos com sucesso`,
      });
    } catch (error) {
      console.error("Erro ao salvar leads:", error);
      toast({
        title: "Erro ao salvar leads",
        description: "Não foi possível salvar os leads. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full p-6 animate-fadeIn">
      <DashboardStats results={results} searchType={searchType} />
      <div className="mt-6">
        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="basic">Busca Básica</TabsTrigger>
            <TabsTrigger value="advanced">Busca Avançada</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <SearchForm
              industry={industry}
              location={location}
              isLoading={isLoading}
              searchType={searchType}
              onIndustryChange={setIndustry}
              onLocationChange={setLocation}
              onSubmit={handleBasicSearch}
            />
          </TabsContent>

          <TabsContent value="advanced">
            <AdvancedSearchForm
              onSearch={handleAdvancedSearch}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
      <SearchResults results={results} onAddToLeads={handleAddToLeads} />
    </Card>
  );
};