import Groq from 'groq-sdk';
import { PrismaClient } from '@prisma/client';
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

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });
  }

  private async callGroqWithFallback(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    let lastError: any = null;

    for (const model of GROQ_MODELS) {
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

        // Ne pas essayer les autres modèles si c'est une erreur d'auth (clé invalide)
        if (status === 401 || status === 403) {
          console.error('[AI] Clé API invalide ou révoquée — arrêt des tentatives.');
          break;
        }
        // Continuer sur le prochain modèle pour les erreurs 404 (modèle introuvable) ou 429 (quota)
      }
    }

    // Tous les modèles ont échoué
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
    newMessage: string
  ): Promise<string> {
    try {
      if (!process.env.GROQ_API_KEY) {
        console.error('[AI] ❌ GROQ_API_KEY manquante dans les variables d\'environnement.');
        return 'Désolé, je ne peux pas vous répondre pour le moment (configuration manquante).';
      }

      console.log(`[AI] generateSupportResponse — bot: ${botId}, conv: ${_conversationId}, history: ${history.length} msgs`);

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
        console.error('[AI] Erreur lors de la récupération du contexte RAG:', ctxErr?.message ?? ctxErr);
        // On continue sans le contexte RAG
      }
      // -----------------------------------------------

      // Build messages array for Groq (OpenAI-compatible format)
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
      console.error('[AI] Erreur inattendue dans generateSupportResponse:');
      console.error('  message :', error?.message ?? String(error));
      console.error('  stack   :', error?.stack);
      return "Je suis désolé, je rencontre des difficultés techniques. Un agent humain vous contactera bientôt.";
    }
  }
}

export const aiService = new AiService();
