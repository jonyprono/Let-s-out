import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateSupportResponse(
    botId: string,
    _conversationId: string,
    history: { role: string; content: string }[],
    newMessage: string
  ): Promise<string> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('[AI] GEMINI_API_KEY is not set.');
        return 'Désolé, je ne peux pas vous répondre pour le moment (Clé API manquante).';
      }

      // Fetch the bot's system prompt from DB
      const bot = await prisma.user.findUnique({
        where: { id: botId },
        select: { botPrompt: true, profile: true }
      });

      const systemPrompt = bot?.botPrompt ||
        `Vous êtes ${bot?.profile?.displayName || 'un agent'}, un assistant du support client pour l'application Let's Out. Soyez bref, concis et très utile. Vous parlez en français.`;

      // ── Sanitize history for Gemini ──────────────────────────────────────────
      // Gemini requires:
      //   1. Roles must be 'user' or 'model' only
      //   2. History must alternate strictly user/model
      //   3. History must NOT start with 'model'
      //   4. History must NOT end with 'user' (the current message is the last user turn)
      const rawHistory = history.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content || '...' }]
      }));

      // Filter out empty content and enforce alternation
      const sanitizedHistory: { role: string; parts: { text: string }[] }[] = [];
      for (const turn of rawHistory) {
        const last = sanitizedHistory[sanitizedHistory.length - 1];
        if (last && last.role === turn.role) {
          // Merge consecutive same-role turns into one
          last.parts[0].text += '\n' + turn.parts[0].text;
        } else {
          sanitizedHistory.push({ ...turn, parts: [{ text: turn.parts[0].text }] });
        }
      }

      // History must not start with 'model'
      if (sanitizedHistory.length > 0 && sanitizedHistory[0].role === 'model') {
        sanitizedHistory.shift();
      }

      // History must not end with 'user' (the new message IS the last user turn)
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }

      console.log(`[AI] Calling Gemini for bot ${botId}, history length: ${sanitizedHistory.length}`);

      const chatModel = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt
      });

      const chat = chatModel.startChat({
        history: sanitizedHistory,
      });

      const result = await chat.sendMessage(newMessage);
      const text = result.response.text();
      console.log(`[AI] Got response (${text.length} chars)`);
      return text;
    } catch (error: any) {
      console.error('[AI] Error generating AI response:', error?.message || error);
      // Return a graceful fallback so the user still gets a message
      return "Je suis désolé, je rencontre des difficultés techniques. Un agent humain vous contactera bientôt.";
    }
  }
}

export const aiService = new AiService();
