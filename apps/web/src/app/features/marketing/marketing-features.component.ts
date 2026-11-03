import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DsIconComponent, DsIconName, DsLinkComponent } from '@agopify/ui';

type MarketingStep = { icon: DsIconName; title: string; text: string };
type Benefit = { icon: DsIconName; title: string; text: string };
type UseCase = { icon: DsIconName; problem: string; title: string; text: string };

@Component({
  selector: 'app-marketing-features',
  imports: [DsIconComponent, DsLinkComponent],
  templateUrl: './marketing-features.component.html',
  styleUrl: './marketing-features.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingFeaturesComponent {
  readonly steps: MarketingStep[] = [
    {
      icon: 'plug',
      title: 'Conecta tu negocio',
      text: 'Vincula WhatsApp Business e Instagram, carga tu catálogo y define condiciones de envío.',
    },
    {
      icon: 'bot',
      title: 'Activa tu vendedor IA',
      text: 'Configura su estilo, pruébalo en el playground y actívalo cuando esté listo para atender.',
    },
    {
      icon: 'shoppingBag',
      title: 'Empieza a vender',
      text: 'Las conversaciones usan tu catálogo real. Conecta Mercado Pago y gestiona pedidos en la consola.',
    },
  ];

  readonly benefits: Benefit[] = [
    {
      icon: 'message',
      title: 'Atiende sin perder el hilo',
      text: 'El vendedor mantiene el contexto de la conversación y responde con información de tu catálogo.',
    },
    {
      icon: 'package',
      title: 'Descubrimiento de productos real',
      text: 'Recomendaciones con precio, variantes y stock. Sin inventar datos de venta.',
    },
    {
      icon: 'users',
      title: 'Control humano cuando hace falta',
      text: 'Pausa la IA por conversación, responde desde la consola y reáctivala cuando termines.',
    },
    {
      icon: 'layers',
      title: 'Operación conectada',
      text: 'Chats, pedidos y cobros viven en el mismo ecosistema — no en herramientas sueltas.',
    },
    {
      icon: 'wallet',
      title: 'Cobro en el mismo chat',
      text: 'Envía enlaces de Mercado Pago (tarjeta y Yape según tu cuenta) sin sacar al cliente del hilo.',
    },
    {
      icon: 'shieldCheck',
      title: 'Confianza operativa',
      text: 'Plan SaaS y cobros de clientes siempre separados. El dinero de cada venta llega a tu cuenta.',
    },
  ];

  readonly useCases: UseCase[] = [
    {
      icon: 'whatsapp',
      problem: 'Muchos mensajes, pocas horas',
      title: 'Negocios que venden por WhatsApp',
      text: 'El vendedor IA responde consultas frecuentes, muestra productos con stock y guía hasta el enlace de pago mientras tu equipo se enfoca en casos complejos.',
    },
    {
      icon: 'instagram',
      problem: 'Interés en Direct que se enfría',
      title: 'Marcas en Instagram',
      text: 'Convierte mensajes directos en conversaciones de venta con el mismo catálogo y la misma consola que WhatsApp.',
    },
    {
      icon: 'store',
      problem: 'Catálogo amplio, respuestas lentas',
      title: 'Tiendas con muchos productos',
      text: 'El agente consulta tu catálogo para recomendar con precisión. Tú defines el estilo; Agopify no improvisa precios.',
    },
    {
      icon: 'chartLine',
      problem: 'Crecer sin multiplicar el equipo',
      title: 'Comercios en crecimiento',
      text: 'Escala la atención con planes por capacidad de chats, productos y usuarios. La operación sigue en una sola consola.',
    },
  ];
}
