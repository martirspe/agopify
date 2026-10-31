import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DsIconComponent } from '@vendedoria/ui';

type HelpTopic = {
  title: string;
  body: string;
  link: string;
  cta: string;
};

@Component({
  selector: 'app-help-page',
  standalone: true,
  imports: [RouterLink, DsIconComponent],
  templateUrl: './help.page.html',
  styleUrl: './help.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  readonly topics: HelpTopic[] = [
    {
      title: 'Configura lo esencial',
      body: 'Vendedor, un producto con precio y WhatsApp conectado.',
      link: '/app/get-started',
      cta: 'Ir a Empezar',
    },
    {
      title: 'Vendedor IA',
      body: 'Personalidad, preguntas frecuentes y límites. Puedes probar el vendedor sin clientes reales.',
      link: '/app/seller',
      cta: 'Configurar vendedor',
    },
    {
      title: 'WhatsApp y ventana 24h',
      body: 'Conecta tu número con Meta, revisa el estado del canal y usa plantillas cuando pasen más de 24 horas.',
      link: '/app/channels',
      cta: 'Ir a Canales',
    },
    {
      title: 'Pedido y pago en el chat',
      body: 'Crea el pedido desde Mensajes, envía el link de pago al comprador y sigue su estado en Pedidos.',
      link: '/app/messages',
      cta: 'Abrir Mensajes',
    },
    {
      title: 'Plan y límites',
      body: 'Tu plan en VendedorIA es independiente de los cobros a tus compradores. Sube de plan antes de llegar al límite.',
      link: '/app/plans',
      cta: 'Ver planes',
    },
    {
      title: 'Términos, privacidad y reclamos',
      body: 'Condiciones del servicio, reembolsos, tratamiento de los datos de tus compradores y Libro de Reclamaciones.',
      link: '/legal',
      cta: 'Ir al Centro legal',
    },
  ];
}
