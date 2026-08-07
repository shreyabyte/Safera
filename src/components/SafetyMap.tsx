import React, { useState, useEffect, useMemo } from 'react';
import { SafetyLocation, CommunityReport } from '../types';
import {
  MapPin,
  Clock,
  Sun,
  Moon,
  Sparkles,
  Navigation,
  Flame,
  Accessibility,
  PlusCircle,
  Share2,
  Bot,
  Shield,
  Cloud,
  Radio,
  Scale,
  Users,
  Phone,
  Volume2,
  Info,
  X,
  ShieldCheck,
} from 'lucide-react';

import { LiveLocationShareModal } from './LiveLocationShareModal';
import {
  computeSafetyGrid,
  findNearestSafeResource,
  projectToPct,
  gridToBoundingBox,
  riskBandColor,
  type SafetyGridCell,
} from '../utils/hotspot';

interface SafetyMapProps {
  locations: SafetyLocation[];
  reports: CommunityReport[];
  onSelectLocationForRoute: (loc: SafetyLocation) => void;
  onOpenReportModal: () => void;
  setActiveTab?: (tab: string) => void;
}

const getWeatherLabel = (code: number): string => {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Clear';
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

interface LiveRiskData {
  safetyScore: number;
  riskLevel: string;
  summary: string;
  factors: string[];
  safetyTips: string[];
}

export const SafetyMap: React.FC<SafetyMapProps> = ({
  locations,
  reports,
  onSelectLocationForRoute,
  onOpenReportModal,
  setActiveTab,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<SafetyLocation>(locations[0]);
  const [timeOfDay, setTimeOfDay] = useState<'Day' | 'Dusk' | 'Night' | 'Late Night'>('Night');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showAccessibilityOverlay, setShowAccessibilityOverlay] = useState(false);
  const [showPoliceBoothsOnly] = useState(false);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [liveLocationLabel, setLiveLocationLabel] = useState<string>('Locating…');
  const [liveTemp, setLiveTemp] = useState<string>('--°');
  const [liveWeatherDesc, setLiveWeatherDesc] = useState<string>('Loading...');
  // Raw coordinates (not just the display label) — needed to compute real
  // distance to the nearest safe resource below.
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [liveScoreStatus, setLiveScoreStatus] = useState<
    'loading' | 'live' | 'fallback' | 'denied'
  >('loading');
  const [liveScoreData, setLiveScoreData] = useState<LiveRiskData | null>(null);

  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLiveLocationLabel('Location unavailable');
      setLiveWeatherDesc('Unavailable');
      setLiveScoreStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        let weatherDescLocal = 'Clear';

        try {
          const weatherRes = await fetchWithTimeout(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`,
            {},
            6000,
          );
          if (!weatherRes.ok) throw new Error(`weather responded ${weatherRes.status}`);
          const weatherData = await weatherRes.json();
          weatherDescLocal = getWeatherLabel(weatherData.current.weather_code);
          setLiveTemp(`${Math.round(weatherData.current.temperature_2m)}°`);
          setLiveWeatherDesc(weatherDescLocal);
        } catch (err) {
          console.error('Weather fetch failed', err);
          setLiveWeatherDesc('Unavailable');
        }

        let readableName = 'Your current area';
        try {
          const geoRes = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {},
            6000,
          );
          if (!geoRes.ok) throw new Error(`reverse geocode responded ${geoRes.status}`);
          const geoData = await geoRes.json();
          const addr = geoData.address || {};
          readableName =
            addr.road ||
            addr.suburb ||
            addr.neighbourhood ||
            geoData.display_name?.split(',').slice(0, 2).join(',') ||
            'Your current area';
          setLiveLocationLabel(readableName);
        } catch (err) {
          console.error('Reverse geocode failed', err);
          setLiveLocationLabel(readableName);
        }

        try {
          const hour = new Date().getHours();
          const approxTimeOfDay =
            hour >= 5 && hour < 17
              ? 'Day'
              : hour >= 17 && hour < 20
              ? 'Dusk'
              : hour >= 20 && hour < 24
              ? 'Night'
              : 'Late Night';

          const riskRes = await fetchWithTimeout(
            '/api/ai/predict-risk',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                locationName: readableName,
                timeOfDay: approxTimeOfDay,
                weather: weatherDescLocal,
                crowdDensity: 'Moderate',
                firCount: 1,
                recentReports: [],
              }),
            },
            6000,
          );

          if (!riskRes.ok) throw new Error(`predict-risk responded ${riskRes.status}`);
          const riskData = await riskRes.json();

          if (
            typeof riskData.safetyScore === 'number' &&
            typeof riskData.riskLevel === 'string'
          ) {
            setLiveScoreData(riskData);
            setLiveScoreStatus('live');
          } else {
            throw new Error('predict-risk returned an unexpected shape');
          }
        } catch (err) {
          console.error('Live risk score failed, falling back to demo location score', err);
          setLiveScoreStatus('fallback');
        }
      },
      (err) => {
        console.warn('Geolocation permission denied/unavailable', err);
        setLiveLocationLabel('Location permission denied');
        setLiveWeatherDesc('Enable location for live weather');
        setLiveScoreStatus('denied');
      },
    );
  }, []);

  const displaySafetyScore =
    liveScoreStatus === 'live' && liveScoreData ? liveScoreData.safetyScore : selectedLocation.safetyScore;
  const displayRiskLabel =
    liveScoreStatus === 'live' && liveScoreData ? liveScoreData.riskLevel : 'Safe zone';

  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    safetyScore: number;
    riskLevel: string;
    summary: string;
    factors: string[];
    safetyTips: string[];
  } | null>(null);

  // Builds a fallback analysis from the location's OWN real fields
  // (lighting, CCTV %, police distance, FIR count, crowd density) instead
  // of a fixed generic sentence. Used only when the live Gemini call fails,
  // so even a failed request never claims something untrue about the
  // specific location — e.g. it won't call a 1-star-lit alley "well-lit."
  const buildLocationAwareFallback = (loc: SafetyLocation) => {
    const lightingDesc =
      loc.lightingStars >= 4
        ? 'well-lit with strong streetlight coverage'
        : loc.lightingStars >= 2
        ? 'moderately lit, with some dark patches after dusk'
        : 'poorly lit, with minimal working streetlights';

    const cctvDesc =
      loc.cctvPercent >= 80
        ? 'extensive CCTV coverage'
        : loc.cctvPercent >= 40
        ? 'partial CCTV coverage'
        : 'very limited CCTV coverage';

    const policeDesc =
      loc.policeDistanceMeters <= 300
        ? `a police presence just ${loc.policeDistanceMeters}m away`
        : loc.policeDistanceMeters <= 700
        ? `the nearest police booth ${loc.policeDistanceMeters}m away`
        : `no nearby police booth — the closest is ${loc.policeDistanceMeters}m away`;

    return {
      safetyScore: loc.safetyScore,
      riskLevel: loc.riskLevel,
      summary: `${loc.name} is currently rated "${loc.riskLevel}" (${loc.safetyScore}/100). It's ${lightingDesc}, with ${cctvDesc} and ${policeDesc}. (Live AI analysis is temporarily unavailable — this summary is generated directly from the location's own logged data.)`,
      factors: [
        `Lighting Rating: ${loc.lightingStars}/5 stars`,
        `CCTV Coverage: ${loc.cctvPercent}%`,
        `Police Distance: ${loc.policeDistanceMeters}m away`,
        `FIR Incidents Logged: ${loc.firCount}`,
        `Crowd Density: ${loc.crowdDensity}`,
      ],
      safetyTips:
        loc.safetyScore >= 70
          ? ['This is a comparatively safe zone — standard precautions still apply.', 'Stick to the main walkway.']
          : [
              'Avoid this area alone after dark if possible.',
              'Stay on well-lit main roads instead of side alleys.',
              'Share your live location with a trusted contact before entering this zone.',
            ],
    };
  };

  const handleRunAiRiskPredictor = async (loc: SafetyLocation) => {
    setIsAnalyzingAi(true);
    try {
      const response = await fetch('/api/ai/predict-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: loc.name,
          timeOfDay,
          weather: 'Clear Night (24 deg C)',
          crowdDensity: loc.crowdDensity,
          firCount: loc.firCount,
          recentReports: reports.filter((r) => r.locationName.includes(loc.name.split(' ')[0])).map((r) => r.description),
        }),
      });

      if (!response.ok) {
        throw new Error(`predict-risk responded ${response.status}`);
      }

      const data = await response.json();

      // Validate shape before trusting it — a malformed or empty response
      // shouldn't render as if it were a real AI analysis.
      if (typeof data.safetyScore !== 'number' || typeof data.summary !== 'string' || !data.summary.trim()) {
        throw new Error('predict-risk returned an unexpected shape');
      }

      setAiAnalysisResult(data);
    } catch (err) {
      console.error('Live AI risk analysis failed, using location-aware fallback', err);
      setAiAnalysisResult(buildLocationAwareFallback(loc));
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const [isLiveLocationModalOpen, setIsLiveLocationModalOpen] = useState(false);

  const filteredLocations = locations.filter((loc) => {
    if (showPoliceBoothsOnly && !loc.accessibility.policeBooths) return false;
    if (showAccessibilityOverlay && !loc.accessibility.wheelchairRamps) return false;
    return true;
  });

  // --- Real, data-driven hotspot grid (replaces the old two fixed blur blobs) ---
  // Recomputed whenever the underlying locations/reports/time-of-day change,
  // so submitting a new community report visibly reshapes the heatmap.
  const safetyGrid: SafetyGridCell[] = useMemo(
    () => computeSafetyGrid(locations, reports, timeOfDay),
    [locations, reports, timeOfDay]
  );

  const boundingBox = useMemo(() => gridToBoundingBox(locations, reports), [locations, reports]);

  const projectedLocations = useMemo(
    () =>
      filteredLocations.map((loc) => ({
        loc,
        ...projectToPct(loc.lat, loc.lng, boundingBox),
      })),
    [filteredLocations, boundingBox]
  );

  const hottestCell = useMemo(
    () => safetyGrid.reduce<SafetyGridCell | null>((max, c) => (!max || c.risk > max.risk ? c : max), null),
    [safetyGrid]
  );

  // --- Nearest safe resource (police booth if available, else the highest-scoring nearby location) ---
  const nearestSafeResource = useMemo(
    () => (userCoords ? findNearestSafeResource(userCoords.lat, userCoords.lng, locations) : null),
    [userCoords, locations]
  );

  return (
    <>
    <div className="space-y-6">
      <div className="relative bg-gradient-to-br from-[#F8D7CD] via-[#EFA6B6] to-[#CF748B] border border-[#F2E5DE] rounded-[32px] p-6 sm:p-8 shadow-[0_12px_36px_rgba(207,116,139,0.18)] text-[#31141E] overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs font-bold tracking-widest text-[#6B2F42] uppercase">
                  CURRENT SAFETY SCORE
                </span>
                {liveScoreStatus === 'live' && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wide">
                    Live
                  </span>
                )}
                {liveScoreStatus === 'loading' && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/50 text-[#6B2F42] uppercase tracking-wide animate-pulse">
                    Calculating…
                  </span>
                )}
                {(liveScoreStatus === 'fallback' || liveScoreStatus === 'denied') && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/50 text-[#6B2F42] uppercase tracking-wide">
                    Reference: {selectedLocation.name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsMethodologyOpen((v) => !v)}
                  aria-expanded={isMethodologyOpen}
                  aria-label="How this score is calculated"
                  className="w-4 h-4 rounded-full bg-white/50 hover:bg-white/80 text-[#6B2F42] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-5xl sm:text-6xl font-bold text-[#31141E] tracking-tight leading-none">
                  {displaySafetyScore}
                </span>
                <span className="text-lg sm:text-xl font-bold text-[#6B2F42]">
                  / 100
                </span>
              </div>

              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 backdrop-blur-xs text-[#31141E] text-xs font-semibold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {displayRiskLabel}
                </span>
              </div>
            </div>

            <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="rgba(49, 20, 30, 0.15)"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#31141E"
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * (1 - displaySafetyScore / 100)}`}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
            </div>
          </div>

          {isMethodologyOpen && (
            <div className="bg-white/70 backdrop-blur-xs border border-white/60 rounded-[20px] p-4 space-y-2.5 text-xs text-[#31141E] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wide text-[10px] text-[#6B2F42]">
                  How this score is calculated
                </span>
                <button
                  type="button"
                  onClick={() => setIsMethodologyOpen(false)}
                  aria-label="Close"
                  className="text-[#6B2F42] hover:text-[#31141E] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <ul className="space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                  <span>
                    <strong>Real, live:</strong> your GPS position, current weather, and time of day
                    {liveScoreStatus === 'live' ? ' - currently in use for the score above.' : '.'}
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                  <span>
                    <strong>Real, live:</strong> Gemini AI synthesizes the above context into the score and summary in real time.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                  <span>
                    <strong>Real, computed:</strong> the Live Safety Grid below is a kernel-density risk
                    surface recomputed from every location's incident history and every community report's
                    category, trust score, and recency — not a fixed illustration.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#A7194B] shrink-0"></span>
                  <span>
                    <strong>Seed data (not yet live):</strong> historical incident/CCTV baseline is a curated demo dataset standing in for real open data - e.g. NCRB or state police open-data portals — which we'd integrate for production use.
                  </span>
                </li>
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="bg-white/60 backdrop-blur-xs text-[#31141E] text-xs font-semibold px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-[#8A1E41]" />
              <span>{liveLocationLabel}</span>
            </div>

            <div className="bg-white/60 backdrop-blur-xs text-[#31141E] text-xs font-semibold px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-2xs">
              <Cloud className="w-3.5 h-3.5 text-[#8A1E41]" />
              <span>{liveTemp} {liveWeatherDesc}</span>
            </div>

            <div className="bg-white/60 backdrop-blur-xs text-[#31141E] text-xs font-semibold px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#8A1E41]" />
              <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg sm:text-xl font-bold text-[#31141E]">
          Quick actions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div
            onClick={() => onSelectLocationForRoute(selectedLocation)}
            className="bg-white rounded-[26px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(49,20,30,0.03)] border border-[#F2E5DE] flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-[#FDF0E6] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5 text-[#8A1E41]" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#31141E]">
                Safe Navigation
              </h4>
              <p className="text-xs text-[#825D6B] mt-0.5">
                AI lighted & crime-monitored routes
              </p>
            </div>
          </div>

          <div
            onClick={() => setIsLiveLocationModalOpen(true)}
            className="bg-white rounded-[26px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(49,20,30,0.03)] border border-[#F2E5DE] flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-[#F7E5EC] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Share2 className="w-5 h-5 text-[#8A1E41]" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#31141E]">
                Share Live Location
              </h4>
              <p className="text-xs text-[#825D6B] mt-0.5">
                Share tracking link with contacts
              </p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab?.('companion')}
            className="bg-white rounded-[26px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(49,20,30,0.03)] border border-[#F2E5DE] flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-[#F8E1E8] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5 text-[#8A1E41]" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#31141E]">
                AI Safety Companion
              </h4>
              <p className="text-xs text-[#825D6B] mt-0.5">
                Voice guided safety guardian
              </p>
            </div>
          </div>

            <div
            onClick={() => setActiveTab?.('toolkit')}
            className="bg-white rounded-[26px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(49,20,30,0.03)] border border-[#F2E5DE] flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-[#FAF3DC] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-[#8A1E41]" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#31141E]">
                Offline Emergency Toolkit
              </h4>
              <p className="text-xs text-[#825D6B] mt-0.5">
                Siren, fake call & flashlight
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto py-2 no-scrollbar">
          <span className="text-xs font-semibold text-[#825D6B] shrink-0 mr-1">
            Section:
          </span>
          {[
            { id: 'sensors', label: 'Sensors', icon: Radio },
            { id: 'legal', label: 'Legal Advisor', icon: Scale },
            { id: 'community', label: 'Community', icon: Users },
            { id: 'toolkit', label: 'Offline Toolkit', icon: Phone },
            { id: 'companion', label: 'AI Safety Companion', icon: Volume2 },
          ].map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveTab?.(chip.id)}
                className="px-4 py-2 rounded-full bg-white text-[#31141E] border border-[#F2E5DE] hover:bg-[#FAF4EE] hover:border-[#8A1E41] hover:text-[#8A1E41] text-xs font-semibold flex items-center gap-2 transition-all shrink-0 shadow-2xs cursor-pointer active:scale-95"
              >
                <Icon className="w-3.5 h-3.5 text-[#8A1E41]" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#F2E5DE] rounded-[28px] p-5 shadow-[0_4px_20px_rgba(49,20,30,0.02)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#8A1E41]" />
            <span className="text-sm font-bold text-[#31141E]">
              Safety Controls & Layer Toggles
            </span>
          </div>

          <div className="flex items-center bg-[#FAF4EE] border border-[#F2E5DE] rounded-full p-1 shadow-2xs">
            {(['Day', 'Dusk', 'Night', 'Late Night'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimeOfDay(mode)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  timeOfDay === mode
                    ? 'bg-[#8A1E41] text-white shadow-xs'
                    : 'text-[#825D6B] hover:text-[#31141E]'
                }`}
              >
                {mode === 'Day' && <Sun className="w-3.5 h-3.5 inline mr-1 text-amber-500" />}
                {(mode === 'Night' || mode === 'Late Night') && <Moon className="w-3.5 h-3.5 inline mr-1 text-[#8A1E41]" />}
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-[#F2E5DE]">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
              showHeatmap
                ? 'bg-[#8A1E41] text-white border-[#6D1533]'
                : 'bg-white text-[#825D6B] border-[#F2E5DE] hover:bg-[#FAF4EE]'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-white' : 'text-[#8A1E41]'}`} />
            <span>Risk Heatmap</span>
          </button>

          <button
            onClick={() => setShowAccessibilityOverlay(!showAccessibilityOverlay)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
              showAccessibilityOverlay
                ? 'bg-[#8A1E41] text-white border-[#6D1533]'
                : 'bg-white text-[#825D6B] border-[#F2E5DE] hover:bg-[#FAF4EE]'
            }`}
          >
            <Accessibility className={`w-3.5 h-3.5 ${showAccessibilityOverlay ? 'text-white' : 'text-[#8A1E41]'}`} />
            <span>Accessible Ramps</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="ml-auto px-4.5 py-2 rounded-full text-xs font-bold bg-[#8A1E41] hover:bg-[#6D1533] text-white flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        <div className="lg:col-span-7 bg-white border border-[#EFE6E1] rounded-[28px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE6E1]">
            <h3 className="text-[20px] font-semibold text-[#221F20] flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-[#A7194B]" />
              Live Safety Grid & Hotspots
            </h3>
            <span className="text-xs font-medium text-[#6E676A]">Context: {timeOfDay} Mode</span>
          </div>

          <div className="relative bg-[#FCF7F1]/40 border border-[#EFE6E1] rounded-[22px] min-h-[440px] overflow-hidden flex flex-col justify-between p-5">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#A7194B_1px,transparent_1px)] [background-size:18px_18px]"></div>

            {/* Real computed risk grid — each cell's opacity/color comes from
                computeSafetyGrid(), driven by actual location + report data,
                not a fixed pair of blur circles. */}
            {showHeatmap && (
              <div className="absolute inset-0">
                {safetyGrid.map((cell) => (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    title={`Risk ${cell.risk}/100 · ${cell.contributingSignals} nearby signal(s)`}
                    className="absolute transition-colors duration-500"
                    style={{
                      left: `${cell.xPct}%`,
                      top: `${cell.yPct}%`,
                      width: `${cell.widthPct}%`,
                      height: `${cell.heightPct}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: riskBandColor(cell.band),
                      filter: 'blur(10px)',
                    }}
                  />
                ))}

                {/* Precise pin markers for every real location, positioned
                    by actual lat/lng instead of a static two-column card grid. */}
                {projectedLocations.map(({ loc, xPct, yPct }) => (
                  <button
                    key={`pin-${loc.id}`}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setAiAnalysisResult(null);
                    }}
                    title={loc.name}
                    className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow-md transition-transform hover:scale-150 cursor-pointer ${
                      selectedLocation.id === loc.id ? 'scale-150 ring-2 ring-[#A7194B]' : ''
                    }`}
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: loc.safetyScore >= 70 ? '#5FA777' : loc.safetyScore >= 45 ? '#F2C94C' : '#A7194B',
                      zIndex: 5,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-auto">
              {filteredLocations.map((loc) => {
                const isSelected = selectedLocation.id === loc.id;
                const isSafe = loc.safetyScore >= 80;

                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setAiAnalysisResult(null);
                    }}
                    className={`p-4 sm:p-4.5 rounded-[20px] border text-left transition-all ${
                      isSelected
                        ? 'bg-white border-[#A7194B] ring-2 ring-[#FFF0F3] shadow-sm'
                        : 'bg-white/90 border-[#EFE6E1] hover:border-[#A7194B]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm text-[#221F20] flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#A7194B]" />
                        <span>{loc.name}</span>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          isSafe
                            ? 'bg-[#FFF0F3] text-[#A7194B]'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {loc.safetyScore}/100
                      </span>
                    </div>

                    <p className="text-xs text-[#6E676A]">{loc.area}</p>

                    <div className="mt-3 pt-2.5 border-t border-[#EFE6E1] flex items-center justify-between text-[11px] text-[#6E676A]">
                      <span>FIR Logs: {loc.firCount}</span>
                      <span>CCTV: {loc.cctvPercent}%</span>
                      <span>Trust: {loc.trustScore}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 flex flex-wrap justify-between items-center gap-2 bg-white border border-[#EFE6E1] p-3.5 rounded-full text-xs text-[#6E676A] mt-3 shadow-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#5FA777' }}></span>
                  Low
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F2C94C' }}></span>
                  Moderate
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A7194B]/60"></span>
                  High
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A7194B]"></span>
                  Critical
                </span>
              </div>
              {hottestCell && (
                <span className="font-medium text-[#221F20]">
                  Hottest zone right now: {hottestCell.risk}/100 risk
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#EFE6E1] rounded-[28px] p-6.5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
          <div className="border-b border-[#EFE6E1] pb-3.5">
            <span className="text-xs font-medium text-[#6E676A]">
              {selectedLocation.area}
            </span>
            <h3 className="text-[22px] font-bold text-[#221F20] tracking-tight mt-0.5">
              {selectedLocation.name}
            </h3>
          </div>

          <div className="bg-[#FCF7F1]/50 border border-[#EFE6E1] rounded-[22px] p-4.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-[#6E676A]">Safety Score Index</div>
              <div className="text-3xl font-bold text-[#221F20] mt-0.5">{selectedLocation.safetyScore}/100</div>
            </div>
            <div className="text-right text-xs text-[#6E676A] space-y-0.5">
              <div>Police Distance: <strong className="text-[#221F20]">{selectedLocation.policeDistanceMeters}m</strong></div>
              <div>FIR Incidents: <strong className="text-[#221F20]">{selectedLocation.firCount}</strong></div>
            </div>
          </div>

          {/* Nearest Safe Resource — a real haversine-distance recommendation
              from the user's live GPS to the closest police-booth location
              (or highest-scoring nearby location if none has one), instead
              of only showing risk with no "what do I do about it" answer. */}
          {nearestSafeResource && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[22px] p-4.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold uppercase tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5" />
                Nearest Safe Resource
              </div>
              <div className="text-sm font-bold text-[#221F20]">
                {nearestSafeResource.location.name}
              </div>
              <div className="text-xs text-[#6E676A]">
                {nearestSafeResource.reason === 'police-booth'
                  ? 'Has an active police booth · '
                  : 'Highest safety score nearby · '}
                {nearestSafeResource.distanceMeters >= 1000
                  ? `${(nearestSafeResource.distanceMeters / 1000).toFixed(1)} km away`
                  : `${Math.round(nearestSafeResource.distanceMeters)} m away`}
              </div>
              <button
                onClick={() => onSelectLocationForRoute(nearestSafeResource.location)}
                className="mt-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                Route me there
              </button>
            </div>
          )}

          <button
            onClick={() => handleRunAiRiskPredictor(selectedLocation)}
            disabled={isAnalyzingAi}
            className="w-full py-3.5 rounded-full bg-[#A7194B] hover:bg-[#8D0D39] text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAnalyzingAi ? 'Analyzing FIR Logs...' : 'Run Gemini AI Risk Analysis'}</span>
          </button>

          {aiAnalysisResult && (
            <div className="bg-[#FFF0F3] border border-[#EFE6E1] rounded-[22px] p-4 space-y-2 text-xs text-[#221F20]">
              <div className="font-semibold text-[#A7194B] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                AI Analysis Evaluation
              </div>
              <p className="text-[#6E676A] leading-relaxed">{aiAnalysisResult.summary}</p>
            </div>
          )}

          <button
            onClick={() => onSelectLocationForRoute(selectedLocation)}
            className="w-full py-3.5 rounded-full bg-white hover:bg-[#FFF0F3] text-[#221F20] border border-[#EFE6E1] font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-[#A7194B]" />
            <span>Generate Safest Route Here</span>
          </button>
        </div>
      </div>
    </div>
    
    <LiveLocationShareModal
      isOpen={isLiveLocationModalOpen}
      onClose={() => setIsLiveLocationModalOpen(false)}
      locationLabel={selectedLocation?.name}
    />
    </>
  );
};