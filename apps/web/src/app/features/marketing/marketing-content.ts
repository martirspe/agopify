/** Prerendered commercial summary of apps/api/src/billing/plan-catalog.ts. */
export const MARKETING_PLANS = [
  {
    name: 'Inicia',
    price: 29,
    description: 'Poco volumen. Ideal para probar el vendedor IA.',
    highlights: ['50 chats / mes', '25 productos', '1 usuario'],
    note: null,
    featured: false,
  },
  {
    name: 'Crece',
    price: 79,
    description: 'El plan para vender todos los días.',
    highlights: ['400 chats / mes', '100 productos', '2 usuarios'],
    note: '7 días gratis · sin tarjeta · 100 chats en la prueba',
    featured: true,
  },
  {
    name: 'Escala',
    price: 199,
    description: 'Más anuncios, más chats y equipo.',
    highlights: ['1 200 chats / mes', '300 productos', '5 usuarios'],
    note: null,
    featured: false,
  },
  {
    name: 'Lidera',
    price: 549,
    description: 'Alto volumen y soporte prioritario.',
    highlights: ['4 000 chats / mes', '1 000 productos', '15 usuarios', 'Soporte prioritario'],
    note: null,
    featured: false,
  },
] as const;

/** Shared by every plan — shown once above the cards, not repeated per plan. */
export const MARKETING_INCLUDED_IN_ALL = [
  'WhatsApp e Instagram con tu vendedor IA',
  'Catálogo con precios y stock reales',
  'Links de pago (tarjeta y Yape) en el chat',
  'Pedidos y mensajes en la consola',
] as const;

export const MARKETING_QUESTIONS = [
  {
    question: '¿Qué es Agopify?',
    answer:
      'Agopify es una plataforma de comercio con IA: un vendedor inteligente en WhatsApp e Instagram que usa tu catálogo real y cobra en el chat, más una consola para operar conversaciones y pedidos. La tienda web está en desarrollo y aún no forma parte oficial de los planes.',
  },
  {
    question: '¿Qué es un agente de ventas con IA?',
    answer:
      'Es tu vendedor digital en Agopify. Atiende conversaciones, recomienda productos con precio y stock de tu catálogo, guía la compra y puede enviar un enlace de pago. Tú defines su estilo y puedes pausarlo en cualquier chat.',
  },
  {
    question: '¿Cómo interactúa el agente con los clientes?',
    answer:
      'Responde en WhatsApp Business e Instagram Direct. Usa el contexto de la conversación y consulta tu catálogo. No inventa precios ni stock. Si hace falta intervención humana, pausas la IA y continúas desde la consola.',
  },
  {
    question: '¿Agopify incluye una tienda online?',
    answer:
      'Hoy el plan cubre tu vendedor IA, catálogo y cobros en el chat. La tienda web está en desarrollo: si aparece en la consola es acceso anticipado, sin formar parte oficial del plan ni del soporte dedicado.',
  },
  {
    question: '¿Cómo funciona el catálogo?',
    answer:
      'Cargas productos con fotos, precios, variantes y stock — también puedes importar desde un archivo. El vendedor consulta esa información como fuente de verdad al recomendar y armar pedidos.',
  },
  {
    question: '¿Qué canales de mensajería están disponibles?',
    answer:
      'WhatsApp Business (API oficial de Meta) e Instagram Direct. Ambos se gestionan en la misma consola. Otros canales solo se anuncian cuando estén integrados de verdad.',
  },
  {
    question: '¿Puedo personalizar al vendedor IA?',
    answer:
      'Sí. Configuras su estilo y comportamiento desde la consola y lo pruebas en el playground antes de atender clientes reales.',
  },
  {
    question: '¿Cómo funciona la prueba gratis?',
    answer:
      'Empiezas con 7 días del plan Crece, sin tarjeta. La prueba incluye hasta 100 chats nuevos. Al terminar, eliges un plan para seguir usando el servicio. No se realiza un cobro automático.',
  },
  {
    question: '¿Cómo funciona el precio de los planes?',
    answer:
      'Los planes (Inicia, Crece, Escala y Lidera) se diferencian por capacidad: chats, productos y usuarios. Todos incluyen WhatsApp e Instagram con vendedor IA, catálogo, links de pago y consola. Los precios se muestran en soles con IGV.',
  },
  {
    question: '¿Puedo crecer a medida que escala mi negocio?',
    answer:
      'Sí. Puedes cambiar de plan según el volumen de chats, el tamaño del catálogo y el tamaño del equipo. También puedes consultar tu consumo y sumar paquetes de chats desde la consola.',
  },
  {
    question: '¿Puedo responder personalmente?',
    answer:
      'Sí. Puedes escribir desde la consola sin detener al vendedor. Si quieres atender solo tú, usa «Pausar IA» en esa conversación y reáctivalo cuando estés listo.',
  },
  {
    question: '¿Cómo recibo el pago de mis clientes?',
    answer:
      'Conecta tu cuenta de Mercado Pago para enviar enlaces de pago por chat. Los métodos disponibles dependen de tu cuenta y de Mercado Pago. El dinero se abona en tu cuenta; Agopify no cobra comisión por venta. Se aplican las tarifas de Mercado Pago.',
  },
  {
    question: '¿Hay costos adicionales al plan?',
    answer:
      'El plan cubre el uso de Agopify según sus límites. Las tarifas de mensajería que aplique Meta y las comisiones de Mercado Pago se pagan por separado a cada proveedor.',
  },
] as const;
