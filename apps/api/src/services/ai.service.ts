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

      const systemPrompt = bot?.botPrompt ||
        `Tu es ${bot?.profile?.displayName || 'un agent'}, un assistant du support client pour l'application Let's Out. Sois bref, concis et très utile. Tu parles en français. Ne dis jamais que tu es une IA ou un robot. Réponds directement aux questions de l'utilisateur.`;

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
