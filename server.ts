import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ quiet: true });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Bumped from 10mb to 50mb: encrypted evidence recordings (video/audio,
// base64-encoded — which inflates size ~33%) are sent as JSON bodies to
// /api/evidence/upload below, and 10mb was too small for more than a few
// seconds of footage.
app.use(express.json({ limit: '50mb' }));

// Helper to initialize Gemini SDK safely
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Route: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API Route 1: Risk Assessment Prediction
app.post('/api/ai/predict-risk', async (req, res) => {
  try {
    const { locationName, timeOfDay, weather, crowdDensity, firCount, recentReports } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      // Fallback structured response if key is missing or env unconfigured
      return res.json({
        safetyScore: Math.max(35, 90 - (firCount || 0) * 8 - (timeOfDay === 'Night' ? 20 : 0)),
        riskLevel: (firCount > 3 || timeOfDay === 'Late Night') ? 'High Risk' : 'Moderate Caution',
        summary: `Analysis for ${locationName || 'Selected Area'}: Based on local crowd density (${crowdDensity || 'Moderate'}) and time (${timeOfDay || 'Current'}).`,
        factors: [
          `Lighting Quality: ${timeOfDay === 'Night' ? 'Limited in side lanes' : 'Good visibility'}`,
          `CCTV & Police Presence: ${firCount > 2 ? 'Active monitoring recommended' : 'Regular police patrol area'}`,
          `Crowd & Traffic: ${crowdDensity || 'Moderate'} pedestrian traffic`
        ],
        safetyTips: [
          'Stick to main well-lit thoroughfares.',
          'Keep your live GPS tracking active in GuardIA SOS mode.',
          'Identify nearby safe hubs (24/7 pharmacies, police booths).'
        ]
      });
    }

    const prompt = `Analyze personal safety risk for location: "${locationName || 'Urban Corridor'}".
    Context details:
    - Time of day: ${timeOfDay || 'Evening'}
    - Weather: ${weather || 'Clear'}
    - Crowd Density: ${crowdDensity || 'Moderate'}
    - Local Incident/FIR Count: ${firCount || 1}
    - Recent Community Reports: ${JSON.stringify(recentReports || ['Reported poor street lighting', 'Occasional late night harassment'])}

    Return a clean JSON object ONLY with the following key structure:
    {
      "safetyScore": <number 0 to 100, where 100 is safest>,
      "riskLevel": "<Safe | Moderate Caution | High Risk | Extreme Caution>",
      "summary": "<1-2 sentence executive summary of risk>",
      "factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
      "safetyTips": ["<tip 1>", "<tip 2>", "<tip 3>"]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in predict-risk:', error);
    return res.status(500).json({ error: error.message || 'Failed to predict risk' });
  }
});

// API Route 2: Dynamic Safest & Accessible Route Analysis
app.post('/api/ai/analyze-route', async (req, res) => {
  try {
    const { origin, destination, timeOfDay, transportMode, accessibilityNeeds } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        routes: [
          {
            id: 'route-safest',
            name: 'GuardIA Safest & Well-Lit Route',
            tag: 'Recommended for Night / Solo',
            distance: '2.4 km',
            estimatedTime: '18 mins',
            safetyScore: 92,
            accessibilityScore: 88,
            lightingPercent: 95,
            cctvCoverage: 85,
            policeBoothNearby: true,
            highlights: ['Main Avenue lighting', 'Passes 2 Police Booths', 'Step-free sidewalks'],
            riskSegments: ['Minor darkness near Metro exit (100m) - Stay on east sidewalk']
          },
          {
            id: 'route-accessible',
            name: '100% Accessible Step-Free Route',
            tag: 'Wheelchair & Elderly Friendly',
            distance: '2.6 km',
            estimatedTime: '21 mins',
            safetyScore: 89,
            accessibilityScore: 98,
            lightingPercent: 90,
            cctvCoverage: 80,
            policeBoothNearby: true,
            highlights: ['Zero steps or high curbs', 'Tactile paving & broad ramps', 'Accessible washroom on route'],
            riskSegments: ['Crosswalk signal duration is brief (15s) at 3rd Junction']
          },
          {
            id: 'route-fastest',
            name: 'Direct Shortest Route',
            tag: 'Fastest - Exercise Caution',
            distance: '1.9 km',
            estimatedTime: '14 mins',
            safetyScore: 68,
            accessibilityScore: 60,
            lightingPercent: 55,
            cctvCoverage: 40,
            policeBoothNearby: false,
            highlights: ['Shortest walking distance'],
            riskSegments: ['Narrow alleyway with poor lighting', 'Steep curb without ramp near Market rear']
          }
        ]
      });
    }

    const prompt = `You are an expert safety and accessibility route analyzer.
    Analyze travel from "${origin || 'Central Station'}" to "${destination || 'Community Center'}" at time "${timeOfDay || 'Night'}".
    Transport Mode: ${transportMode || 'Walking'}.
    User Accessibility Needs: ${accessibilityNeeds || 'Elderly / Wheelchair access'}.

    Generate 3 distinct route options in JSON format matching this exact schema:
    {
      "routes": [
        {
          "id": "string",
          "name": "string",
          "tag": "string",
          "distance": "string",
          "estimatedTime": "string",
          "safetyScore": number (0-100),
          "accessibilityScore": number (0-100),
          "lightingPercent": number (0-100),
          "cctvCoverage": number (0-100),
          "policeBoothNearby": boolean,
          "highlights": ["string"],
          "riskSegments": ["string"]
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in analyze-route:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze route' });
  }
});

// API Route 3: AI Legal Rights Advisor
app.post('/api/ai/legal-rights', async (req, res) => {
  try {
    const { query, category } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        topic: category || 'General Rights',
        summary: 'Under Indian & Global laws, you have fundamental legal protections during emergency situations.',
        keyRights: [
          'Zero FIR Rule: You can file a First Information Report (FIR) at ANY police station regardless of jurisdiction.',
          'Right to Free Legal Aid: You have an absolute legal right to demand free legal representation.',
          'Protection for Women at Night: Female citizens cannot be arrested between sunset and sunrise except under extraordinary court orders by a magistrate.'
        ],
        actionSteps: [
          'Request the police officer’s badge number and station ID.',
          'Send your GuardIA live tracking link and recorded evidence to trusted contacts.',
          'Ask for a copy of the written FIR or complaint receipt free of cost.'
        ],
        legalStatutes: ['CrPC Section 154 (Zero FIR)', 'Article 39A (Free Legal Aid)', 'POSH Act Section 9']
      });
    }

    const prompt = `You are GuardIA Legal Rights Advisor, an AI legal assistant specializing in safety laws, emergency protection, women's rights, rights of senior citizens, differently-abled persons rights (RPwD), police encounter procedures, Zero FIR, and bystander protection laws.

    User Query/Topic: "${query || 'What are my rights if I am harassed or stopped by police at night?'}"
    Category context: "${category || 'Emergency Rights'}"

    Provide a concise, highly practical legal advice response in JSON format matching:
    {
      "topic": "string",
      "summary": "1-2 sentence overview of user's core legal standing",
      "keyRights": ["Clear point 1", "Clear point 2", "Clear point 3"],
      "actionSteps": ["Step 1", "Step 2", "Step 3"],
      "legalStatutes": ["Statute/Act 1", "Statute/Act 2"]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in legal-rights:', error);
    return res.status(500).json({ error: error.message || 'Failed to consult legal advisor' });
  }
});

// API Route 4: AI Safety Companion Mode ("Walk With Me")
app.post('/api/ai/companion-chat', async (req, res) => {
  try {
    const { userMessage, history, currentLocation, userStatus } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        reply: `I'm with you! I'm keeping an eye on your journey through ${currentLocation || 'your route'}. Let me know if you see any dark spots or feel uneasy.`,
        suggestedCheckInSec: 180,
        comfortLevel: 'reassuring',
        alertLevel: 'normal'
      });
    }

    const systemInstruction = `You are GuardIA Companion ("Walk With Me"), a calm, supportive, vigilant real-time AI companion walking with the user.
    Your job is to talk with the user in short, empathetic sentences (1-3 sentences max).
    If they express fear or unease, offer clear calm guidance, remind them of nearby police/safe spots, and ask if they want to prime an SOS trigger.
    Current user location context: "${currentLocation || 'Walking home'}". User status: "${userStatus || 'Moving normally'}".`;

    const chat = ai.chats.create({
      model: 'gemini-3.6-flash',
      config: {
        systemInstruction,
      },
    });

    // Send history if provided or simple query
    const response = await chat.sendMessage({
      message: userMessage || "I'm walking through a dark street right now."
    });

    return res.json({
      reply: response.text || "I'm right here with you. Keep moving towards the main street. I'm monitoring your safety countdown.",
      suggestedCheckInSec: userMessage?.toLowerCase().includes('scared') || userMessage?.toLowerCase().includes('dark') ? 60 : 180,
      comfortLevel: 'reassuring',
      alertLevel: userMessage?.toLowerCase().includes('following') ? 'caution' : 'normal'
    });
  } catch (error: any) {
    console.error('Error in companion-chat:', error);
    return res.status(500).json({ error: error.message || 'Companion chat failed' });
  }
});

// In-memory Live Location session store
// NOTE: this resets on server restart and isn't shared across multiple server instances.
// For production, back this with a real database (e.g. Redis/Postgres) instead.
interface LiveLocationSession {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  label: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

const LIVE_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // sessions auto-expire after 2 hours
const liveLocationSessions = new Map<string, LiveLocationSession>();

function isSessionExpired(session: LiveLocationSession) {
  return Date.now() - session.createdAt > LIVE_SESSION_TTL_MS;
}

// Periodically sweep expired sessions so memory doesn't grow unbounded
setInterval(() => {
  for (const [id, session] of liveLocationSessions) {
    if (isSessionExpired(session)) liveLocationSessions.delete(id);
  }
}, 5 * 60 * 1000);

// API Route: Start a Live Location sharing session
app.post('/api/live-location/start', (req, res) => {
  const { lat, lng, accuracy, label } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng (numbers) are required' });
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const session: LiveLocationSession = {
    id,
    lat,
    lng,
    accuracy: typeof accuracy === 'number' ? accuracy : null,
    label: typeof label === 'string' && label.trim() ? label.trim() : 'Safera User',
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  liveLocationSessions.set(id, session);
  return res.status(201).json(session);
});

// API Route: Push a new position update for an active session
app.post('/api/live-location/:id/update', (req, res) => {
  const session = liveLocationSessions.get(req.params.id);
  if (!session || isSessionExpired(session)) {
    return res.status(404).json({ error: 'Live location session not found or expired' });
  }
  if (!session.active) {
    return res.status(410).json({ error: 'Live location session has been stopped' });
  }

  const { lat, lng, accuracy } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng (numbers) are required' });
  }

  session.lat = lat;
  session.lng = lng;
  session.accuracy = typeof accuracy === 'number' ? accuracy : session.accuracy;
  session.updatedAt = Date.now();
  return res.json(session);
});

// API Route: Fetch the current state of a session (used by the public viewer page)
app.get('/api/live-location/:id', (req, res) => {
  const session = liveLocationSessions.get(req.params.id);
  if (!session || isSessionExpired(session)) {
    return res.status(404).json({ error: 'Live location session not found or expired' });
  }
  return res.json(session);
});

// API Route: Stop sharing a session
app.post('/api/live-location/:id/stop', (req, res) => {
  const session = liveLocationSessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Live location session not found' });
  }
  session.active = false;
  session.updatedAt = Date.now();
  return res.json(session);
});

// Encrypted Evidence Vault storage
//
// The client (useEvidenceRecorder.ts) encrypts every recording with
// AES-256-GCM in the browser via Web Crypto BEFORE it ever reaches this
// endpoint — this server only ever stores ciphertext + an IV + a SHA-256
// hash of the plaintext (for later tamper-proofing). It has no way to
// decrypt what it stores; only whoever holds the client-side vault key
// (currently: the same device, via localStorage — see evidenceCrypto.ts
// for the noted limitation) can.
const EVIDENCE_DIR = path.join(process.cwd(), 'evidence-storage');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

interface EvidenceRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sha256Hash: string;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  storedAt: string;
}

// In-memory index — resets on server restart, same caveat as the
// liveLocationSessions map above. Swap for a real database/table (and
// swap the fs.writeFileSync calls below for S3/GCS/Azure Blob) before
// this goes to production.
const evidenceIndex = new Map<string, EvidenceRecord>();

app.post('/api/evidence/upload', (req, res) => {
  try {
    const { fileName, mimeType, encryptedBase64, ivBase64, sha256Hash, capturedAt, lat, lng } = req.body || {};

    if (typeof encryptedBase64 !== 'string' || typeof ivBase64 !== 'string' || typeof sha256Hash !== 'string') {
      return res.status(400).json({ error: 'encryptedBase64, ivBase64 and sha256Hash (strings) are required' });
    }

    const id = crypto.randomUUID();
    const cipherBuffer = Buffer.from(encryptedBase64, 'base64');
    fs.writeFileSync(path.join(EVIDENCE_DIR, `${id}.enc`), cipherBuffer);
    fs.writeFileSync(path.join(EVIDENCE_DIR, `${id}.iv`), Buffer.from(ivBase64, 'base64'));

    const record: EvidenceRecord = {
      id,
      fileName: typeof fileName === 'string' ? fileName : `evidence-${id}.enc`,
      mimeType: typeof mimeType === 'string' ? mimeType : 'video/webm',
      sha256Hash,
      capturedAt: typeof capturedAt === 'string' ? capturedAt : new Date().toISOString(),
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      storedAt: new Date().toISOString(),
    };
    evidenceIndex.set(id, record);

    return res.status(201).json({ id, sizeBytes: cipherBuffer.length, storedAt: record.storedAt });
  } catch (error: any) {
    console.error('Error in evidence upload:', error);
    return res.status(500).json({ error: error.message || 'Evidence upload failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GuardIA Safety Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();