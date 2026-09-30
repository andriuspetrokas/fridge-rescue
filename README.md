# Fridge Rescue

Mokomasis Next.js projektas: TheMealDB receptų paieška, Supabase paskyros ir išsaugoti receptai, Gemini receptų pritaikymas.

## Paleidimas

1. Įdiekite priklausomybes: `npm install`.
2. Nukopijuokite `.env.example` į `.env.local` ir įrašykite savo Supabase projekto URL bei Publishable key. Gemini API raktą galėsite įrašyti vėliau, kai vykdysite AI užduotį. Gemini modelį galima pakeisti per `GEMINI_MODEL`.
3. Supabase projekto SQL Editor paleiskite [supabase/schema.sql](supabase/schema.sql), [supabase/ai_recipes.sql](supabase/ai_recipes.sql) ir [supabase/kitchen.sql](supabase/kitchen.sql). Jau vykdytų failų kartoti nereikia. Supabase Auth nustatymuose įjunkite el. pašto registraciją; jei reikia, nustatykite patvirtinimo laiškų siuntimą.
4. Paleiskite `npm run dev` ir atidarykite `http://localhost:3000`.

Be Supabase ir Gemini raktų veiks TheMealDB paieška ir recepto peržiūra. Registracijai, išsaugojimui ir AI pritaikymui reikia atitinkamų paslaugų raktų.

## Atskiras Gemini bandymas

Įrašykite `GEMINI_API_KEY` į `.env.local` ir paleiskite `npm run test:gemini`. Šis serverio pusėje vykdomas scenarijus naudoja oficialų `@google/genai` SDK, modelį `gemini-3.8-flash` ir vieną trumpą klausimą apie picą. Receptų duomenų jis nenaudoja. Jei gaunate sakinį, API ryšys veikia. Jei bandymas nepavyksta, patikrinkite rakto reikšmę, kintamojo pavadinimą ir modelio prieinamumą savo API projektui. Jei raktą pakeitėte jau veikiančioje Next.js aplikacijoje, ją paleiskite iš naujo.

## Kur vyksta integracijos

- Naršyklė valdo formas, receptų vaizdavimą ir Supabase Auth prisijungimą.
- `app/api/meals` serverio maršrutas kreipiasi į TheMealDB: `filter.php?i=` ieško pagal vieną ingredientą, `search.php?s=` – pagal patiekalo pavadinimą. Angliška paieška siunčiama tiesiai į TheMealDB, o lietuvišką užklausą pirmiausia išverčia Gemini. Laukiant užklausos rodomas pranešimas; tuščia paieška, nerasti receptai ir užklausos klaidos apdorojami atskirai.
- `app/api/saved` tikrina Supabase vartotojo prieigos žetoną ir išsaugo receptus. Lentelės RLS taisyklės riboja įrašus pagal vartotoją.
- `app/api/adapt` serveryje kreipiasi į Gemini. `GEMINI_API_KEY` niekada neturi `NEXT_PUBLIC_` prefikso.
- Po AI atsakymo prisijungęs vartotojas gali jį išsaugoti. `app/api/ai-recipes` tikrina sesiją ir saugo rezultatą `saved_ai_recipes` lentelėje; RLS leidžia matyti tik savo įrašus. Jie rodomi skiltyje „Mano AI receptai“.

## Pastaba

Gemini sukurtas tekstas yra pasiūlymas. Alergijų atveju tikrinkite ingredientų pakuotes ir sudėtį.

## Svarbiausios sąvokos pristatymui

### Kas yra API?

API yra sutartas būdas, kuriuo skirtingos programos apsikeičia duomenimis. „Fridge Rescue“ per API gauna receptus iš TheMealDB, saugo vartotojų duomenis Supabase ir siunčia užduotis Gemini.

### Kas yra endpoint?

Endpoint yra konkretus API adresas, atliekantis tam tikrą veiksmą. Pavyzdžiui, `/api/meals` ieško receptų, `/api/adapt` pritaiko receptą, o `/api/kitchen` valdo vartotojo turimų produktų sąrašą.

### Kas yra request ir response?

Request yra programos siunčiama užklausa, pavyzdžiui, prašymas surasti receptus pagal `chicken`. Response yra serverio atsakymas su receptais, klaida ir HTTP statusu.

### Kas yra JSON?

JSON yra tekstinis duomenų formatas, patogus programoms perduoti struktūrizuotą informaciją. Recepto JSON gali turėti pavadinimą, ID, paveikslėlio adresą ir ingredientų sąrašą.

### Kas yra HTTP status?

HTTP statusas yra skaičius, parodantis užklausos rezultatą. `200` reiškia sėkmę, `400` – netinkamą užklausą, `401` – neprisijungusį vartotoją, `404` – nerastą įrašą, `429` – viršytą API limitą, o `500`–`503` – serverio arba išorinės paslaugos problemą.

### Kas yra API raktas?

API raktas identifikuoja projektą išorinėje paslaugoje ir leidžia naudoti jos API. Projekte Gemini raktas naudojamas AI užklausoms, o Supabase Publishable key leidžia aplikacijai prisijungti prie Supabase projekto.

### Kas yra autentifikacija?

Autentifikacija yra vartotojo tapatybės patikrinimas. Supabase patikrina el. paštą ir slaptažodį bei nustato, kuris vartotojas naudojasi aplikacija.

### Kuo skiriasi registracija ir prisijungimas?

Registruojantis sukuriama nauja vartotojo paskyra. Prisijungiant patikrinami jau sukurtos paskyros duomenys ir pradedama vartotojo sesija.

### Kas yra vartotojo session?

Session, arba sesija, yra prisijungimo būsena su prieigos žetonu. Supabase ją išsaugo naršyklėje, todėl po puslapio perkrovimo aplikacija vis dar žino, kad vartotojas prisijungęs.

### Kas yra vartotojo ID?

Vartotojo ID yra unikalus Supabase sukurtas vartotojo identifikatorius. Jis įrašomas prie išsaugotų receptų, AI receptų ir „Mano virtuvė“ produktų.

### Kas yra Environment Variables?

Environment Variables yra konfigūracijos reikšmės, laikomos atskirai nuo programos kodo. Lokaliai jos saugomos `.env.local`, o Vercel aplinkoje įrašomos projekto nustatymuose.

### Kodėl Gemini raktas laikomas serverio pusėje?

Naršyklėje naudojamą raktą lankytojas galėtų pamatyti ir panaudoti savo užklausoms. Todėl naršyklė kreipiasi į `/api/adapt` arba `/api/meals`, o tik Next.js serveris prie užklausos Gemini prideda `GEMINI_API_KEY`.

### Kam naudojamas Supabase?

Supabase naudojamas registracijai, prisijungimui, sesijoms ir PostgreSQL duomenų bazei. Joje saugomi vartotojo receptai, AI receptai ir „Mano virtuvė“ produktai.

### Kas yra RLS?

RLS, arba Row Level Security, yra duomenų bazės taisyklės, kontroliuojančios prieigą prie kiekvienos lentelės eilutės. Projekto taisyklės leidžia prisijungusiam vartotojui pasiekti tik įrašus, kurių `user_id` sutampa su jo Supabase ID.

### Kodėl du vartotojai mato skirtingus „Mano receptai“ duomenis?

Kiekvienas recepto įrašas turi savininko `user_id`. Serveris filtruoja duomenis pagal prisijungusį vartotoją, o Supabase RLS papildomai neleidžia perskaityti ar pakeisti svetimų įrašų.

### Kaip vieno API rezultatas perduodamas kitam API?

Paieškos rezultatas iš TheMealDB turi recepto ID. Paspaudus receptą šis ID tampa kitos TheMealDB užklausos įvestimi pilnam receptui gauti. Lietuviškoje paieškoje Gemini vertimas tampa TheMealDB paieškos įvestimi, o pritaikant receptą TheMealDB ingredientai ir Supabase saugomi „Mano virtuvė“ produktai perduodami Gemini.

### Kuo skiriasi TheMealDB, Supabase ir Gemini?

- **TheMealDB** pateikia realius receptus, jų ID, nuotraukas, ingredientus ir gaminimo instrukcijas.
- **Supabase** valdo vartotojų paskyras, sesijas, duomenų bazę ir prieigos taisykles.
- **Gemini** verčia lietuvišką paiešką ir pritaiko receptą pagal vartotojo situaciją bei turimus produktus.
