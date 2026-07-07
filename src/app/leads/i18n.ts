import type { Lang } from "@/i18n/ml";

export interface LeadsStrings {
  searchPh: string; filters: string; status: string; industry: string; temperature: string;
  all: string; new: string; qualified: string; converted: string;
  hot: string; warm: string; cool: string;
  showing: string; of: string; selected: string; selectedOne: string;
  exportCsv: string; changeStatus: string; clearSel: string; clearFilters: string;
  company: string; contact: string; phone: string; scoreCol: string; noLeads: string;
  // detail drawer
  whyScore: string; verified: string; online: string; notFound: string; invalid: string;
  email: string; website: string; address: string; actions: string;
  whatsapp: string; call: string; site: string; sendEmail: string;
  notes: string; addNote: string; notePh: string; save: string; noNotes: string;
  pPhone: string; pEmail: string; pSite: string; pAddress: string; pNiche: string;
}

export const leadsI18n: Record<Lang, LeadsStrings> = {
  pt: {
    searchPh: "Buscar por empresa, contato, telefone...", filters: "Filtros", status: "Status", industry: "Indústria", temperature: "Temperatura",
    all: "Todos", new: "Novo", qualified: "Qualificado", converted: "Convertido",
    hot: "Quente", warm: "Morno", cool: "Frio",
    showing: "Mostrando", of: "de", selected: "selecionados", selectedOne: "selecionado",
    exportCsv: "Exportar CSV", changeStatus: "Mudar status", clearSel: "Limpar", clearFilters: "Limpar filtros",
    company: "Empresa", contact: "Contato", phone: "Telefone", scoreCol: "Score", noLeads: "Nenhum lead encontrado",
    whyScore: "Por que esta pontuação?", verified: "Verificado", online: "Online", notFound: "Não encontrado", invalid: "Inválido",
    email: "E-mail", website: "Website", address: "Endereço", actions: "Ações",
    whatsapp: "WhatsApp", call: "Ligar", site: "Site", sendEmail: "E-mail",
    notes: "Notas", addNote: "Adicionar nota", notePh: "Escreva uma nota...", save: "Salvar", noNotes: "Sem notas ainda",
    pPhone: "Telefone presente", pEmail: "E-mail válido", pSite: "Website ativo", pAddress: "Endereço completo", pNiche: "Relevância do nicho",
  },
  en: {
    searchPh: "Search by company, contact, phone...", filters: "Filters", status: "Status", industry: "Industry", temperature: "Temperature",
    all: "All", new: "New", qualified: "Qualified", converted: "Converted",
    hot: "Hot", warm: "Warm", cool: "Cool",
    showing: "Showing", of: "of", selected: "selected", selectedOne: "selected",
    exportCsv: "Export CSV", changeStatus: "Change status", clearSel: "Clear", clearFilters: "Clear filters",
    company: "Company", contact: "Contact", phone: "Phone", scoreCol: "Score", noLeads: "No leads found",
    whyScore: "Why this score?", verified: "Verified", online: "Online", notFound: "Not found", invalid: "Invalid",
    email: "Email", website: "Website", address: "Address", actions: "Actions",
    whatsapp: "WhatsApp", call: "Call", site: "Site", sendEmail: "Email",
    notes: "Notes", addNote: "Add note", notePh: "Write a note...", save: "Save", noNotes: "No notes yet",
    pPhone: "Phone present", pEmail: "Valid email", pSite: "Active website", pAddress: "Complete address", pNiche: "Niche relevance",
  },
  es: {
    searchPh: "Buscar por empresa, contacto, teléfono...", filters: "Filtros", status: "Estado", industry: "Industria", temperature: "Temperatura",
    all: "Todos", new: "Nuevo", qualified: "Calificado", converted: "Convertido",
    hot: "Caliente", warm: "Tibio", cool: "Frío",
    showing: "Mostrando", of: "de", selected: "seleccionados", selectedOne: "seleccionado",
    exportCsv: "Exportar CSV", changeStatus: "Cambiar estado", clearSel: "Limpiar", clearFilters: "Limpiar filtros",
    company: "Empresa", contact: "Contacto", phone: "Teléfono", scoreCol: "Puntuación", noLeads: "No se encontraron leads",
    whyScore: "¿Por qué esta puntuación?", verified: "Verificado", online: "En línea", notFound: "No encontrado", invalid: "Inválido",
    email: "Email", website: "Sitio web", address: "Dirección", actions: "Acciones",
    whatsapp: "WhatsApp", call: "Llamar", site: "Sitio", sendEmail: "Email",
    notes: "Notas", addNote: "Añadir nota", notePh: "Escribe una nota...", save: "Guardar", noNotes: "Sin notas aún",
    pPhone: "Teléfono presente", pEmail: "Email válido", pSite: "Sitio activo", pAddress: "Dirección completa", pNiche: "Relevancia del nicho",
  },
};
