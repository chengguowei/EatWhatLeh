import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
];

let activeModelIndex = 0; // Remembers the last successful model index

async function generateContentWithFallback(prompt) {
  let lastError;
  const startIndex = activeModelIndex;
  
  for (let offset = 0; offset < MODELS.length; offset++) {
    const currentIndex = (startIndex + offset) % MODELS.length;
    const modelName = MODELS[currentIndex];
    
    try {
      console.log(`🤖 Attempting content generation with model: ${modelName}`);
      const model = getGenAI().getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`✅ Success using model: ${modelName}`);
      
      // Cache the successful index for the next call
      activeModelIndex = currentIndex;
      return text;
    } catch (err) {
      console.warn(`⚠️ Model ${modelName} failed, trying fallback:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Parse a user's natural language prompt into structured filter params.
 * Returns isConversational: true when the user is asking a follow-up question
 * (e.g. "how far is it?", "which one is cheaper?") rather than searching.
 */
export async function parseUserPrompt(prompt, history = []) {
  const systemInstruction = `
You are an AI assistant for EatWhatLeh, a Malacca (Malaysia) restaurant recommendation app.
Extract the user's dining intent from their message and return ONLY valid JSON.

IMPORTANT RULES:
1. If the user's message is a follow-up question about previously recommended places (e.g. "how far is it?", "which one is halal?", "what's the distance?", "how long to walk?", "which is cheaper?"), set isConversational: true and leave all other fields as defaults.
2. If the user's message is a new food/restaurant search, set isConversational: false and fill in the relevant fields.
3. For follow-up searches (e.g. "what about drinks?"), carry over relevant filters (isHalal, cuisine, etc.) from prior turns.
4. If the user specifically asks for "hidden gems", "local secrets", "secret spots", "undiscovered spots", or "not touristy", set findHiddenGems: true. Otherwise, default it to false.

JSON schema:
{
  "isConversational": boolean,                      // true if this is a follow-up Q&A, not a search
  "categories": ["Main"|"Dessert"|"Cafe"|"Bar"],
  "cuisine": string | null,
  "priceRange": "$"|"$$"|"$$$"|null,
  "isHalal": boolean | null,
  "keywords": string[],
  "isItinerary": boolean,
  "findHiddenGems": boolean,
  "intent": string
}

Examples:
- "I want spicy noodles" → isConversational: false, categories: ["Main"], keywords: ["spicy","noodles"], findHiddenGems: false
- "Dinner then dessert and drinks" → isConversational: false, categories: ["Main","Dessert","Bar"], isItinerary: true, findHiddenGems: false
- "How far is it?" → isConversational: true, findHiddenGems: false
- "Which one is cheaper?" → isConversational: true, findHiddenGems: false
- "Show me some local hidden gems" → isConversational: false, findHiddenGems: true
- "Any secret spots for dessert?" → isConversational: false, categories: ["Dessert"], findHiddenGems: true
- "What about drinks?" → isConversational: false, categories: ["Bar","Cafe"], findHiddenGems: false
`.trim();

  const recentHistory = history.slice(-6);
  const historyContext = recentHistory.length > 0
    ? '\n\nConversation history (for context):\n' +
      recentHistory.map((m) => `${m.role === 'user' ? 'User' : 'EatBot'}: ${m.text}`).join('\n')
    : '';

  const rawText = await generateContentWithFallback(`${systemInstruction}${historyContext}\n\nUser prompt: "${prompt}"\n\nRespond with ONLY the JSON, no markdown.`);
  const text = rawText.trim();

  try {
    // Strip markdown code fences if Gemini wraps the JSON anyway
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { isConversational: false, categories: ['Main'], cuisine: null, priceRange: null, isHalal: null, keywords: [], isItinerary: false, findHiddenGems: false, intent: prompt };
  }
}

/**
 * Generate an XAI explanation for a set of restaurant recommendations.
 * Distance info (distanceFromPrev for itinerary, distance for single) is included
 * in the summaries so Gemini can reference it naturally in the reply.
 */
export async function generateXAIExplanation(userPrompt, restaurants, isItinerary, parsed = {}, pricePref = 'NONE') {
  const restaurantSummaries = restaurants
    .map((r, i) => {
      const distInfo = r.distanceFromPrev !== undefined && r.distanceFromPrev !== null
        ? ` | ${r.distanceFromPrev.toFixed(1)} km from previous stop (~${r.walkMinutes} min walk)`
        : r.distance !== undefined && r.distance !== null
          ? ` | ${r.distance.toFixed(1)} km from user location`
          : '';
      const reviewsCount = r.reviews ? r.reviews.length : 0;
      const reviewInfo = ` | Reviews: ${reviewsCount} in database`;
      const recType = r.recommendationType ? ` | Category Section: ${r.recommendationType}` : '';
      return `${i + 1}. ${r.name} (${r.cuisine}, ${r.priceRange}, Rating: ${r.rating}/5)${distInfo}${reviewInfo}${recType} – ${r.description}`;
    })
    .join('\n');

  const { cuisine, priceRange, isHalal } = parsed;
  const prefTerms = [];
  if (pricePref && pricePref !== 'NONE') prefTerms.push(`budget level preference: ${pricePref}`);
  if (cuisine) prefTerms.push(`spicy/cuisine preference: ${cuisine}`);
  if (priceRange) prefTerms.push(`price tier preference: ${priceRange}`);
  if (isHalal) prefTerms.push(`halal requirements`);
  const activePrefsString = prefTerms.length > 0 ? prefTerms.join(', ') : 'none';

  const prompt = isItinerary
    ? `You are EatBot, a friendly Malacca food guide AI. The user asked: "${userPrompt}".
I have planned this dining itinerary for them:
${restaurantSummaries}

Write a warm, enthusiastic reply (2-3 sentences) explaining WHY this itinerary works — mention specific dishes, atmosphere, flow from one stop to the next, and the walking distances between stops. Be conversational and Malaysianly friendly (use "lah", "ah", "wah" occasionally).`
    : `You are EatBot, a friendly Malacca food guide AI. The user asked: "${userPrompt}".
Active user preferences: ${activePrefsString}

Here is the list of recommended restaurants, grouped by why they were selected:
${restaurantSummaries}

Write a warm, engaging reply. You MUST follow these guidelines:
1. Mention EVERY recommended restaurant from the list above by name in your reply. Do not leave any out.
2. Group the explanation by their Category Section:
   - For proximity/prompt results (Category Section: 'prompt'), explain that they are the closest spots matching their search.
   - For personalised matches (Category Section: 'preference'), explain how they match their taste preferences or search criteria (e.g. price preferences or desired cuisine).
   - For the hidden gem (Category Section: 'gem'), call it out as a highly-rated local secret with few reviews.
3. Keep the response conversational, warm, and Malaysianly friendly (using "lah", "ah", "wah" occasionally). Keep it brief but thorough enough to name all eateries (around 4-5 sentences in one neat paragraph).`;

  const rawText = await generateContentWithFallback(prompt);
  return rawText.trim();
}

/**
 * Generate a conversational follow-up reply (e.g. answering "how far is it?")
 * using the conversation history and the last set of recommended restaurants.
 */
export async function generateConversationalReply(userMessage, history, lastRestaurants = []) {
  const historyContext = history.slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'EatBot'}: ${m.text}`)
    .join('\n');

  const restaurantContext = lastRestaurants.length > 0
    ? '\n\nRestaurants that were recommended:\n' + lastRestaurants
        .map((r) => {
          const distInfo = r.distanceFromPrev !== undefined && r.distanceFromPrev !== null
            ? `${r.distanceFromPrev.toFixed(1)} km from previous stop (~${r.walkMinutes} min walk)`
            : r.distance !== undefined && r.distance !== null
              ? `${r.distance.toFixed(1)} km from user location`
              : 'distance unknown';
          return `- ${r.name} (${r.cuisine}, ${r.priceRange}, Halal: ${r.isHalal ? 'Yes' : 'No'}) | ${distInfo}`;
        })
        .join('\n')
    : '';

  const prompt = `You are EatBot, a friendly Malacca food guide AI assistant.
Answer the user's follow-up question based on the conversation history and restaurant data below.

Conversation history:
${historyContext}${restaurantContext}

User's question: "${userMessage}"

Give a helpful, accurate answer in 1-2 sentences. Use Malaysian-friendly language (use "lah", "ah", "wah" occasionally). If asked about distance or walking time, reference the specific numbers provided above.`;

  const rawText = await generateContentWithFallback(prompt);
  return rawText.trim();
}
