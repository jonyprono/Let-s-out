/**
 * Script de diagnostic Groq — à exécuter manuellement
 * node --import tsx apps/api/src/scripts/test-groq.ts
 */
import Groq from 'groq-sdk';

const key = process.env.GROQ_API_KEY;
console.log('[TEST] GROQ_API_KEY présente :', !!key);
console.log('[TEST] Longueur de la clé :', key?.length ?? 0);
console.log('[TEST] Préfixe de la clé :', key?.substring(0, 8) ?? 'N/A');

if (!key) {
  console.error('[TEST] ❌ GROQ_API_KEY manquante. Arrêt.');
  process.exit(1);
}

const groq = new Groq({ apiKey: key });

async function test() {
  try {
    console.log('\n[TEST] Appel à Groq (modèle: llama-3.1-8b-instant)...');
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Tu es un assistant de support client.' },
        { role: 'user', content: 'Bonjour, dis juste "Test OK".' }
      ],
      max_tokens: 20,
    });
    const text = completion.choices[0]?.message?.content;
    console.log('[TEST] ✅ Réponse Groq :', text);
  } catch (err: any) {
    console.error('[TEST] ❌ Erreur Groq :');
    console.error('  message :', err?.message);
    console.error('  status  :', err?.status);
    console.error('  code    :', err?.code);
    console.error('  type    :', err?.error?.type);
    console.error('  full    :', JSON.stringify(err?.error, null, 2));
  }
}

test();
