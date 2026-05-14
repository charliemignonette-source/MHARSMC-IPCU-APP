import { GoogleGenAI } from "@google/genai";
import { AMSRequest } from "../types";
import { INSTITUTIONAL_ANTIBIOGRAM_DATA } from "./amsAlertService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getGeminiStewardshipAnalysis(req: Partial<AMSRequest>, unit: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "AI Analysis unavailable: Gemini API key not configured.";
  }

  const prompt = `
    You are a Senior Infectious Disease Specialist and Antimicrobial Stewardship (AMS) Lead.
    Analyze the following antimicrobial request and provide a concise, high-impact clinical recommendation.
    
    PATIENT DATA:
    - Age/Sex: ${req.age} ${req.ageUnit} / ${req.sex}
    - Weight: ${req.weight} kg
    - Lab Data: CrCl ${req.creatinineClearance} mL/min, SGPT ${req.sgpt}, SGOT ${req.sgot}
    - Diagnosis: ${req.infectiousDiagnosis}
    - Induction/Focus: ${req.indicationForUse} / ${req.focusOfInfection?.join(', ')}
    - Critically Ill: ${req.criticallyIll ? 'Yes (Sepsis: ' + req.criticallyIll.sepsisCriteria.join(', ') + ')' : 'No'}
    
    ANTIMICROBIALS REQUESTED:
    - Drugs: ${req.antimicrobialsRequested?.join(', ')}
    - Doses: ${JSON.stringify(req.drugDoses)}
    - Regimen: ${req.dosingRegimen}
    
    MICROBIOLOGY & HISTORY:
    - Cultures Sent: ${req.cultureSent?.join(', ')} (${req.cultureDateSent})
    - Microbiology Results: ${JSON.stringify(req.microbiologyResults || req.microbiology)}
    - Previous Antibiotics: ${JSON.stringify(req.previousAntibiotics)}
    - Immunocompromising Conditions: ${req.immunocompromisingCondition?.join(', ')}
    
    LOCAL INSTITUTIONAL DATA (2024 Antibiogram):
    ${JSON.stringify(INSTITUTIONAL_ANTIBIOGRAM_DATA)}
    
    TASK:
    1. Assess the appropriateness of the requested antibiotic based on the diagnosis and focus.
    2. Check for potential resistance risks using the local antibiogram data for the specific unit (${unit}).
    3. Suggest any adjustments to the dosing based on patient's renal/hepatic function (if applicable).
    4. Provide a clear "ACTION" or "WARNING" if something looks clinically risky.
    
    Keep the response concise (max 200 words), professional, and formatted with bullet points/emojis as in the existing system.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error generating AI analysis. Please refer to standard institutional guidelines.";
  }
}
