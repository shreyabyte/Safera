import React, { useState } from 'react';
import { RouteOption, SafetyLocation } from '../types';
import { GuardIaLogo } from './GuardIaLogo';
import {
  Shield,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Footprints,
  ChevronRight,
  Accessibility,
  ArrowRight,
} from 'lucide-react';

interface RouteGeneratorProps {
  locations: SafetyLocation[];
  selectedLocationTarget?: SafetyLocation;
  onStartNavigation: (route: RouteOption) => void;
}

export const RouteGenerator: React.FC<RouteGeneratorProps> = ({
  locations,
  selectedLocationTarget,
  onStartNavigation,
}) => {
  const [origin, setOrigin] = useState('Central Metro Station');
  const [destination, setDestination] = useState(
    selectedLocationTarget ? selectedLocationTarget.name : 'St. Mary’s Care Hospital & Senior Hub'
  );
  const [timeOfDay, setTimeOfDay] = useState<'Day' | 'Evening' | 'Late Night'>('Late Night');
  const [transportMode, setTransportMode] = useState<'Walking' | 'Wheelchair / Assistive' | 'Solo Transit'>('Walking');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('Step-free & Well-Lit');

  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([
    {
      id: 'route-safest',
      name: 'Safera Safest & Well-Lit Route',
      tag: 'Recommended for Night / Solo',
      distance: '2.4 km',
      estimatedTime: '18 mins',
      safetyScore: 94,
      accessibilityScore: 90,
      lightingPercent: 96,
      cctvCoverage: 88,
      policeBoothNearby: true,
      highlights: [
        '100% High-Intensity LED Streetlights',
        'Passes 2 Police Assistance Kiosks',
        'Active pedestrian foot traffic',
        'CCTV monitored entire corridor',
      ],
      riskSegments: ['Minor dark spot near Metro exit (50m) - Stay on east sidewalk'],
    },
    {
      id: 'route-accessible',
      name: '100% Accessible Step-Free Corridor',
      tag: 'Elderly & Wheelchair Optimized',
      distance: '2.6 km',
      estimatedTime: '21 mins',
      safetyScore: 91,
      accessibilityScore: 98,
      lightingPercent: 92,
      cctvCoverage: 85,
      policeBoothNearby: true,
      highlights: [
        'Zero steps or high curb drop-offs',
        'Tactile paving & broad ramps',
        'Accessible public washroom on route',
        'Smooth wide sidewalks',
      ],
      riskSegments: ['Pedestrian signal duration is short (15s) at 3rd Junction'],
    },
    {
      id: 'route-fastest',
      name: 'Direct Shortest Route',
      tag: 'Fastest - FIR Danger Warnings',
      distance: '1.8 km',
      estimatedTime: '13 mins',
      safetyScore: 62,
      accessibilityScore: 55,
      lightingPercent: 48,
      cctvCoverage: 35,
      policeBoothNearby: false,
      highlights: ['Shortest direct walking distance'],
      riskSegments: [
        '3 FIRs logged in rear alleyway in past 30 days',
        'Broken streetlights for 200m segment',
        'High curb without ramp near Market rear',
      ],
    },
  ]);

  const [activeRouteId, setActiveRouteId] = useState<string>('route-safest');

  const handleGenerateRoutes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          timeOfDay,
          transportMode,
          accessibilityNeeds,
        }),
      });
      const data = await res.json();
      if (data.routes && Array.isArray(data.routes)) {
        setRoutes(data.routes);
        setActiveRouteId(data.routes[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoute = routes.find((r) => r.id === activeRouteId) || routes[0];

  return (
    <div className="space-y-6">
      {/* Route Generator Control Card */}
      <div className="bg-white border border-[#EFE6E1] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFE6E1] pb-4">
          <div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FFF0F3] text-[#A70F43] border border-[#EFE6E1]">
              Dynamic Navigation Engine
            </span>
            <h2 className="text-2xl font-bold text-[#221F20] tracking-tight mt-1.5 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#A70F43]" />
              Dynamic Safest Route Generator
            </h2>
          </div>

          <button
            onClick={handleGenerateRoutes}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-full bg-[#A70F43] hover:bg-[#8D0D39] text-white font-semibold text-xs shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>{isLoading ? 'Calculating FIR Maps...' : 'Re-calculate Safest Routes'}</span>
          </button>
        </div>

        {/* Origin & Destination Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">Start Location</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-[#A70F43]" />
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full bg-[#FEFCFA] border border-[#EFE6E1] rounded-full pl-10 pr-4 py-2.5 text-[#221F20] focus:outline-none focus:border-[#A70F43]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">Destination</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-[#A70F43]" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-[#FEFCFA] border border-[#EFE6E1] rounded-full pl-10 pr-4 py-2.5 text-[#221F20] focus:outline-none focus:border-[#A70F43]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">Time Context</label>
            <select
              value={timeOfDay}
              onChange={(e: any) => setTimeOfDay(e.target.value)}
              className="w-full bg-[#FEFCFA] border border-[#EFE6E1] rounded-full px-4 py-2.5 text-[#221F20] focus:outline-none focus:border-[#A70F43]"
            >
              <option value="Day">Daylight (High Traffic)</option>
              <option value="Evening">Evening / Dusk</option>
              <option value="Late Night">Late Night (00:00 - 05:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">Travel Mode</label>
            <select
              value={transportMode}
              onChange={(e: any) => setTransportMode(e.target.value)}
              className="w-full bg-[#FEFCFA] border border-[#EFE6E1] rounded-full px-4 py-2.5 text-[#221F20] focus:outline-none focus:border-[#A70F43]"
            >
              <option value="Walking">Walking (Solo / Group)</option>
              <option value="Wheelchair / Assistive">Wheelchair / Senior Walker</option>
              <option value="Solo Transit">E-Rickshaw / Night Bus</option>
            </select>
          </div>
        </div>

        {/* Quick Destination Presets */}
        <div className="flex items-center space-x-2 text-xs pt-1 overflow-x-auto no-scrollbar">
          <span className="text-[#6E676A] font-medium whitespace-nowrap">Quick Target:</span>
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setDestination(loc.name)}
              className="px-3 py-1.5 rounded-full bg-[#FEFCFA] hover:bg-[#FFF0F3] text-[#221F20] whitespace-nowrap transition-colors border border-[#EFE6E1]"
            >
              {loc.name.split(' ')[0]}...
            </button>
          ))}
        </div>
      </div>

      {/* Generated Route Options Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {routes.map((route) => {
          const isSelected = route.id === activeRouteId;
          const isHighSafety = route.safetyScore >= 90;

          return (
            <div
              key={route.id}
              onClick={() => setActiveRouteId(route.id)}
              className={`cursor-pointer rounded-[24px] p-5 border transition-all relative flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'bg-white border-[#A70F43] ring-2 ring-[#FFF0F3] shadow-[0_4px_20px_rgba(167,15,67,0.06)]'
                  : 'bg-white border-[#EFE6E1] hover:border-[#A70F43]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-medium px-3 py-0.5 rounded-full bg-[#FFF0F3] text-[#A70F43] border border-[#EFE6E1]">
                    {route.tag}
                  </span>
                  <div
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isHighSafety
                        ? 'bg-[#FFF0F3] text-[#A70F43] border border-[#EFE6E1]'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    Safety {route.safetyScore}/100
                  </div>
                </div>

                <h3 className="text-[18px] font-semibold text-[#221F20] mb-1.5">{route.name}</h3>

                <div className="flex items-center space-x-3 text-xs text-[#6E676A] mb-4">
                  <span className="flex items-center space-x-1">
                    <Footprints className="w-3.5 h-3.5 text-[#A70F43]" />
                    <span>{route.distance}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-[#A70F43]" />
                    <span>{route.estimatedTime}</span>
                  </span>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-[#6E676A] mb-1">
                      <span>Lighting Coverage</span>
                      <span className="text-[#A70F43] font-bold">{route.lightingPercent}%</span>
                    </div>
                    <div className="w-full bg-[#FEFCFA] border border-[#EFE6E1] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#A70F43] h-full rounded-full transition-all"
                        style={{ width: `${route.lightingPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-[#6E676A] mb-1">
                      <span>Step-Free Accessibility</span>
                      <span className="text-[#221F20] font-bold">{route.accessibilityScore}%</span>
                    </div>
                    <div className="w-full bg-[#FEFCFA] border border-[#EFE6E1] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#5FA777] h-full rounded-full transition-all"
                        style={{ width: `${route.accessibilityScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Highlights List */}
                <div className="mt-4 space-y-1.5 text-xs text-[#221F20]">
                  <span className="text-[11px] font-semibold text-[#6E676A]">
                    Safety Features:
                  </span>
                  {route.highlights.map((h, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[#221F20]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#5FA777]" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* Risk Segments Warnings */}
                {route.riskSegments && route.riskSegments.length > 0 && (
                  <div className="mt-4 p-3 rounded-[16px] bg-amber-50/80 border border-amber-200 space-y-1 text-xs">
                    <span className="font-semibold text-amber-800 flex items-center gap-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Segment Warning:
                    </span>
                    {route.riskSegments.map((r, idx) => (
                      <p key={idx} className="text-amber-800 text-[11px]">
                        • {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartNavigation(route);
                }}
                className={`w-full py-2.5 rounded-full font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-[#A70F43] hover:bg-[#8D0D39] text-white shadow-xs'
                    : 'bg-[#FEFCFA] hover:bg-[#FFF0F3] text-[#221F20] border border-[#EFE6E1]'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>Start Live Guided Walk</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected Route Turn-By-Turn Preview */}
      {selectedRoute && (
        <div className="bg-white border border-[#EFE6E1] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#EFE6E1] pb-3">
            <h3 className="text-base font-bold text-[#221F20] flex items-center gap-2">
              <Footprints className="w-4 h-4 text-[#A70F43]" />
              Turn-By-Turn Analysis: {selectedRoute.name}
            </h3>
            <span className="text-xs text-[#6E676A]">Live GPS Sync</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start space-x-3 p-3.5 rounded-[18px] bg-[#FEFCFA] border border-[#EFE6E1]">
              <div className="w-6 h-6 rounded-full bg-[#A70F43] text-white flex items-center justify-center font-bold shrink-0 text-xs">
                1
              </div>
              <div>
                <div className="font-semibold text-[#221F20]">Depart {origin}</div>
                <p className="text-[#6E676A] text-xs mt-0.5">
                  Walk 400m along well-lit sidewalk. High CCTV density & police kiosk on right.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 rounded-[18px] bg-[#FEFCFA] border border-[#EFE6E1]">
              <div className="w-6 h-6 rounded-full bg-[#A70F43] text-white flex items-center justify-center font-bold shrink-0 text-xs">
                2
              </div>
              <div>
                <div className="font-semibold text-[#221F20]">Cross Civic Park Corridor</div>
                <p className="text-[#6E676A] text-xs mt-0.5">
                  Step-free ramp available. Tactile signals installed. Street lighting 100%.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 rounded-[18px] bg-[#FEFCFA] border border-[#EFE6E1]">
              <div className="w-6 h-6 rounded-full bg-[#A70F43] text-white flex items-center justify-center font-bold shrink-0 text-xs">
                3
              </div>
              <div>
                <div className="font-semibold text-[#221F20]">Arrive at {destination}</div>
                <p className="text-[#A70F43] font-medium text-xs mt-0.5">
                  24/7 Police & Security Desk at Entrance. Verified Safe Hub.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


