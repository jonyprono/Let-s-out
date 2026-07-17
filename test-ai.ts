import { AiService } from './apps/api/src/services/ai.service.js';
import dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

async function run() {
  const ai = new AiService();
  const history = [
    { role: 'user', content: 'aujourd\'hui ?' },
    { role: 'bot', content: 'Je suis désolé, je rencontre des difficultés techniques. Un agent humain vous contactera bientôt.' },
    { role: 'user', content: 'Comment s\'inscrire' },
    { role: 'user', content: 'cc' }
  ];
  try {
    const reply = await ai.generateSupportResponse('fake-bot-id', 'conv-123', history, 'est ce que tu peux m\'aider pour l\'inscription???');
    console.log("SUCCESS:", reply);
  } catch (err: any) {
    console.error("ERROR:");
    console.error(err);
  }
}

run();
