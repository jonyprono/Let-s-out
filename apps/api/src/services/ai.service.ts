import Groq from 'groq-sdk';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class AiService {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });
  }

  async generateSupportResponse(
    botId: string,
    _conversationId: string,
    history: { role: string; content: string }[],
    newMessage: string
  ): Promise<string> {
    try {
      if (!process.env.GROQ_API_KEY) {
        console.warn('[AI] GROQ_API_KEY is not set.');
        return 'Désolé, je ne peux pas vous répondre pour le moment (Clé API manquante).';
      }

      // Fetch the bot's system prompt from DB
      const bot = await prisma.user.findUnique({
        where: { id: botId },
        select: { botPrompt: true, profile: true }
      });

      let systemPrompt = bot?.botPrompt ||
        `Tu es ${bot?.profile?.displayName || 'un agent'}, un assistant du support client pour l'application Let's Out. Sois bref, concis et très utile. Tu parles en français. Ne dis jamais que tu es une IA ou un robot. Réponds directement aux questions de l'utilisateur.`;

      // --- RAG ARCHITECTURE: INJECT SYSTEM CONTEXT ---
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: _conversationId },
          include: {
            members: {
              include: { user: { include: { profile: true, wallet: true } } }
            }
          }
        });

        if (conversation) {
          const userMember = conversation.members.find(m => !m.user.isBot && !m.userId.startsWith('bot_'));
          
          let contextString = `\n\n<SYSTEM_CONTEXT>\nVoici les informations exactes et en temps réel concernant l'utilisateur. Utilise-les (si nécessaire) pour lui donner une réponse personnalisée :\n`;
          
          if (userMember?.user) {
            const u = userMember.user;
            contextString += `- Utilisateur : ${u.profile?.displayName || u.profile?.username || 'Anonyme'}\n`;
            contextString += `- Statut KYC : ${u.profile?.kycStatus || 'pending'}\n`;
            contextString += `- Solde de son Portefeuille (Wallet) : ${u.wallet?.balance || 0} F CFA\n`;

            // Fetch the user's most recent event to give context, since the bot is in a 1-on-1 chat
            const latestEvent = await prisma.event.findFirst({
              where: { creatorId: u.id },
              orderBy: { createdAt: 'desc' }
            });

            if (latestEvent) {
              contextString += `\nL'utilisateur a récemment créé l'événement suivant (à titre d'information s'il pose une question dessus) :\n`;
              contextString += `- Événement : ${latestEvent.title}\n`;
              contextString += `- Statut : ${latestEvent.status}\n`;
              contextString += `- Cagnotte récoltée : ${latestEvent.poolCollected} F CFA\n`;
              if (latestEvent.registrationDeadline) {
                contextString += `- Date limite d'inscription à l'événement : ${latestEvent.registrationDeadline.toISOString()}\n`;
              } else {
                contextString += `- Date limite d'inscription à l'événement : Non définie (prendre la date de début de l'événement)\n`;
              }
            }
          }
          
          contextString += `</SYSTEM_CONTEXT>`;
          systemPrompt += contextString;
        }
      } catch (ctxErr) {
        console.error('[AI] Error fetching RAG context:', ctxErr);
      }
      // -----------------------------------------------

      // Build messages array for Groq (OpenAI-compatible format)
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add history
      for (const msg of history) {
        if (msg.role === 'bot' || msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content || '...' });
        } else {
          messages.push({ role: 'user', content: msg.content || '...' });
        }
      }

      // Add the new user message
      messages.push({ role: 'user', content: newMessage });

      console.log(`[AI] Calling Groq for bot ${botId}, messages: ${messages.length}`);

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 512,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content || '';
      console.log(`[AI] Got response (${text.length} chars)`);
      return text;
    } catch (error: any) {
      console.error('[AI] Error generating AI response:', error?.message || error);
      return "Je suis désolé, je rencontre des difficultés techniques. Un agent humain vous contactera bientôt.";
    }
  }
}

export const aiService = new AiService();
