import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SimulationAnalysis, FilmRecipe } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

// Retry wrapper for network stability
const withRetry = async <T>(operation: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Gemini API attempt failed. Retrying... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(operation, retries - 1, delay * 1.5);
  }
};

export const analyzeSimulationProfile = async (
  fileName: string,
  fileContent: string | null, // Text content for CUBE or FP1
  fileType: 'FP1' | 'CUBE'
): Promise<SimulationAnalysis> => {
  try {
    const ai = getClient();
    const modelId = 'gemini-2.5-flash';

    let prompt = `You are a Fujifilm Color Science Engineer. Your task is to translate a color grading file into universal "Develop Settings" for a linear raw processor.
    
    Input File: "${fileName}"
    Type: ${fileType}
    `;

    if (fileType === 'CUBE' && fileContent) {
       // Truncate CUBE content significantly to avoid large payload errors
       const lines = fileContent.split('\n');
       const header = lines.slice(0, 20).filter(l => l.trim().length > 0 && !l.startsWith('0') && !l.startsWith('1')).join('\n');
       prompt += `\nLUT Header Info:\n${header}\n`;
       prompt += `\nBased on the LUT name and header, infer the visual style.`;
    } else if (fileType === 'FP1' && fileContent) {
      // Truncate FP1 content to essential tags to avoid large payload errors
      prompt += `\nFP1 XML/Property Content:\n\`\`\`xml\n${fileContent.substring(0, 1500)}\n\`\`\`\n`;
      prompt += `\nTASK: Parse the FP1 properties (e.g., HighlightTone, ShadowTone, ColorSaturation, WBShift, FilmSimulation).
      
      Fuji to Slider Mapping Rules:
      1. **Film Simulation**: 
         - ACROS/MONOCHROME -> Saturation: -100.
         - CLASSIC CHROME -> Saturation: -15, Contrast: +10.
         - VELVIA -> Saturation: +30, Contrast: +20.
         - ETERNA -> Saturation: -25, Contrast: -15, Highlights: -20, Shadows: -10.
         
      2. **Highlight Tone** (Affects bright areas):
         - HARD (+2) -> Highlights: +30
         - MEDIUM HARD (+1) -> Highlights: +15
         - STANDARD (0) -> Highlights: 0
         - MEDIUM SOFT (-1) -> Highlights: -20 (Recovery)
         - SOFT (-2) -> Highlights: -40 (Strong Recovery)
         
      3. **Shadow Tone** (Affects dark areas):
         - HARD (+2) -> Shadows: +30 (Crushed blacks)
         - MEDIUM HARD (+1) -> Shadows: +15
         - STANDARD (0) -> Shadows: 0
         - MEDIUM SOFT (-1) -> Shadows: -15 (Lifted blacks)
         - SOFT (-2) -> Shadows: -30 (Faded blacks)
         
      4. **Color/Saturation**:
         - HIGH (+2) -> Saturation: +20
         - MEDIUM HIGH (+1) -> Saturation: +10
         - LOW (-2) -> Saturation: -20
         
      5. **White Balance Shift**:
         - Look for <WBShiftR> and <WBShiftB>.
         - Positive R -> Temperature: + (Warmer)
         - Negative R -> Temperature: - (Cooler)
         - Positive B -> Tint: - (Green)
         - Negative B -> Tint: + (Magenta)
         - Rough scale: 1 step in Fuji WB ~ 100K or 5 Tint units.
         
      Combine the base Film Simulation look with the specific Tone/Color modifiers.
      `;
    } else {
      prompt += `\nAnalyze the filename to deduce the intended classic film stock emulation.`;
    }

    prompt += `
    Return a JSON object with the following schema:
    - mood: Array of 3 keywords.
    - suggestedSettings: object containing:
       - contrast (-100 to 100)
       - highlights (-100 to 100) (Positive = Brighter/Harder, Negative = Recovered/Softer)
       - shadows (-100 to 100) (Positive = Darker/Harder, Negative = Lifted/Softer)
       - saturation (-100 to 100)
       - exposure (-2.0 to 2.0)
       - temperature (Base is 6500. Return the *target* kelvin, e.g., 5500 for Cool, 7500 for Warm)
       - tint (-50 to 50)
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Display name of recipe" },
            description: { type: Type.STRING, description: "Brief technical explanation" },
            mood: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedSettings: {
              type: Type.OBJECT,
              properties: {
                contrast: { type: Type.NUMBER },
                highlights: { type: Type.NUMBER },
                shadows: { type: Type.NUMBER },
                saturation: { type: Type.NUMBER },
                exposure: { type: Type.NUMBER },
                temperature: { type: Type.NUMBER },
                tint: { type: Type.NUMBER }
              }
            }
          },
          required: ["name", "description", "mood", "suggestedSettings"]
        }
      }
    }));

    if (response.text) {
      return JSON.parse(response.text) as SimulationAnalysis;
    }
    
    throw new Error("No response text received from Gemini");
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      name: fileName,
      description: "AI Analysis unavailable. Using default values.",
      mood: ["Standard"],
      suggestedSettings: { contrast: 0, saturation: 0, highlights: 0, shadows: 0, exposure: 0, temperature: 6500, tint: 0 }
    };
  }
};

export const generateAiRecipe = async (prompt: string): Promise<FilmRecipe> => {
    const ai = getClient();
    const modelId = 'gemini-2.5-flash';

    const systemPrompt = `
    You are an expert Fujifilm Recipe Creator. 
    The user will provide a mood, a description of a scene, a reference to a movie, or a raw block of text from a recipe website.
    Your job is to create a valid Fujifilm Recipe JSON object based on this input.

    If the input is a URL or website text, extract the recipe settings accurately.
    If the input is a creative prompt (e.g. "Cyberpunk city"), generate a recipe that matches that vibe.

    Rules:
    - Base ISO should be 'Auto' or a specific ISO if the look demands grain (e.g. 3200).
    - Tint Shift is -10 to +10 range.
    - Color Saturation is -4 to +4 range.
    - Highlights/Shadows are -2 to +4 range.
    - White Balance is 2500K to 10000K.
    - Film Simulations: 'Classic Chrome', 'Classic Neg', 'Velvia', 'Provia', 'Astia', 'ACROS', 'Eterna', 'Eterna Bleach Bypass', 'PRO Neg. Hi', 'PRO Neg. Std'.
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: modelId,
        contents: `User Prompt: ${prompt}`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    iso: { type: Type.STRING },
                    usedFor: { type: Type.STRING },
                    characteristics: { type: Type.STRING },
                    category: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    settings: {
                        type: Type.OBJECT,
                        properties: {
                            filmSimulation: { type: Type.STRING },
                            dynamicRange: { type: Type.STRING },
                            whiteBalance: { type: Type.NUMBER },
                            tintShift: { type: Type.NUMBER },
                            wbShiftR: { type: Type.NUMBER },
                            wbShiftB: { type: Type.NUMBER },
                            colorChrome: { type: Type.STRING },
                            colorChromeBlue: { type: Type.STRING },
                            highlights: { type: Type.NUMBER },
                            shadows: { type: Type.NUMBER },
                            noiseReduction: { type: Type.NUMBER },
                            sharpness: { type: Type.NUMBER },
                            colorSaturation: { type: Type.NUMBER },
                            grainEffect: { type: Type.STRING },
                        },
                        required: ["filmSimulation", "whiteBalance", "highlights", "shadows", "colorSaturation"]
                    }
                }
            }
        }
    }));

    if (!response.text) throw new Error("Failed to generate recipe");
    
    const result = JSON.parse(response.text) as FilmRecipe;
    // Ensure unique ID
    result.id = `ai-gen-${Date.now()}`;
    return result;
};

export const analyzeLutToRecipe = async (lutName: string, lutContent: string): Promise<FilmRecipe> => {
    const ai = getClient();
    const modelId = 'gemini-2.5-flash';

    // Truncate LUT content significantly to avoid token limits and payload errors
    const headerLines = lutContent.split('\n').slice(0, 20).join('\n');
    
    const prompt = `
    Analyze this 3D LUT (.cube) file header and approximate the closest Fujifilm In-Camera Recipe settings to mimic this look.
    
    LUT Name: ${lutName}
    Header/Metadata:
    ${headerLines}
    
    If the name implies specific film stocks (e.g. Portra, Kodachrome, Teal & Orange), use that knowledge.
    If it's a generic LUT, infer contrast and saturation from the name (e.g. "Punchy", "Fade", "Log").

    Return a valid FilmRecipe JSON.
    Rules:
    - Map 'Teal/Orange' or 'Cinema' looks to 'Classic Chrome' or 'Eterna'.
    - Map 'Vivid' looks to 'Velvia'.
    - Map 'Portrait' looks to 'Pro Neg Hi' or 'Astia'.
    - Highlights/Shadows range: -2 to +4.
    - Color Saturation range: -4 to +4.
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
             responseMimeType: "application/json",
             responseSchema: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    iso: { type: Type.STRING },
                    usedFor: { type: Type.STRING },
                    characteristics: { type: Type.STRING },
                    category: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    settings: {
                        type: Type.OBJECT,
                        properties: {
                            filmSimulation: { type: Type.STRING },
                            dynamicRange: { type: Type.STRING },
                            whiteBalance: { type: Type.NUMBER },
                            tintShift: { type: Type.NUMBER },
                            wbShiftR: { type: Type.NUMBER },
                            wbShiftB: { type: Type.NUMBER },
                            colorChrome: { type: Type.STRING },
                            colorChromeBlue: { type: Type.STRING },
                            highlights: { type: Type.NUMBER },
                            shadows: { type: Type.NUMBER },
                            noiseReduction: { type: Type.NUMBER },
                            sharpness: { type: Type.NUMBER },
                            colorSaturation: { type: Type.NUMBER },
                            grainEffect: { type: Type.STRING },
                        },
                        required: ["filmSimulation", "whiteBalance", "highlights", "shadows", "colorSaturation"]
                    }
                }
            }
        }
    }));
    
    if (!response.text) throw new Error("Failed to convert LUT to recipe");
    const result = JSON.parse(response.text) as FilmRecipe;
    result.id = `lut-gen-${Date.now()}`;
    return result;
}