/**
 * Tenant business knowledge topics — facts for all sellers, not persona config.
 * Templates are short Q&A starters; merchants edit before/after publishing.
 */

export const KNOWLEDGE_TOPICS = [
  'GENERAL',
  'SHIPPING',
  'RETURNS',
  'PAYMENTS',
  'HOURS',
  'ABOUT',
] as const;

export type KnowledgeTopicId = (typeof KNOWLEDGE_TOPICS)[number];

export type KnowledgeTopicMeta = {
  id: KnowledgeTopicId;
  label: string;
  hint: string;
};

export const KNOWLEDGE_TOPIC_META: KnowledgeTopicMeta[] = [
  {
    id: 'GENERAL',
    label: 'General',
    hint: 'Otras políticas o preguntas frecuentes',
  },
  {
    id: 'SHIPPING',
    label: 'Envíos',
    hint: 'Cobertura, plazos y costos referenciales',
  },
  {
    id: 'RETURNS',
    label: 'Cambios y devoluciones',
    hint: 'Plazos, condiciones y cómo solicitarlos',
  },
  {
    id: 'PAYMENTS',
    label: 'Pagos',
    hint: 'Medios de pago y seguridad del cobro',
  },
  {
    id: 'HOURS',
    label: 'Horarios',
    hint: 'Atención, despacho y recojo',
  },
  {
    id: 'ABOUT',
    label: 'Sobre el negocio',
    hint: 'Quiénes somos y cómo contactarnos',
  },
];

export type KnowledgePolicyTemplate = {
  topic: KnowledgeTopicId;
  question: string;
  answer: string;
};

/** Starter policies — honest placeholders the merchant must adapt to their business. */
export const KNOWLEDGE_POLICY_TEMPLATES: KnowledgePolicyTemplate[] = [
  {
    topic: 'SHIPPING',
    question: '¿Hacen envíos a provincia?',
    answer:
      'Sí, enviamos a todo el Perú. El plazo y el costo se confirman según tu distrito al momento de la compra.',
  },
  {
    topic: 'SHIPPING',
    question: '¿Cuánto demora el envío en Lima?',
    answer:
      'En Lima Metropolitana el despacho suele tardar de 1 a 3 días hábiles después de confirmar el pago. Te avisamos cuando salga el pedido.',
  },
  {
    topic: 'RETURNS',
    question: '¿Puedo cambiar o devolver un producto?',
    answer:
      'Sí, aceptamos cambios dentro de 7 días calendario si el producto está sin uso, con etiquetas y empaque original. Escríbenos con tu número de pedido para coordinarlo.',
  },
  {
    topic: 'RETURNS',
    question: '¿Quién paga el envío del cambio?',
    answer:
      'Si el cambio es por talla o color a elección del cliente, el reenvío lo asume el cliente. Si hubo un error nuestro, nosotros cubrimos el envío.',
  },
  {
    topic: 'PAYMENTS',
    question: '¿Qué medios de pago aceptan?',
    answer:
      'Puedes pagar con el link seguro que te enviamos (tarjetas y Yape cuando esté disponible en tu checkout). No pedimos transferencias a cuentas personales por chat.',
  },
  {
    topic: 'PAYMENTS',
    question: '¿El pago es seguro?',
    answer:
      'Sí. El cobro se procesa por el checkout seguro de la plataforma de pagos. Nunca te pediremos la clave de tu tarjeta ni códigos por WhatsApp.',
  },
  {
    topic: 'HOURS',
    question: '¿Cuál es el horario de atención?',
    answer:
      'Atendemos de lunes a sábado de 9:00 a 18:00 (hora de Perú). Fuera de ese horario el vendedor IA puede ayudarte y un asesor retoma si hace falta.',
  },
  {
    topic: 'ABOUT',
    question: '¿Quiénes son?',
    answer:
      'Somos un negocio peruano que vende por WhatsApp e Instagram. Si necesitas hablar con una persona del equipo, pídelo y te derivamos.',
  },
];

export function isKnowledgeTopic(value: string): value is KnowledgeTopicId {
  return (KNOWLEDGE_TOPICS as readonly string[]).includes(value);
}

export function topicLabel(topic: string): string {
  return (
    KNOWLEDGE_TOPIC_META.find((item) => item.id === topic)?.label ?? 'General'
  );
}
