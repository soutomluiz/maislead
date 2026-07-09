// Base de conhecimento da detecção de tecnologia:
//  - TECH_KB: "o que é" cada tecnologia (tooltip explicativo por idioma)
//  - techOpportunities: "o que fazer / como abordar" — gerado a partir das flags do lead
// Objetivo: transformar a lista de tecnologias em ARGUMENTO DE VENDA acionável.
import type { TechInfo } from "./model";

export type Lang = "pt" | "en" | "es";

// Definição curta de cada tecnologia (chaveada pelo label vindo da edge function detect-tech).
export const TECH_KB: Record<string, Record<Lang, string>> = {
  // CMS
  WordPress: { pt: "Sistema de site mais usado do mundo. Fácil de editar e otimizar (SEO, velocidade, landing pages).", en: "World's most used site platform. Easy to edit and optimize.", es: "La plataforma de sitios más usada. Fácil de editar y optimizar." },
  Wix: { pt: "Construtor de site 'arrasta e solta'. Prático, mas limitado em performance e SEO.", en: "Drag-and-drop site builder. Handy but limited in performance/SEO.", es: "Constructor 'arrastrar y soltar'. Práctico pero limitado." },
  Squarespace: { pt: "Construtor de sites focado em design. Bonito, porém pouco flexível.", en: "Design-focused site builder. Pretty but not very flexible.", es: "Constructor enfocado en diseño. Bonito pero poco flexible." },
  Webflow: { pt: "Construtor visual avançado. Site moderno, geralmente feito por profissional.", en: "Advanced visual builder. Modern site, usually pro-made.", es: "Constructor visual avanzado. Sitio moderno, hecho por profesional." },
  Joomla: { pt: "CMS mais antigo. Costuma indicar site desatualizado.", en: "Older CMS. Often an outdated site.", es: "CMS antiguo. Suele indicar sitio desactualizado." },
  Drupal: { pt: "CMS robusto e técnico, comum em empresas/governo.", en: "Robust technical CMS, common in enterprise/gov.", es: "CMS robusto y técnico, común en empresas/gobierno." },
  "Google Sites": { pt: "Site grátis e básico do Google. Forte sinal de presença digital fraca.", en: "Free, basic Google site. Strong sign of weak digital presence.", es: "Sitio gratuito y básico de Google. Presencia digital débil." },
  // Builders
  Elementor: { pt: "Editor visual do WordPress. Site fácil de mexer e melhorar.", en: "WordPress visual editor. Easy site to tweak.", es: "Editor visual de WordPress. Sitio fácil de ajustar." },
  Divi: { pt: "Tema/editor visual do WordPress.", en: "WordPress visual theme/builder.", es: "Tema/editor visual de WordPress." },
  WPBakery: { pt: "Editor visual antigo do WordPress. Site pode estar pesado/desatualizado.", en: "Old WordPress builder. Site may be heavy/outdated.", es: "Editor antiguo de WordPress. Sitio pesado/desactualizado." },
  // E-commerce
  Shopify: { pt: "Plataforma de loja virtual paga. Cliente já vende online e investe nisso.", en: "Paid e-commerce platform. Client already sells online.", es: "Plataforma de tienda paga. Ya vende en línea." },
  WooCommerce: { pt: "Loja virtual sobre WordPress. Vende online e dá pra otimizar conversão.", en: "WordPress-based store. Sells online, conversion can be optimized.", es: "Tienda sobre WordPress. Vende en línea." },
  VTEX: { pt: "Plataforma de e-commerce robusta (médias/grandes empresas).", en: "Robust e-commerce platform (mid/large companies).", es: "Plataforma de e-commerce robusta." },
  Nuvemshop: { pt: "Plataforma de loja popular no Brasil (PMEs que vendem online).", en: "Popular Brazilian store platform (SMB online sellers).", es: "Plataforma de tienda popular en Brasil." },
  "Loja Integrada": { pt: "Plataforma de loja para pequenos lojistas brasileiros.", en: "Store platform for small Brazilian sellers.", es: "Plataforma de tienda para pequeños comercios." },
  Magento: { pt: "E-commerce técnico e caro de manter. Empresa com estrutura.", en: "Technical, costly e-commerce. Company with structure.", es: "E-commerce técnico y caro de mantener." },
  WBuy: { pt: "Plataforma de e-commerce brasileira.", en: "Brazilian e-commerce platform.", es: "Plataforma de e-commerce brasileña." },
  // Analytics
  "Google Analytics": { pt: "Mede visitas e comportamento no site. Cliente acompanha resultados.", en: "Measures site traffic/behavior. Client tracks results.", es: "Mide visitas y comportamiento. Sigue resultados." },
  "Google Tag Manager": { pt: "Gerenciador de tags/rastreamento. Cliente tem alguma estrutura de medição.", en: "Tag/tracking manager. Some measurement structure.", es: "Gestor de etiquetas. Alguna estructura de medición." },
  Hotjar: { pt: "Mapas de calor e gravação de sessões. Cliente otimiza conversão.", en: "Heatmaps/session recording. Optimizes conversion.", es: "Mapas de calor y grabaciones. Optimiza conversión." },
  "MS Clarity": { pt: "Ferramenta grátis de mapa de calor da Microsoft.", en: "Microsoft's free heatmap tool.", es: "Herramienta gratuita de mapas de calor de Microsoft." },
  // Pixels
  "Pixel do Meta": { pt: "Rastreamento do Facebook/Instagram Ads. Cliente faz (ou fez) tráfego pago.", en: "Facebook/Instagram Ads tracking. Runs paid traffic.", es: "Rastreo de Facebook/Instagram Ads. Hace tráfico pago." },
  "Pixel do TikTok": { pt: "Rastreamento de anúncios do TikTok.", en: "TikTok Ads tracking.", es: "Rastreo de anuncios de TikTok." },
  "Google Ads": { pt: "Rastreamento de anúncios do Google. Cliente investe em mídia paga.", en: "Google Ads tracking. Invests in paid media.", es: "Rastreo de Google Ads. Invierte en medios pagos." },
  "LinkedIn Insight": { pt: "Rastreamento de anúncios do LinkedIn (foco B2B).", en: "LinkedIn Ads tracking (B2B focus).", es: "Rastreo de anuncios de LinkedIn (B2B)." },
  // Chat
  WhatsApp: { pt: "Botão de WhatsApp no site. Já capta contato por lá.", en: "WhatsApp button on site. Already captures contact.", es: "Botón de WhatsApp en el sitio." },
  "Tawk.to": { pt: "Chat de atendimento grátis no site.", en: "Free live-chat on site.", es: "Chat de atención gratuito." },
  JivoChat: { pt: "Chat de atendimento e vendas no site.", en: "Sales/support live-chat.", es: "Chat de ventas/atención." },
  Zendesk: { pt: "Plataforma de atendimento ao cliente.", en: "Customer support platform.", es: "Plataforma de atención al cliente." },
  Intercom: { pt: "Chat e automação de atendimento (empresa mais estruturada).", en: "Chat/support automation (structured company).", es: "Chat y automatización de atención." },
  Crisp: { pt: "Chat de atendimento no site.", en: "Live-chat on site.", es: "Chat de atención en el sitio." },
  // Marketing
  "RD Station": { pt: "Automação de marketing líder no Brasil. Cliente maduro em marketing digital.", en: "Leading BR marketing automation. Mature in digital marketing.", es: "Automatización de marketing líder en Brasil." },
  HubSpot: { pt: "CRM e automação de marketing. Empresa investe em marketing/vendas.", en: "CRM & marketing automation. Invests in marketing/sales.", es: "CRM y automatización. Invierte en marketing/ventas." },
  ActiveCampaign: { pt: "Automação de e-mail marketing e CRM.", en: "Email marketing & CRM automation.", es: "Automatización de email y CRM." },
  Mailchimp: { pt: "Ferramenta de e-mail marketing.", en: "Email marketing tool.", es: "Herramienta de email marketing." },
  // Frameworks
  React: { pt: "Tecnologia de sites modernos (informativo).", en: "Modern site tech (informational).", es: "Tecnología de sitios modernos." },
  "Next.js": { pt: "Framework de site moderno e rápido (informativo).", en: "Modern fast site framework (informational).", es: "Framework moderno y rápido." },
  Vue: { pt: "Tecnologia de sites modernos (informativo).", en: "Modern site tech (informational).", es: "Tecnología de sitios modernos." },
  jQuery: { pt: "Biblioteca antiga de JavaScript. Pode indicar site datado.", en: "Old JavaScript library. May indicate a dated site.", es: "Librería antigua de JavaScript. Sitio datado." },
};

export function techWhat(label: string, lang: Lang): string | undefined {
  return TECH_KB[label]?.[lang];
}

// Gera as OPORTUNIDADES de abordagem a partir das flags do lead.
// Cada item = { text: como abordar, tone: 'gap' (falta algo = oportunidade) | 'mature' (cliente maduro) }.
export interface Opportunity { text: string; tone: "gap" | "mature" }

const BUILDER_CMS = ["Wix", "Squarespace", "Google Sites"];

export function techOpportunities(tech: TechInfo | null, lang: Lang): Opportunity[] {
  if (!tech || !tech.ok) return [];
  const ops: Opportunity[] = [];
  const T = {
    pixel: {
      pt: "Site SEM Pixel de anúncios: não consegue fazer remarketing nem otimizar campanhas. Ofereça instalação de Pixel + gestão de tráfego pago.",
      en: "Site with NO ad Pixel: can't remarket or optimize campaigns. Offer Pixel setup + paid traffic management.",
      es: "Sitio SIN Pixel: no puede hacer remarketing. Ofrece instalación de Pixel + gestión de tráfico.",
    },
    analytics: {
      pt: "Sem Analytics: o cliente não mede visitas nem conversões. Ofereça configuração de GA4 e relatórios de resultado.",
      en: "No Analytics: client doesn't measure traffic/conversions. Offer GA4 setup and reporting.",
      es: "Sin Analytics: no mide visitas ni conversiones. Ofrece configuración de GA4 e informes.",
    },
    ecomNoPixel: {
      pt: "Loja online SEM Pixel: está perdendo vendas por falta de remarketing. Oportunidade forte de tráfego pago pra e-commerce.",
      en: "Online store with NO Pixel: losing sales from missing remarketing. Strong e-commerce paid-traffic opportunity.",
      es: "Tienda SIN Pixel: pierde ventas por falta de remarketing. Fuerte oportunidad de tráfico para e-commerce.",
    },
    weakBuilder: {
      pt: "Site em construtor básico: oportunidade de um site profissional, rápido e otimizado pra converter.",
      en: "Site on a basic builder: opportunity for a professional, fast, conversion-ready site.",
      es: "Sitio en constructor básico: oportunidad de un sitio profesional y optimizado.",
    },
    noChat: {
      pt: "Sem canal de atendimento rápido no site: ofereça botão de WhatsApp/chatbot pra captar mais leads.",
      en: "No fast contact channel on site: offer WhatsApp button/chatbot to capture more leads.",
      es: "Sin canal de atención rápido: ofrece botón de WhatsApp/chatbot.",
    },
    nothing: {
      pt: "Site simples, sem ferramentas de marketing: grande oportunidade de estruturar a presença digital do zero (site + Pixel + tráfego).",
      en: "Simple site, no marketing tools: big opportunity to build digital presence from scratch.",
      es: "Sitio simple, sin herramientas de marketing: gran oportunidad de estructurar todo desde cero.",
    },
    mature: {
      pt: "Cliente já usa automação de marketing: é maduro digitalmente. Ofereça serviços avançados (gestão de CRM, tráfego, nutrição de leads).",
      en: "Client already uses marketing automation: digitally mature. Offer advanced services (CRM, traffic, nurturing).",
      es: "Ya usa automatización de marketing: maduro digitalmente. Ofrece servicios avanzados.",
    },
    runningAds: {
      pt: "Cliente já investe em anúncios (tem Pixel): ofereça otimização de campanhas, criativos e redução de custo por lead.",
      en: "Client already runs ads (has Pixel): offer campaign optimization and lower cost per lead.",
      es: "Ya invierte en anuncios (tiene Pixel): ofrece optimización de campañas.",
    },
  };
  const pick = (k: keyof typeof T) => T[k][lang];

  const nothingDetected = !tech.cms && !tech.builder && !tech.is_ecommerce && !tech.has_pixel && !tech.has_analytics && tech.marketing.length === 0 && tech.chat.length === 0;

  if (tech.is_ecommerce && !tech.has_pixel) ops.push({ text: pick("ecomNoPixel"), tone: "gap" });
  else if (!tech.has_pixel && !nothingDetected) ops.push({ text: pick("pixel"), tone: "gap" });

  if (!tech.has_analytics && !nothingDetected) ops.push({ text: pick("analytics"), tone: "gap" });
  if (tech.cms && BUILDER_CMS.includes(tech.cms)) ops.push({ text: pick("weakBuilder"), tone: "gap" });
  if (tech.chat.length === 0 && !nothingDetected) ops.push({ text: pick("noChat"), tone: "gap" });
  if (nothingDetected) ops.push({ text: pick("nothing"), tone: "gap" });
  if (tech.marketing.length > 0) ops.push({ text: pick("mature"), tone: "mature" });
  if (tech.has_pixel) ops.push({ text: pick("runningAds"), tone: "mature" });

  return ops;
}
