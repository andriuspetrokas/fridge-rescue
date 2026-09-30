# Fridge Rescue

Mokomasis Next.js projektas: TheMealDB receptų paieška, Supabase paskyros ir išsaugoti receptai, Gemini receptų pritaikymas.

## Paleidimas

1. Įdiekite priklausomybes: `npm install`.
2. Nukopijuokite `.env.example` į `.env.local` ir įrašykite savo Supabase projekto URL bei Publishable key. Gemini API raktą galėsite įrašyti vėliau, kai vykdysite AI užduotį. Gemini modelį galima pakeisti per `GEMINI_MODEL`.
3. Supabase projekto SQL Editor paleiskite [supabase/schema.sql](supabase/schema.sql), tada [supabase/ai_recipes.sql](supabase/ai_recipes.sql). Jei pirmąjį failą jau paleidote anksčiau, vykdykite tik `ai_recipes.sql`. Supabase Auth nustatymuose įjunkite el. pašto registraciją; jei reikia, nustatykite patvirtinimo laiškų siuntimą.
4. Paleiskite `npm run dev` ir atidarykite `http://localhost:3000`.

Be Supabase ir Gemini raktų veiks TheMealDB paieška ir recepto peržiūra. Registracijai, išsaugojimui ir AI pritaikymui reikia atitinkamų paslaugų raktų.

## Atskiras Gemini bandymas

Įrašykite `GEMINI_API_KEY` į `.env.local` ir paleiskite `npm run test:gemini`. Šis serverio pusėje vykdomas scenarijus naudoja oficialų `@google/genai` SDK, modelį `gemini-3.8-flash` ir vieną trumpą klausimą apie picą. Receptų duomenų jis nenaudoja. Jei gaunate sakinį, API ryšys veikia. Jei bandymas nepavyksta, patikrinkite rakto reikšmę, kintamojo pavadinimą ir modelio prieinamumą savo API projektui. Jei raktą pakeitėte jau veikiančioje Next.js aplikacijoje, ją paleiskite iš naujo.

## Kur vyksta integracijos

- Naršyklė valdo formas, receptų vaizdavimą ir Supabase Auth prisijungimą.
- `app/api/meals` serverio maršrutas kreipiasi į TheMealDB: `filter.php?i=` ieško pagal vieną ingredientą, `search.php?s=` – pagal patiekalo pavadinimą. Paieškai naudokite angliškus žodžius. Laukiant užklausos rodomas pranešimas; tuščia paieška, nerasti receptai ir užklausos klaidos apdorojami atskirai.
- `app/api/saved` tikrina Supabase vartotojo prieigos žetoną ir išsaugo receptus. Lentelės RLS taisyklės riboja įrašus pagal vartotoją.
- `app/api/adapt` serveryje kreipiasi į Gemini. `GEMINI_API_KEY` niekada neturi `NEXT_PUBLIC_` prefikso.
- Po AI atsakymo prisijungęs vartotojas gali jį išsaugoti. `app/api/ai-recipes` tikrina sesiją ir saugo rezultatą `saved_ai_recipes` lentelėje; RLS leidžia matyti tik savo įrašus. Jie rodomi skiltyje „Mano AI receptai“.

## Pastaba

Gemini sukurtas tekstas yra pasiūlymas. Alergijų atveju tikrinkite ingredientų pakuotes ir sudėtį.
