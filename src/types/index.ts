export type RiskLevel = 'Safe' | 'Moderate Caution' | 'High Risk' | 'Extreme Caution';

export interface AccessibilityFeatures {
  wheelchairRamps: boolean;
  stepFreeEntrances: boolean;
  cctvCoverage: boolean;
  smoothFootpaths: boolean;
  goodStreetlights: boolean;
  accessiblePublicWashrooms: boolean;
  policeBooths: boolean;
  phoneBooths: boolean;
  brailleSignage: boolean;
  elevatorAccess: boolean;
  tactilePaving: boolean;
}

export interface SafetyLocation {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  safetyScore: number; // 0-100
  riskLevel: RiskLevel;
  firCount: number;
  recentSosCount: number;
  crowdDensity: 'High' | 'Moderate' | 'Low' | 'Isolated';
  lightingStars: number; // 1-5
  roadType: 'Main Highway' | 'Commercial Boulevard' | 'Suburban Corridor' | 'Narrow Alleyway' | 'Pedestrian Walkway';
  policeDistanceMeters: number;
  cctvPercent: number;
  accessibility: AccessibilityFeatures;
  trustScore: number; // 0-100% based on pattern recognition
  reportCount: number;
}

export interface CommunityReport {
  id: string;
  locationName: string;
  lat: number;
  lng: number;
  category: 'Harassment' | 'Poor Lighting' | 'Isolated Zone' | 'Suspicious Follower' | 'Accessibility Defect' | 'Safe Hub';
  description: string;
  timestamp: string;
  trustScore: number; // e.g. 96%
  verifiedByPattern: boolean;
  verifiedCount: number;
  upvotes: number;
  photos?: string[];
  status: 'Active' | 'Under Verification' | 'Resolved';
}

export interface RouteOption {
  id: string;
  name: string;
  tag: string;
  distance: string;
  estimatedTime: string;
  safetyScore: number;
  accessibilityScore: number;
  lightingPercent: number;
  cctvCoverage: number;
  policeBoothNearby: boolean;
  highlights: string[];
  riskSegments: string[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
  sendSms: boolean;
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'photo';
  timestamp: string;
  locationName: string;
  coords: { lat: number; lng: number };
  duration?: string;
  fileSize: string;
  mediaUrl: string;
  isEncrypted: boolean;
  isCloudBackedUp: boolean;
}

export interface VitalSignData {
  timestamp: string;
  heartRate: number; // bpm
  hrv: number; // ms
  stressLevel: number; // 0-100
  isSpike: boolean;
  wearableName: string;
  connected: boolean;
}

export interface MovementSensorSettings {
  isEnabled: boolean;
  fallDetection: boolean;
  shakingDetection: boolean;
  draggingDetection: boolean;
  inactivityThresholdHours: number; // e.g. 5 hours
  autoCheckInIntervalMinutes: number; // e.g. 15 or 30 min
}

export interface LegalRightsArticle {
  id: string;
  title: string;
  category: 'Police Interactions' | 'Women Safety' | 'Senior Citizens & Disability' | 'Bystander Protection' | 'Workplace POSH' | 'Zero FIR & Emergency';
  summary: string;
  keyRights: string[];
  statutes: string[];
  actionSteps: string[];
}

export interface FakeCallConfig {
  callerName: string;
  callerNumber: string;
  delaySeconds: number;
  voiceScript: string;
}
