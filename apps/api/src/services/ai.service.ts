import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 'dummy_key_for_now';
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
        console.warn('GEMINI_API_KEY is not set. Generating a fallback response.');
        return 'Désolé, je ne peux pas vous répondre pour le moment (Clé API manquante).';
      }

      // Fetch the bot's system prompt from DB
      const bot = await prisma.user.findUnique({
        where: { id: botId },
        select: { botPrompt: true, profile: true }
      });

      const systemPrompt = bot?.botPrompt || `Vous êtes ${bot?.profile?.displayName || 'un agent'}, un assistant du support client pour l'application Let's Out. Soyez bref, concis et très utile. Vous parlez en français.`;

      // Convert history to Gemini format
      const formattedHistory = history.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // In Gemini API, system instructions are set when instantiating the chat or the model
      const chatModel = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt
      });

      const chat = chatModel.startChat({
        history: formattedHistory,
      });

      const result = await chat.sendMessage(newMessage);
      return result.response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      return "Je suis désolé, je rencontre des difficultés techniques pour vous répondre actuellement.";
    }
  }
}

export const aiService = new AiService();
