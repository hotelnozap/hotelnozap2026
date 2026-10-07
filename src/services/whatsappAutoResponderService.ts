/**
 * whatsappAutoResponderService.ts
 * SERVIÇO DESABILITADO PERMANENTEMENTE
 * Todas as funções são no-op para garantir que o cliente nunca monitore
 * nem dispare mensagens automáticas no WhatsApp.
 */

class WhatsappAutoResponderService {
  public start(): void {}
  public stop(): void {}
  public async checkIncomingMessages(): Promise<void> {}
}

export const whatsappAutoResponderService = new WhatsappAutoResponderService();
export default whatsappAutoResponderService;
