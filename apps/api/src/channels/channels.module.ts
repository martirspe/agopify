import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { MetaWhatsAppModule } from './meta-whatsapp.module';
import { WhatsAppSignupService } from './whatsapp-signup.service';
import { MetaSignupClient } from './meta-signup.client';
import { WhatsAppManualService } from './whatsapp-manual.service';

@Module({
  imports: [MetaWhatsAppModule, ConversationsModule],
  controllers: [ChannelsController],
  // Manual before signup: signup delegates diagnostics/disconnect and must resolve customer-owned availability.
  providers: [ChannelsService, MetaSignupClient, WhatsAppManualService, WhatsAppSignupService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
