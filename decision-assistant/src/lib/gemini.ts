import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DecisionData {
  title: string;
  options: { id: string; name: string }[];
  factors: { id: string; name: string; weight: number }[];
  ratings: Record<string, Record<string, number>>;
  scores: Record<string, number>;
}

export async function getDecisionInsights(data: DecisionData) {
  const prompt = `
    I am making a tough life decision: "${data.title}"
    
    Options: ${data.options.map(o => o.name).join(", ")}
    
    Factors and their importance (1-5):
    ${data.factors.map(f => `- ${f.name}: ${f.weight}`).join("\n")}
    
    Ratings given (1-5 where higher is better for the option):
    ${data.options.map(o => {
      return `For ${o.name}:
      ${data.factors.map(f => `  - ${f.name}: ${data.ratings[o.id]?.[f.id] ?? 0}`).join("\n")}`;
    }).join("\n")}
    
    Calculated Weighted Scores:
    ${Object.entries(data.scores).map(([id, score]) => {
      const option = data.options.find(o => o.id === id);
      return `- ${option?.name}: ${score.toFixed(2)}`;
    }).join("\n")}

    Please provide:
    1. A 3-4 sentence summary of the decision.
    2. Key trade-offs that the user should consider.
    3. Potential blind spots or reconsiderations.
    4. A final gentle nudge or observation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tradeOffs: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            blindSpots: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            finalObservation: { type: Type.STRING }
          },
          required: ["summary", "tradeOffs", "blindSpots", "finalObservation"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No insights generated");
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      summary: "We couldn't generate AI insights at this time, but based on the scores, you have a clear quantitative lead.",
      tradeOffs: ["Consider the relative importance of your top factors.", "Check if any rating was based purely on emotion."],
      blindSpots: ["Ensure all major life impact areas (health, family, finances) were covered."],
      finalObservation: "Numbers give clarity, but listen to your gut too."
    };
  }
}

export async function getSuggestedFactors(title: string, options: string[]) {
  const prompt = `
    I am making a decision: "${title}"
    The options I am considering are: ${options.join(", ")}
    
    Please suggest 4-6 most relevant factors or criteria I should use to evaluate these options.
    For each factor, suggest a weight (1-5) representing its typical importance for this type of decision.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedFactors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  weight: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["name", "weight", "description"]
              }
            }
          },
          required: ["suggestedFactors"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text).suggestedFactors;
    }
    return [];
  } catch (error) {
    console.error("Gemini Factors Error:", error);
    return [];
  }
}

export async function getCommunityWisdom(title: string) {
  const prompt = `
    I am looking for community wisdom and advice from Reddit regarding this decision: "${title}"
    
    1. Search for real Reddit discussions on this topic to understand the consensus, common pitfalls, and "Redditor's" perspective.
    2. Provide a 2-sentence summary of the general community advice or "vibe" found on Reddit for this type of choice.
    3. Provide 3-4 specific search result labels and URLs that would help the user find these discussions.
    
    Format the response strictly as JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { 
              type: Type.STRING, 
              description: "A 2-sentence executive summary of Reddit's general consensus or common advice on this topic." 
            },
            discussions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["label", "url"]
              }
            }
          },
          required: ["summary", "discussions"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini Community Wisdom Error:", error);
    return null;
  }
}
