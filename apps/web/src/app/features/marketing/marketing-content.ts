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
    note: '14 días gratis · sin tarjeta · 100 chats en la prueba',
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
    question: '¿Cómo funciona la prueba gratis?',
    answer:
      'Empiezas con 14 días del plan Crece, sin tarjeta. La prueba incluye hasta 100 chats nuevos. Al terminar, eliges un plan para seguir usando el servicio. No se realiza un cobro automático.',
  },
  {
    question: '¿Qué incluye todos los planes?',
    answer:
      'WhatsApp e Instagram con tu vendedor IA, catálogo, links de pago en el chat, y pedidos y mensajes en la consola. Lo que cambia entre planes es la capacidad: chats, productos y usuarios.',
  },
  {
    question: '¿Necesito saber de tecnología?',
    answer:
      'Configuras tus canales, catálogo y vendedor desde la consola. Antes de activarlo, puedes probar sus respuestas en el chat de práctica. Para conectar WhatsApp e Instagram necesitas las cuentas y los permisos de Meta correspondientes.',
  },
  {
    question: '¿De dónde salen los precios y el stock?',
    answer:
      'Tu vendedor consulta la información de tu catálogo y las condiciones de envío que configuras. Puedes revisar sus respuestas en el chat de práctica antes de atender a tus clientes.',
  },
  {
    question: '¿Puedo responder personalmente?',
    answer:
      'Sí. Puedes escribir desde la consola sin detener al vendedor. Si quieres atender solo tú, usa «Pausar IA» en esa conversación y reáctivalo cuando estés listo.',
  },
  {
    question: '¿Cómo recibo el pago de mis clientes?',
    answer:
      'Conecta tu cuenta de Mercado Pago para enviar enlaces de pago por chat. Los métodos disponibles dependen de tu cuenta y de Mercado Pago. El dinero se abona en tu cuenta; VendedorIA no cobra comisión por venta. Se aplican las tarifas de Mercado Pago.',
  },
  {
    question: '¿Qué cuenta como un chat nuevo?',
    answer:
      'Una conversación que se crea por primera vez con un cliente en un canal. Los mensajes posteriores de esa conversación no vuelven a contarse como chats nuevos. Puedes consultar tu consumo y sumar paquetes de chats desde la consola.',
  },
  {
    question: '¿Incluye tienda web?',
    answer:
      'Hoy el plan cubre tu vendedor IA, catálogo y cobros en el chat. La tienda web está en desarrollo: si aparece en la consola es acceso anticipado, sin formar parte oficial del plan ni del soporte dedicado.',
  },
  {
    question: '¿Hay costos adicionales al plan?',
    answer:
      'El plan cubre el uso de VendedorIA según sus límites. Las tarifas de mensajería que aplique Meta y las comisiones de Mercado Pago se pagan por separado a cada proveedor.',
  },
] as const;
