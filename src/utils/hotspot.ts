import { SafetyLocation, CommunityReport } from '../types';

export type TimeOfDay = 'Day' | 'Dusk' | 'Night' | 'Late Night';

export interface SafetyGridCell {
  row: number;
  col: number;
  /** Cell center position as a percentage of the grid container (0-100). */
  xPct: number;
  yPct: number;
  /** Cell footprint as a percentage of the grid container. */
  widthPct: number;
  heightPct: number;
  /** Computed risk 0 (safest) - 100 (most dangerous). */
  risk: number;
  band: 'low' | 'moderate' | 'high' | 'critical';
  /** How many locations/reports actually influenced this cell (for the "why" tooltip). */
  contributingSignals: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const GRID_COLS = 8;
const GRID_ROWS = 6;

/** Earth-distance between two lat/lng points, in meters. */
export function haversineDistanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Parses the app's relative timestamp strings ("Just now", "2 hours ago",
 * "1 day ago") into hours elapsed. Anything unrecognized is treated as
 * fairly old (48h) so a malformed timestamp doesn't accidentally dominate
 * the grid as breaking news.
 */
export function parseHoursAgo(timestamp: string): number {
  const t = timestamp.trim().toLowerCase();
  if (t === 'just now') return 0;

  const match = t.match(/(\d+)\s*(minute|hour|day|week)s?\s*ago/);
  if (!match) return 48;

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'minute':
      return value / 60;
    case 'hour':
      return value;
    case 'day':
      return value * 24;
    case 'week':
      return value * 24 * 7;
    default:
      return 48;
  }
}

/** Newer reports matter more. Half-life of 36h: a report loses half its weight every day and a half. */
function recencyWeight(hoursAgo: number): number {
  const halfLifeHours = 36;
  return Math.pow(0.5, hoursAgo / halfLifeHours);
}

/**
 * How much a report category should push the local risk score up (positive)
 * or down (negative — a confirmed "Safe Hub" report actively cools an area
 * off, the same way a new police kiosk would in real hotspot models).
 */
function categorySeverity(category: CommunityReport['category']): number {
  switch (category) {
    case 'Harassment':
      return 1.0;
    case 'Suspicious Follower':
      return 0.9;
    case 'Isolated Zone':
      return 0.75;
    case 'Poor Lighting':
      return 0.5;
    case 'Accessibility Defect':
      return 0.15;
    case 'Safe Hub':
      return -0.7;
    default:
      return 0.4;
  }
}

function gaussianKernel(distanceMeters: number, bandwidthMeters: number): number {
  const x = distanceMeters / bandwidthMeters;
  return Math.exp(-(x * x) / 2);
}

function computeBoundingBox(locations: SafetyLocation[], reports: CommunityReport[]): BoundingBox {
  const lats = [...locations.map((l) => l.lat), ...reports.map((r) => r.lat)];
  const lngs = [...locations.map((l) => l.lng), ...reports.map((r) => r.lng)];

  const rawMinLat = Math.min(...lats);
  const rawMaxLat = Math.max(...lats);
  const rawMinLng = Math.min(...lngs);
  const rawMaxLng = Math.max(...lngs);

  // Pad the box so points near the edge aren't rendered flush against the
  // container border, and so a single-point dataset still gets a usable box.
  const latPad = Math.max((rawMaxLat - rawMinLat) * 0.25, 0.01);
  const lngPad = Math.max((rawMaxLng - rawMinLng) * 0.25, 0.01);

  return {
    minLat: rawMinLat - latPad,
    maxLat: rawMaxLat + latPad,
    minLng: rawMinLng - lngPad,
    maxLng: rawMaxLng + lngPad,
  };
}

/** Maps a real lat/lng into an x/y percentage position within the grid container. */
export function projectToPct(lat: number, lng: number, box: BoundingBox): { xPct: number; yPct: number } {
  const xPct = ((lng - box.minLng) / (box.maxLng - box.minLng)) * 100;
  // Latitude increases northward but screen Y increases downward, so invert.
  const yPct = (1 - (lat - box.minLat) / (box.maxLat - box.minLat)) * 100;
  return {
    xPct: Math.min(100, Math.max(0, xPct)),
    yPct: Math.min(100, Math.max(0, yPct)),
  };
}

function riskBand(risk: number): SafetyGridCell['band'] {
  if (risk >= 76) return 'critical';
  if (risk >= 51) return 'high';
  if (risk >= 26) return 'moderate';
  return 'low';
}

/**
 * Builds a kernel-density-style risk grid from real location and report
 * data: each location's (100 - safetyScore) baseline plus its FIR/SOS
 * history, and each report's category severity × recency decay × trust
 * score, radiate outward with a Gaussian falloff and sum at every grid
 * cell — the same underlying idea as the hotspot-detection / KDE heatmaps
 * used in geospatial crime-analysis tools, just computed client-side over
 * the app's own live location + report state instead of a fixed image.
 */
export function computeSafetyGrid(
  locations: SafetyLocation[],
  reports: CommunityReport[],
  timeOfDay: TimeOfDay,
  gridCols = GRID_COLS,
  gridRows = GRID_ROWS
): SafetyGridCell[] {
  if (locations.length === 0 && reports.length === 0) return [];

  const box = computeBoundingBox(locations, reports);
  const cells: SafetyGridCell[] = [];

  // Roughly convert the lat/lng box into meters so bandwidths can be
  // specified in real-world distance regardless of how zoomed-in the data is.
  const boxHeightMeters = haversineDistanceMeters(box.minLat, box.minLng, box.maxLat, box.minLng);
  const boxWidthMeters = haversineDistanceMeters(box.minLat, box.minLng, box.minLat, box.maxLng);
  const locationBandwidth = Math.max(150, Math.min(boxWidthMeters, boxHeightMeters) * 0.28);
  const reportBandwidth = locationBandwidth * 0.6;

  const isDark = timeOfDay === 'Night' || timeOfDay === 'Late Night';

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cellLat = box.maxLat - ((row + 0.5) / gridRows) * (box.maxLat - box.minLat);
      const cellLng = box.minLng + ((col + 0.5) / gridCols) * (box.maxLng - box.minLng);

      let riskAccumulator = 0;
      let contributingSignals = 0;

      for (const loc of locations) {
        const distance = haversineDistanceMeters(cellLat, cellLng, loc.lat, loc.lng);
        const kernel = gaussianKernel(distance, locationBandwidth);
        if (kernel < 0.02) continue;

        const baseRisk = (100 - loc.safetyScore) / 100;
        const incidentBoost = Math.min(1, loc.firCount * 0.06 + loc.recentSosCount * 0.12);
        let locationRisk = baseRisk * 0.7 + incidentBoost * 0.3;

        // Poorly lit locations get meaningfully riskier after dark — the
        // same day/night factor already surfaced elsewhere in the app.
        if (isDark && loc.lightingStars <= 2) {
          locationRisk = Math.min(1, locationRisk * 1.3);
        }

        riskAccumulator += locationRisk * kernel;
        if (kernel > 0.1) contributingSignals++;
      }

      for (const report of reports) {
        const distance = haversineDistanceMeters(cellLat, cellLng, report.lat, report.lng);
        const kernel = gaussianKernel(distance, reportBandwidth);
        if (kernel < 0.02) continue;

        const severity = categorySeverity(report.category);
        const recency = recencyWeight(parseHoursAgo(report.timestamp));
        const confidence = report.trustScore / 100;

        riskAccumulator += severity * recency * confidence * kernel;
        if (kernel > 0.1) contributingSignals++;
      }

      const risk = Math.round(Math.min(100, Math.max(0, riskAccumulator * 100)));
      const { xPct, yPct } = {
        xPct: ((col + 0.5) / gridCols) * 100,
        yPct: ((row + 0.5) / gridRows) * 100,
      };

      cells.push({
        row,
        col,
        xPct,
        yPct,
        widthPct: 100 / gridCols,
        heightPct: 100 / gridRows,
        risk,
        band: riskBand(risk),
        contributingSignals,
      });
    }
  }

  return cells;
}

export function gridToBoundingBox(locations: SafetyLocation[], reports: CommunityReport[]): BoundingBox {
  return computeBoundingBox(locations, reports);
}

export interface NearestSafeResource {
  location: SafetyLocation;
  distanceMeters: number;
  reason: 'police-booth' | 'highest-safety-score';
}

/**
 * Finds the nearest genuinely useful place to head toward — a location with
 * an active police booth if one exists nearby, otherwise the highest-scoring
 * safe location overall. Mirrors the "resource allocation" idea from
 * geospatial crime-response tools: don't just show risk, point toward help.
 */
export function findNearestSafeResource(
  userLat: number,
  userLng: number,
  locations: SafetyLocation[]
): NearestSafeResource | null {
  if (locations.length === 0) return null;

  const withPoliceBooths = locations.filter((l) => l.accessibility.policeBooths && l.safetyScore >= 60);
  const pool = withPoliceBooths.length > 0 ? withPoliceBooths : locations.filter((l) => l.safetyScore >= 60);
  const candidates = pool.length > 0 ? pool : locations;

  let best: NearestSafeResource | null = null;
  for (const loc of candidates) {
    const distanceMeters = haversineDistanceMeters(userLat, userLng, loc.lat, loc.lng);
    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        location: loc,
        distanceMeters,
        reason: withPoliceBooths.length > 0 ? 'police-booth' : 'highest-safety-score',
      };
    }
  }
  return best;
}

/** Tailwind-friendly color tokens per risk band, kept consistent with the app's existing rose/amber palette. */
export function riskBandColor(band: SafetyGridCell['band']): string {
  switch (band) {
    case 'critical':
      return 'rgba(167, 25, 75, 0.55)'; // deep rose
    case 'high':
      return 'rgba(167, 25, 75, 0.32)';
    case 'moderate':
      return 'rgba(242, 201, 76, 0.28)'; // amber
    default:
      return 'rgba(95, 167, 119, 0.14)'; // soft green, barely-there
  }
}