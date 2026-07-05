# EatWhatLeh 🍽️🇲🇾

EatWhatLeh is a smart, dynamic restaurant recommendation system and sequential itinerary planner tailored for Malacca (Melaka), Malaysia. It implements an AI-first conversational experience to solve the "what to eat?" dilemma.

## Project Vision & Core Features
- **Conversational AI Interface (Gemini/ChatGPT Style)**: Users chat with an AI assistant to get natural language, explainable recommendations (XAI) alongside interactive restaurant cards and itinerary routing.
- **Geospatial "Dining Set" Algorithm**: Automatically plans sequential culinary journeys (e.g., *Lunch ➔ Dessert ➔ Drinks*) optimized for proximity and opening hours around Malacca.
- **Social Food Feed**: A scrollable vertical feed showing nearby Melaka eateries with a social-media layout, review counts, distances, and popular tags.
- **Gamified Reviews & Crowdsourcing**: Earn XP, points, and food-themed badges (e.g., *"Sambal Explorer"*, *"Nyonya Master"*) by reviewing places or updating menu data.
- **Leaderboard**: A ranking system displaying active users' foodie achievements.

---

## Technical Stack
- **Frontend**: React (Vite, TypeScript, TailwindCSS/Vanilla CSS, Leaflet for Maps)
- **Backend**: Node.js & Express.js
- **Database**: PostgreSQL (with PostGIS for geospatial lookups)
- **ORM**: Prisma
- **Authentication**: Clerk Authentication
- **AI Reasoning**: Gemini API

---

## Geospatial Simulation & Data Focus
- **Geographic Center**: Malacca City, Malaysia (Latitude: `2.1896`, Longitude: `102.2501`).
- **Data Strategy**: PostgreSQL seeded with high-quality dummy data representing iconic Malacca restaurants, hawker centers, and cafes (e.g., Jonker Street, Kota Laksamana, Klebang).
- **LLM Engine**: Gemini API processes natural language user prompts and returns structured parameters for database filtering, and generates textual explanations for recommended venues.
