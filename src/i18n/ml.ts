// maisLEAD i18n — pt/en/es (nav + titles portados do protótipo)
export type Lang = "pt" | "en" | "es";

export type ScreenKey =
  | "dashboard" | "manual" | "gplaces" | "cnpj" | "recem" | "leadslist"
  | "score" | "timeline" | "reports" | "integrations" | "sub" | "settings";

interface Dict {
  nav: Record<string, string>;
  titles: Record<string, [string, string]>;
  auth: Record<string, string>;
  common: Record<string, string>;
}

export const DICT: Record<Lang, Dict> = {
  pt: {
    nav: { dashboard: "Dashboard", secPros: "Prospecção", add: "Adicionar Leads", manual: "Entrada Manual", gplaces: "Google Places", cnpj: "Busca por CNPJ", recem: "Recém-abertas", secMgmt: "Gestão", leads: "Leads", score: "Pontuação", timeline: "Linha do tempo", reports: "Relatórios", integrations: "Integrações", sub: "Assinatura", settings: "Configurações" },
    titles: { dashboard: ["Dashboard", "Visão geral da sua prospecção"], manual: ["Entrada Manual", "Cadastre um lead manualmente"], gplaces: ["Google Places", "Extraia leads do Google Maps"], cnpj: ["Busca por CNPJ", "Consulte empresas na base oficial da Receita"], recem: ["Empresas Recém-Abertas", "Empresas que abriram recentemente"], leadslist: ["Lista de Leads", "Gerencie e organize seus leads"], score: ["Pontuação de Leads", "Priorize os leads mais quentes"], timeline: ["Linha do tempo", "Histórico de atividades dos leads"], reports: ["Relatórios", "Métricas e desempenho da prospecção"], integrations: ["Integrações", "Conecte seus CRMs e ferramentas"], sub: ["Assinatura", "Gerencie seu plano"], settings: ["Configurações", "Preferências e integrações"] },
    auth: { brand: "maisLEAD", tagline: "Prospecção e gestão de leads", signInTitle: "Bem-vindo de volta", signInSub: "Entre na sua conta para continuar", signUpTitle: "Criar conta", signUpSub: "Comece a prospectar em minutos", resetTitle: "Recuperar senha", resetSub: "Enviaremos um link de recuperação por e-mail", name: "Nome", email: "E-mail", password: "Senha", signIn: "Entrar", signUp: "Criar conta", sendReset: "Enviar link", forgot: "Esqueci minha senha", noAccount: "Não tem conta? Cadastre-se", hasAccount: "Já tem conta? Entrar", backToLogin: "Voltar ao login", resetSent: "Link de recuperação enviado. Confira seu e-mail.", checkEmail: "Confirme seu e-mail para ativar a conta." },
    common: { logout: "Sair", profile: "Perfil", theme: "Tema", language: "Idioma", light: "Claro", dark: "Escuro", loading: "Carregando...", soon: "Em construção", soonSub: "Esta tela chega numa próxima fatia da reconstrução.", error: "Ops, algo deu errado" },
  },
  en: {
    nav: { dashboard: "Dashboard", secPros: "Prospecting", add: "Add Leads", manual: "Manual Entry", gplaces: "Google Places", cnpj: "CNPJ Lookup", recem: "Newly Opened", secMgmt: "Management", leads: "Leads", score: "Scoring", timeline: "Timeline", reports: "Reports", integrations: "Integrations", sub: "Subscription", settings: "Settings" },
    titles: { dashboard: ["Dashboard", "Overview of your prospecting"], manual: ["Manual Entry", "Add a lead manually"], gplaces: ["Google Places", "Extract leads from Google Maps"], cnpj: ["CNPJ Lookup", "Query companies in Brazil's official registry"], recem: ["Newly Opened Companies", "Companies that opened recently"], leadslist: ["Leads List", "Manage and organize your leads"], score: ["Lead Scoring", "Prioritize your hottest leads"], timeline: ["Timeline", "Lead activity history"], reports: ["Reports", "Prospecting metrics and performance"], integrations: ["Integrations", "Connect your CRMs and tools"], sub: ["Subscription", "Manage your plan"], settings: ["Settings", "Preferences and integrations"] },
    auth: { brand: "maisLEAD", tagline: "Lead prospecting & management", signInTitle: "Welcome back", signInSub: "Sign in to your account to continue", signUpTitle: "Create account", signUpSub: "Start prospecting in minutes", resetTitle: "Reset password", resetSub: "We'll email you a recovery link", name: "Name", email: "Email", password: "Password", signIn: "Sign in", signUp: "Create account", sendReset: "Send link", forgot: "Forgot password", noAccount: "No account? Sign up", hasAccount: "Have an account? Sign in", backToLogin: "Back to login", resetSent: "Recovery link sent. Check your email.", checkEmail: "Confirm your email to activate the account." },
    common: { logout: "Log out", profile: "Profile", theme: "Theme", language: "Language", light: "Light", dark: "Dark", loading: "Loading...", soon: "Coming soon", soonSub: "This screen arrives in a later slice of the rebuild.", error: "Oops, something went wrong" },
  },
  es: {
    nav: { dashboard: "Panel", secPros: "Prospección", add: "Añadir Leads", manual: "Entrada Manual", gplaces: "Google Places", cnpj: "Búsqueda por CNPJ", recem: "Recién Abiertas", secMgmt: "Gestión", leads: "Leads", score: "Puntuación", timeline: "Cronología", reports: "Informes", integrations: "Integraciones", sub: "Suscripción", settings: "Configuración" },
    titles: { dashboard: ["Panel", "Resumen de tu prospección"], manual: ["Entrada Manual", "Añade un lead manualmente"], gplaces: ["Google Places", "Extrae leads de Google Maps"], cnpj: ["Búsqueda por CNPJ", "Consulta empresas en el registro oficial de Brasil"], recem: ["Empresas Recién Abiertas", "Empresas que abrieron recientemente"], leadslist: ["Lista de Leads", "Gestiona y organiza tus leads"], score: ["Puntuación de Leads", "Prioriza tus leads más calientes"], timeline: ["Cronología", "Historial de actividad de leads"], reports: ["Informes", "Métricas y rendimiento de prospección"], integrations: ["Integraciones", "Conecta tus CRMs y herramientas"], sub: ["Suscripción", "Gestiona tu plan"], settings: ["Configuración", "Preferencias e integraciones"] },
    auth: { brand: "maisLEAD", tagline: "Prospección y gestión de leads", signInTitle: "Bienvenido de nuevo", signInSub: "Inicia sesión para continuar", signUpTitle: "Crear cuenta", signUpSub: "Empieza a prospectar en minutos", resetTitle: "Recuperar contraseña", resetSub: "Te enviaremos un enlace de recuperación", name: "Nombre", email: "Email", password: "Contraseña", signIn: "Entrar", signUp: "Crear cuenta", sendReset: "Enviar enlace", forgot: "Olvidé mi contraseña", noAccount: "¿Sin cuenta? Regístrate", hasAccount: "¿Ya tienes cuenta? Entra", backToLogin: "Volver al inicio", resetSent: "Enlace de recuperación enviado. Revisa tu email.", checkEmail: "Confirma tu email para activar la cuenta." },
    common: { logout: "Salir", profile: "Perfil", theme: "Tema", language: "Idioma", light: "Claro", dark: "Oscuro", loading: "Cargando...", soon: "Próximamente", soonSub: "Esta pantalla llega en una fase posterior de la reconstrucción.", error: "Ups, algo salió mal" },
  },
};
