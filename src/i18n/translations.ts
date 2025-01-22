export const translations = {
  "pt-BR": {
    // Dashboard
    "dashboard": "Dashboard",
    "totalLeads": "Total de Leads",
    "recentLeads": "Leads Recentes",
    "withTags": "Com Tags",
    "withEmail": "Com Email",
    "withPhone": "Com Telefone",
    "withWebsite": "Com Website",
    "last30Days": "Últimos 30 dias",
    "leadsWithTags": "Leads com tags",
    "contactsWithEmail": "Contatos com email",
    "contactsWithPhone": "Contatos com telefone",
    "withSite": "Com site",
    
    // Menu Items
    "addLeads": "Adicionar Leads",
    "manualInput": "Inserir manualmente",
    "googleMaps": "Google Maps",
    "websites": "Websites",
    "leads": "Leads",
    "leadsList": "Lista de Leads",
    "leadScore": "Score de Leads",
    "timeline": "Timeline",
    "reports": "Relatórios",
    "subscription": "Assinatura",
    "settings": "Configurações",
    
    // Config
    "language": "Idioma",
    "selectLanguage": "Selecione o idioma",
    "notifications": "Notificações",
    "theme": "Tema",
    "webhooks": "Webhooks",
    "applySettings": "Aplicar Configurações",
    "settingsApplied": "Configurações aplicadas",
    "settingsError": "Erro ao aplicar configurações",
    
    // Common
    "loading": "Carregando...",
    "error": "Erro",
    "success": "Sucesso",
    "save": "Salvar",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "edit": "Editar",
    "search": "Buscar",
    "noResults": "Nenhum resultado encontrado",
    "hello": "Olá",
    "logout": "Sair",
    "profile": "Perfil do Usuário",
    "support": "Suporte",
    "version": "Versão",
  },
  "en": {
    // Dashboard
    "dashboard": "Dashboard",
    "totalLeads": "Total Leads",
    "recentLeads": "Recent Leads",
    "withTags": "With Tags",
    "withEmail": "With Email",
    "withPhone": "With Phone",
    "withWebsite": "With Website",
    "last30Days": "Last 30 days",
    "leadsWithTags": "Leads with tags",
    "contactsWithEmail": "Contacts with email",
    "contactsWithPhone": "Contacts with phone",
    "withSite": "With website",
    
    // Menu Items
    "addLeads": "Add Leads",
    "manualInput": "Manual Input",
    "googleMaps": "Google Maps",
    "websites": "Websites",
    "leads": "Leads",
    "leadsList": "Leads List",
    "leadScore": "Lead Score",
    "timeline": "Timeline",
    "reports": "Reports",
    "subscription": "Subscription",
    "settings": "Settings",
    
    // Config
    "language": "Language",
    "selectLanguage": "Select language",
    "notifications": "Notifications",
    "theme": "Theme",
    "webhooks": "Webhooks",
    "applySettings": "Apply Settings",
    "settingsApplied": "Settings applied",
    "settingsError": "Error applying settings",
    
    // Common
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "noResults": "No results found",
    "hello": "Hello",
    "logout": "Logout",
    "profile": "User Profile",
    "support": "Support",
    "version": "Version",
  },
  "es": {
    // Dashboard
    "dashboard": "Dashboard",
    "totalLeads": "Total de Leads",
    "recentLeads": "Leads Recientes",
    "withTags": "Con Etiquetas",
    "withEmail": "Con Email",
    "withPhone": "Con Teléfono",
    "withWebsite": "Con Sitio Web",
    "last30Days": "Últimos 30 días",
    "leadsWithTags": "Leads con etiquetas",
    "contactsWithEmail": "Contactos con email",
    "contactsWithPhone": "Contactos con teléfono",
    "withSite": "Con sitio web",
    
    // Menu Items
    "addLeads": "Agregar Leads",
    "manualInput": "Entrada Manual",
    "googleMaps": "Google Maps",
    "websites": "Sitios Web",
    "leads": "Leads",
    "leadsList": "Lista de Leads",
    "leadScore": "Puntuación de Leads",
    "timeline": "Línea de Tiempo",
    "reports": "Informes",
    "subscription": "Suscripción",
    "settings": "Configuración",
    
    // Config
    "language": "Idioma",
    "selectLanguage": "Seleccionar idioma",
    "notifications": "Notificaciones",
    "theme": "Tema",
    "webhooks": "Webhooks",
    "applySettings": "Aplicar Configuración",
    "settingsApplied": "Configuración aplicada",
    "settingsError": "Error al aplicar la configuración",
    
    // Common
    "loading": "Cargando...",
    "error": "Error",
    "success": "Éxito",
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "search": "Buscar",
    "noResults": "No se encontraron resultados",
    "hello": "Hola",
    "logout": "Cerrar Sesión",
    "profile": "Perfil de Usuario",
    "support": "Soporte",
    "version": "Versión",
  }
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations["pt-BR"];