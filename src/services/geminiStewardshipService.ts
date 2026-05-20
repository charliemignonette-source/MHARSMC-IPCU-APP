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
    1. APPROPRIATENESS: Evaluate if the requested drug/dose matches the likely pathogens for the specified focus and diagnosis.
    2. RESISTANCE/LOCAL DATA: Cross-reference with the provided local antibiogram data for the specific unit (${unit}). Alert if the empirical choice covers <80% of local strains.
    3. PHARMACOKINETICS: Critically evaluate the specific mg/kg dosing and interval. Recommend precise dose adjustments based strictly on the provided CrCl (${req.creatinineClearance} mL/min) and body weight (${req.weight} kg).
    4. DE-ESCALATION: Suggest step-down/narrow-spectrum alternatives if appropriate, especially if cultures are negative or pending.
    5. INTERVENTION: Conclude with a clear, definitive "APPROVED", "DENIED", or "MODIFY" recommendation for the AMS committee.

    Format the response using clear markdown, robust medical terminology, and emojis for quick visual parsing (e.g., ⚠️ for warnings, ✅ for safe choices). Keep it extremely concise but highly actionable (max 300 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error generating AI analysis. Please refer to standard institutional guidelines.";
  }
}
