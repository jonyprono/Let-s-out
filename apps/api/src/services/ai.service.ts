import Groq from 'groq-sdk';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

// Modèle principal + fallbacks si le modèle est indisponible
const GROQ_MODELS = [
  'llama-3.1-8b-instant',      // Modèle récent
  'llama3-8b-8192',            // Modèle très stable et toujours dispo
  'llama3-70b-8192',           // Llama 3 classique
  'mixtral-8x7b-32768'         // Fallback ultime (Mixtral)
];

export class AiService {
  private groq: Groq;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  private async fetchImageAsGeminiPart(url: string) {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return {
        inlineData: {
          data: base64,
          mimeType
        }
      };
    } catch (err) {
      console.error('[AI] Erreur lors du téléchargement de l\'image pour Gemini:', err);
      return null;
    }
  }

  private async callGeminiWithImage(systemPrompt: string, history: any[], newMessage: string, imageUrl: string): Promise<string | null> {
    if (!process.env.GEMINI_API_KEY) {
      console.log('[AI] GEMINI_API_KEY manquante, fallback vers Groq.');
      return null;
    }

    try {
      console.log(`[AI] Essai de Gemini (gemini-1.5-flash) pour l'analyse d'image...`);
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const imagePart = await this.fetchImageAsGeminiPart(imageUrl);
      if (!imagePart) {
        return null; // Fallback to Groq if image download fails
      }

      // Convert history to Gemini format (optional, we could just pass it in the prompt)
      let prompt = `${systemPrompt}\n\nHistorique de conversation :\n`;
      for (const msg of history) {
        prompt += `${msg.role === 'bot' ? 'Agent' : 'Utilisateur'} : ${msg.content}\n`;
      }
      prompt += `\nNouveau message (avec image) : ${newMessage}\n`;

      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      console.log(`[AI] ✅ Succès avec Gemini (${text.length} chars)`);
      return text;
    } catch (error: any) {
      console.error('[AI] ❌ Erreur Gemini:', error?.message || error);
      return null; // Fallback to Groq
    }
  }

  private async callGroqWithFallback(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    let lastError: any = null;

    if (!process.env.GROQ_API_KEY) {
      return "Désolé, l'agent ne peut pas vous répondre (Clé Groq manquante).";
    }

    // 1. Fetch available models directly from the user's API key
    let availableModels: string[] = [];
    try {
      const modelsList = await this.groq.models.list();
      availableModels = modelsList.data.map(m => m.id);
      console.log(`[AI] Modèles Groq disponibles pour cette clé : ${availableModels.join(', ')}`);
    } catch (err) {
      console.error('[AI] Impossible de récupérer la liste des modèles Groq:', err);
      availableModels = GROQ_MODELS; // Fallback to hardcoded if fetch fails
    }

    // 2. Try models that contain 'llama', 'mixtral', 'gemma', 'qwen', or 'gpt' (prioritize chat models)
    // Exclude 'guard' and 'whisper' models
    const modelsToTry = availableModels
      .filter(m => m.includes('llama') || m.includes('mixtral') || m.includes('gemma') || m.includes('qwen') || m.includes('gpt'))
      .filter(m => !m.includes('guard') && !m.includes('whisper') && !m.includes('safeguard'))
      .sort((a, b) => {
        // Prefer qwen or newer ones
        if (a.includes('qwen') && !b.includes('qwen')) return -1;
        if (a.includes('8b') && !b.includes('8b')) return -1;
        return 0;
      });

    if (modelsToTry.length === 0) {
      modelsToTry.push(...GROQ_MODELS); // Fallback if no known names found
    }

    for (const model of modelsToTry) {
      try {
        console.log(`[AI] Essai modèle: ${model}`);
        const completion = await this.groq.chat.completions.create({
          model,
          messages,
          max_tokens: 512,
          temperature: 0.7,
        });
        const text = completion.choices[0]?.message?.content || '';
        console.log(`[AI] ✅ Succès avec ${model} (${text.length} chars)`);
        return text;
      } catch (err: any) {
        lastError = err;
        const status = err?.status ?? err?.statusCode ?? 'N/A';
        const msg = err?.message ?? String(err);
        const errType = err?.error?.type ?? err?.code ?? 'unknown';
        console.error(`[AI] ❌ Échec avec ${model} — status: ${status}, type: ${errType}, message: ${msg}`);

        if (status === 401 || status === 403) {
          console.error('[AI] Clé API invalide ou révoquée — arrêt des tentatives.');
          break;
        }
      }
    }

    const status = lastError?.status ?? lastError?.statusCode;
    if (status === 401 || status === 403) {
      return "Je suis désolé, je rencontre un problème d'authentification. Un agent humain vous contactera bientôt.";
    }
    if (status === 429) {
      return "Je suis désolé, je reçois trop de demandes en ce moment. Veuillez réessayer dans quelques instants.";
    }
    return "Je suis désolé, je rencontre des difficultés techniques. Un agent humain vous contactera bientôt.";
  }

  async generateSupportResponse(
    botId: string,
    _conversationId: string,
    history: { role: string; content: string }[],
    newMessage: string,
    mediaUrl?: string | null
  ): Promise<string> {
    try {
      console.log(`[AI] generateSupportResponse — bot: ${botId}, conv: ${_conversationId}, history: ${history.length} msgs, mediaUrl: ${mediaUrl}`);

      // Fetch the bot's system prompt from DB
      const bot = await prisma.user.findUnique({
        where: { id: botId },
        select: { botPrompt: true, profile: true }
      });

      let systemPrompt = bot?.botPrompt ||
        `Tu es ${bot?.profile?.displayName || 'un agent'}, un assistant du support client pour l'application Let's Out. Sois bref, concis et très utile. Tu parles en français. Ne dis jamais que tu es une IA ou un robot. Réponds directement aux questions de l'utilisateur.`;

      // RAG ARCHITECTURE: INJECT SYSTEM CONTEXT
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

            const latestEvent = await prisma.event.findFirst({
              where: { creatorId: u.id },
              orderBy: { createdAt: 'desc' }
            });

            if (latestEvent) {
              contextString += `\nL'utilisateur a récemment créé l'événement suivant :\n`;
              contextString += `- Événement : ${latestEvent.title}\n`;
              contextString += `- Statut : ${latestEvent.status}\n`;
              contextString += `- Cagnotte récoltée : ${latestEvent.poolCollected} F CFA\n`;
              if (latestEvent.registrationDeadline) {
                contextString += `- Date limite d'inscription : ${latestEvent.registrationDeadline.toISOString()}\n`;
              }
            }
          }
          
          contextString += `</SYSTEM_CONTEXT>`;
          systemPrompt += contextString;
        }
      } catch (ctxErr: any) {
        console.error('[AI] Erreur RAG:', ctxErr?.message ?? ctxErr);
      }

      // If there's an image, try Gemini first
      if (mediaUrl) {
        const geminiResponse = await this.callGeminiWithImage(systemPrompt, history, newMessage, mediaUrl);
        if (geminiResponse) {
          return geminiResponse;
        }
        console.log(`[AI] Fallback vers Groq après échec ou bypass de Gemini.`);
      }

      // Build messages array for Groq
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt }
      ];

      for (const msg of history) {
        if (msg.role === 'bot' || msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content || '...' });
        } else {
          messages.push({ role: 'user', content: msg.content || '...' });
        }
      }

      messages.push({ role: 'user', content: newMessage });

      return await this.callGroqWithFallback(messages);

    } catch (error: any) {
      console.error('[AI] Erreur inattendue dans generateSupportResponse:', error?.message ?? String(error));
      return "Je suis désolé, je rencontre des difficultés techniques. Un agent humain vous contactera bientôt.";
    }
  }
}

export const aiService = new AiService();
