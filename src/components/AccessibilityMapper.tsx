import React, { useState } from 'react';
import { SafetyLocation } from '../types';
import { GuardIaLogo } from './GuardIaLogo';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Info,
  Phone,
  MapPin,
  Heart,
  ChevronRight,
  Navigation,
  Accessibility,
  Footprints,
  Sun,
  Activity,
  UserCheck,
} from 'lucide-react';

interface AccessibilityMapperProps {
  locations: SafetyLocation[];
  onSelectLocationForRoute: (loc: SafetyLocation) => void;
}

export const AccessibilityMapper: React.FC<AccessibilityMapperProps> = ({
  locations,
  onSelectLocationForRoute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRamps, setFilterRamps] = useState(false);
  const [filterStepFree, setFilterStepFree] = useState(false);
  const [filterWashrooms, setFilterWashrooms] = useState(false);
  const [filterLighting, setFilterLighting] = useState(false);
  const [filterPolice, setFilterPolice] = useState(false);
  const [filterTactile, setFilterTactile] = useState(false);

  const filteredLocations = locations.filter((loc) => {
    if (searchQuery && !loc.name.toLowerCase().includes(searchQuery.toLowerCase()) && !loc.area.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterRamps && !loc.accessibility.wheelchairRamps) return false;
    if (filterStepFree && !loc.accessibility.stepFreeEntrances) return false;
    if (filterWashrooms && !loc.accessibility.accessiblePublicWashrooms) return false;
    if (filterLighting && !loc.accessibility.goodStreetlights) return false;
    if (filterPolice && !loc.accessibility.policeBooths) return false;
    if (filterTactile && !loc.accessibility.tactilePaving) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#EFE6E1] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#FFF0F3] text-[#A70F43] border border-[#EFE6E1] text-xs font-semibold mb-1.5">
              <Heart className="w-3.5 h-3.5 text-[#A70F43] fill-[#A70F43]" />
              <span>Elderly & Differently Abled Safe Spaces</span>
            </div>
            <h2 className="text-2xl font-bold text-[#221F20] tracking-tight">Accessibility Safety Mapper</h2>
            <p className="text-[15px] text-[#6E676A] mt-1">
              Inspect step-free entrances, wheelchair ramps, accessible washrooms, and police kiosks.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6E676A]" />
            <input
              type="text"
              placeholder="Search place name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FEFCFA] border border-[#EFE6E1] rounded-full pl-10 pr-4 py-2.5 text-xs text-[#221F20] placeholder-[#6E676A] focus:outline-none focus:border-[#A70F43]"
            />
          </div>
        </div>

        {/* Feature Filters Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#EFE6E1]">
          <span className="text-xs font-semibold text-[#6E676A] flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Filter:
          </span>

          <button
            onClick={() => setFilterRamps(!filterRamps)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
              filterRamps
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#221F20] border-[#EFE6E1] hover:bg-[#FFF0F3]'
            }`}
          >
            <Accessibility className="w-3.5 h-3.5 text-[#A70F43]" />
            <span>Wheelchair Ramps</span>
          </button>

          <button
            onClick={() => setFilterStepFree(!filterStepFree)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
              filterStepFree
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#221F20] border-[#EFE6E1] hover:bg-[#FFF0F3]'
            }`}
          >
            <Footprints className="w-3.5 h-3.5 text-[#A70F43]" />
            <span>Step-Free Entrances</span>
          </button>

          <button
            onClick={() => setFilterWashrooms(!filterWashrooms)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
              filterWashrooms
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#221F20] border-[#EFE6E1] hover:bg-[#FFF0F3]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-[#A70F43]" />
            <span>Accessible Washrooms</span>
          </button>

          <button
            onClick={() => setFilterLighting(!filterLighting)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
              filterLighting
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#221F20] border-[#EFE6E1] hover:bg-[#FFF0F3]'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-[#A70F43]" />
            <span>Good Lighting</span>
          </button>

          <button
            onClick={() => setFilterPolice(!filterPolice)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
              filterPolice
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#221F20] border-[#EFE6E1] hover:bg-[#FFF0F3]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#A70F43]" />
            <span>Police Kiosks</span>
          </button>

          <button
            onClick={() => setFilterTactile(!filterTactile)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
              filterTactile
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#221F20] border-[#EFE6E1] hover:bg-[#FFF0F3]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#A70F43]" />
            <span>Tactile Paving</span>
          </button>

          {(filterRamps || filterStepFree || filterWashrooms || filterLighting || filterPolice || filterTactile) && (
            <button
              onClick={() => {
                setFilterRamps(false);
                setFilterStepFree(false);
                setFilterWashrooms(false);
                setFilterLighting(false);
                setFilterPolice(false);
                setFilterTactile(false);
              }}
              className="px-3 py-1.5 text-xs text-[#A70F43] underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Accessible Places Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredLocations.map((loc) => {
          const acc = loc.accessibility;
          // Calculate custom accessibility score
          const totalFeatures = Object.values(acc).filter(Boolean).length;
          const totalPossible = Object.keys(acc).length;
          const scorePercent = Math.round((totalFeatures / totalPossible) * 100);

          return (
            <div
              key={loc.id}
              className="bg-white border border-[#EFE6E1] rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4 hover:border-[#A70F43] transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between border-b border-[#EFE6E1] pb-3 gap-2">
                  <div>
                    <span className="text-xs font-medium text-[#6E676A]">
                      {loc.area}
                    </span>
                    <h3 className="text-[18px] font-semibold text-[#221F20] mt-0.5">{loc.name}</h3>
                  </div>

                  <div className="bg-[#FFF0F3] border border-[#EFE6E1] text-[#221F20] rounded-[16px] px-3 py-1.5 text-center shrink-0">
                    <div className="text-[10px] font-medium text-[#6E676A]">Accessibility</div>
                    <div className="text-base font-bold text-[#A70F43]">{scorePercent}%</div>
                  </div>
                </div>

                {/* Road & Distance Summary */}
                <div className="flex items-center space-x-3 text-xs text-[#6E676A] my-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#A70F43]" />
                    <span>{loc.roadType}</span>
                  </span>
                  <span>•</span>
                  <span>Police: {loc.policeDistanceMeters}m away</span>
                </div>

                {/* Features Matrix Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <FeatureBadge label="Wheelchair Ramps" active={acc.wheelchairRamps} />
                  <FeatureBadge label="Step-Free Entrances" active={acc.stepFreeEntrances} />
                  <FeatureBadge label="CCTV Coverage" active={acc.cctvCoverage} />
                  <FeatureBadge label="Smooth Footpaths" active={acc.smoothFootpaths} />
                  <FeatureBadge label="Good Streetlights" active={acc.goodStreetlights} />
                  <FeatureBadge label="Accessible Washroom" active={acc.accessiblePublicWashrooms} />
                  <FeatureBadge label="Police Booth" active={acc.policeBooths} />
                  <FeatureBadge label="Phone Kiosk" active={acc.phoneBooths} />
                  <FeatureBadge label="Braille Signage" active={acc.brailleSignage} />
                  <FeatureBadge label="Tactile Paving" active={acc.tactilePaving} />
                </div>
              </div>

              <div className="pt-3 border-t border-[#EFE6E1] flex items-center justify-between gap-3">
                <span className="text-xs text-[#6E676A]">
                  Trust Index: <strong className="text-[#221F20]">{loc.trustScore}% Verified</strong>
                </span>

                <button
                  onClick={() => onSelectLocationForRoute(loc)}
                  className="px-4 py-2 rounded-full bg-[#A70F43] hover:bg-[#8D0D39] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Route Here</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FeatureBadge: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <div
    className={`p-2 rounded-[12px] border flex items-center gap-2 text-xs ${
      active
        ? 'bg-[#FFF0F3] border-[#EFE6E1] text-[#A70F43] font-medium'
        : 'bg-[#FEFCFA] border-[#EFE6E1] text-[#6E676A]'
    }`}
  >
    {active ? (
      <CheckCircle2 className="w-4 h-4 text-[#5FA777] shrink-0" />
    ) : (
      <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
    )}
    <span className="line-clamp-1">{label}</span>
  </div>
);


