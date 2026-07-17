import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error("NO API KEY");
    return;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const chatModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: "Tu es un agent de support Let's Out. Réponds en français."
  });

  const history = [
    { role: 'user', parts: [{ text: "aujourd'hui ?" }] },
    { role: 'model', parts: [{ text: "Je suis désolé..." }] },
  ];

  try {
    const chat = chatModel.startChat({ history });
    const result = await chat.sendMessage("est ce que tu peux m'aider pour l'inscription???");
    console.log("SUCCESS:", result.response.text());
  } catch (err: any) {
    console.error("ERROR:");
    console.error(err);
  }
}
run();
