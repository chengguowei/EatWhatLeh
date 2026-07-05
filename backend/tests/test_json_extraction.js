import { parseUserPrompt } from '../src/services/gemini.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const query = "Suggest cheap halal Nyonya Main dishes then some Dessert at Jonker Street";
  console.log(`======================================================================`);
  console.log(`                EATWHATLEH - GEMINI NLP EXTRACTOR                     `);
  console.log(`======================================================================`);
  console.log(`[User Prompt Input]: "${query}"`);
  console.log(`[Processing]: Parsing user intent via Gemini API...`);
  
  try {
    const parsed = await parseUserPrompt(query);
    
    console.log(`\n[Structured JSON Output passed to Database Filters]:`);
    console.log(JSON.stringify(parsed, null, 2));
    console.log(`======================================================================`);
  } catch (err) {
    console.error("Error executing parser:", err);
  }
}

main();
