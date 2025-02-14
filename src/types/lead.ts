export interface Lead {
  id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  extraction_date?: string;
  type?: 'website' | 'place' | 'manual';
  rating?: number;
  user_ratings_total?: number;
  opening_date?: string;
  website?: string;
  address?: string;
  created_at?: string;
  user_id?: string;
  notes?: string | null;
  status: 'new' | 'qualified' | 'unqualified' | 'open';
  deal_value: number;
  tags: string[];
  last_interaction_at?: string;
  stage?: string;
  kanban_order?: number;
}