
import { GoogleGenAI, Type } from "@google/genai";
import { Vehicle, ComplianceRecord, ComplianceAuditInsight } from "../types";

// Analyze vehicle compliance using Gemini 3 Pro
export const getComplianceAudit = async (
  vehicle: Vehicle,
  records: ComplianceRecord[]
): Promise<ComplianceAuditInsight> => {
  // Use process.env.API_KEY directly as required by standard
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use vehicle_number instead of registrationNumber
  const prompt = `Analyze the compliance status of the following vehicle:
    Vehicle: ${vehicle.vehicle_number} (${vehicle.make} ${vehicle.model}, ${vehicle.year})
    Records: ${JSON.stringify(records)}
    
    Today's Date is ${new Date().toISOString().split('T')[0]}.
    
    Provide an audit summary, a status (Critical if expired, Warning if expiring soon, Healthy otherwise), and specific recommendations to maintain legal operation.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["status", "summary", "recommendations"]
        }
      }
    });

    // Access property .text directly (not a method)
    const jsonStr = response.text?.trim() || '{}';
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error("Gemini Audit Error:", error);
    return { status: 'Healthy', summary: 'Audit temporarily unavailable.', recommendations: [] };
  }
};

// Generate a professional reminder email using Gemini 3 Flash
export const generateReminderEmail = async (
  vehicle: Vehicle,
  record: ComplianceRecord,
  daysRemaining: number,
  template?: { subject: string; body: string }
): Promise<{ subject: string; body: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const defaultSubject = `⚠️ Vehicle Document Expiry Reminder – {{Document Type}}`;
  const defaultBody = `Hello,
This is a reminder that the following vehicle document is nearing expiry:
Vehicle Number: {{Vehicle Number}}
Document Type: {{Document Type}}
Expiry Date: {{Expiry Date}}
Days Remaining: {{Remaining Days}}
Please ensure the document is renewed before the expiry date.
Regards,
Vehicle Compliance System`;

  const userSubject = template?.subject || defaultSubject;
  const userBody = template?.body || defaultBody;

  // Use vehicle_number instead of registrationNumber
  const prompt = `You are a professional fleet management system. Generate a finalized email using the user's template.
    
    DATA:
    Vehicle Number: ${vehicle.vehicle_number}
    Document Type: ${record.type}
    Expiry Date: ${record.expiryDate}
    Remaining Days: ${daysRemaining}

    TEMPLATE:
    Subject: ${userSubject}
    Body: ${userBody}

    INSTRUCTIONS:
    1. Replace all placeholders like {{Vehicle Number}}, {{Document Type}}, {{Expiry Date}}, and {{Remaining Days}} with actual data.
    2. Maintenance professional tone.
    3. Output in JSON format with 'subject' and 'body' keys.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING }
          },
          required: ["subject", "body"]
        }
      }
    });

    // Access property .text directly
    const text = response.text;
    const data = JSON.parse(text || '{}');
    return {
      subject: data.subject || userSubject,
      body: data.body || userBody
    };
  } catch (error: any) {
    console.error("Gemini Email Generation Error:", error);
    return {
      subject: userSubject.replace('{{Document Type}}', record.type),
      body: userBody
        .replace('{{Vehicle Number}}', vehicle.vehicle_number)
        .replace('{{Document Type}}', record.type)
        .replace('{{Expiry Date}}', record.expiryDate)
        .replace('{{Remaining Days}}', daysRemaining.toString())
    };
  }
};
