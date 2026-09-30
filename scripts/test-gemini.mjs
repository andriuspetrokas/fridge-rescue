import { ApiError, GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error('Trūksta GEMINI_API_KEY reikšmės .env.local faile.');
  process.exit(1);
}

// Šis bandymas naudoja tik .env.local GEMINI_API_KEY, net jei terminale yra kitas Google raktas.
delete process.env.GOOGLE_API_KEY;

const ai = new GoogleGenAI({ apiKey });
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    console.log(`Siunčiamas bandomasis promptas Gemini (${attempt}/3)...`);
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Parašyk vieną sakinį apie picą.',
    });
    if (!response.text?.trim()) throw new Error('Gemini grąžino tuščią atsakymą.');
    console.log('Gemini atsakymas:', response.text.trim());
    break;
  } catch (error) {
    if (error instanceof ApiError && error.status === 503 && attempt < 3) {
      const delay = 2000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
      console.warn(`Gemini modelis užimtas (503). Bandysiu dar kartą po ${Math.ceil(delay / 1000)} s.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    console.error(error instanceof ApiError && error.status === 503
      ? 'Gemini modelis šiuo metu perkrautas (503). Pabandykite vėliau.'
      : `Gemini bandymas nepavyko: ${error instanceof Error ? error.message : 'Nežinoma klaida.'}`);
    process.exitCode = 1;
    break;
  }
}
