import React, { useState, useEffect, useRef } from "react";

import { RouteOption, SafetyLocation } from "../types";
import { GuardIaLogo } from "./GuardIaLogo";
import { LiveRouteMap } from "./LiveRouteMap";
import { geocodePlace, GeocodedPlace } from "../lib/geocode";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import {
  getWalkingRoute,
  formatDistance,
  formatDuration,
  LatLng,
  RouteStep,
} from "../lib/routing";

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
} from "lucide-react";

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
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState(
    selectedLocationTarget ? selectedLocationTarget.name : "",
  );
  const [timeOfDay, setTimeOfDay] = useState<"Day" | "Evening" | "Late Night">(
    "Late Night",
  );
  const [transportMode, setTransportMode] = useState<
    "Walking" | "Wheelchair / Assistive" | "Solo Transit"
  >("Walking");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState(
    "Step-free & Well-Lit",
  );

  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);

  const [activeRouteId, setActiveRouteId] = useState<string>("route-safest");
  const [originCoords, setOriginCoords] = useState<GeocodedPlace | null>(null);
  const [destinationCoords, setDestinationCoords] =
    useState<GeocodedPlace | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  // Becomes true once the origin-detection effect below has settled — via
  // real GPS, a fallback address, or a denied-permission message. Auto-route
  // generation waits for this so it never fires with a half-resolved origin.
  const [originReady, setOriginReady] = useState(false);

  // Tracks which selectedLocationTarget we've already auto-routed for, so
  // switching tabs and back doesn't repeatedly re-trigger the same route.
  const lastAutoRoutedTargetId = useRef<string | null>(null);

  // Shared route-generation logic used by both the manual "Re-calculate"
  // button and the automatic "Route there" trigger below.
  const runRouteGeneration = async (
    originPlace: GeocodedPlace,
    destinationPlace: GeocodedPlace,
  ) => {
    setIsLoading(true);
    setMapError(null);
    try {
      setOriginCoords(originPlace);
      setDestinationCoords(destinationPlace);

      const realRoutes = await getWalkingRoute(
        { lat: originPlace.lat, lng: originPlace.lng },
        { lat: destinationPlace.lat, lng: destinationPlace.lng },
        { alternatives: true },
      );
      const primaryRoute = realRoutes[0];
      setRoutePath(primaryRoute.coordinates);
      setRouteSteps(primaryRoute.steps);
      console.log(
        `OSRM found ${realRoutes.length} distinct route(s) for this trip.`,
      );

      const res = await fetch("/api/ai/analyze-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originPlace.displayName,
          destination: destinationPlace.displayName,
          timeOfDay,
          transportMode,
          accessibilityNeeds,
        }),
      });

      if (!res.ok) {
        throw new Error(`analyze-route responded ${res.status}`);
      }
      const data = await res.json();

      if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
        const usableCount = Math.min(data.routes.length, realRoutes.length);
        const updatedRoutes = data.routes
          .slice(0, usableCount)
          .map((r: RouteOption, idx: number) => ({
            ...r,
            distance: formatDistance(realRoutes[idx].distanceMeters),
            estimatedTime: formatDuration(realRoutes[idx].durationSeconds),
          }));
        setRoutes(updatedRoutes);
        setActiveRouteId(updatedRoutes[0].id);

        if (updatedRoutes.length === 1) {
          setMapError(
            "Only one distinct walking path was found between these points — showing a single verified route rather than fabricated alternatives.",
          );
        }
      } else {
        setMapError(
          "Live route map loaded, but the AI safety analysis didn't return usable route options. Try again in a moment.",
        );
      }
    } catch (e) {
      console.error(e);
      setMapError(
        "Something went wrong fetching live map data. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRoutes = async () => {
    setIsLoading(true);
    setMapError(null);
    try {
      let originPlace = originCoords;
      let destinationPlace = destinationCoords;

      if (!originPlace || originPlace.displayName !== origin) {
        originPlace = await geocodePlace(origin, { countryCode: "in" });
      }
      if (!destinationPlace || destinationPlace.displayName !== destination) {
        destinationPlace = await geocodePlace(destination, {
          countryCode: "in",
        });
      }

      if (!originPlace || !destinationPlace) {
        setMapError(
          "Could not find one of those locations. Try a more specific address.",
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(false); // runRouteGeneration will set it back to true
      await runRouteGeneration(originPlace, destinationPlace);
    } catch (e) {
      console.error(e);
      setMapError("Could not resolve one of those locations. Please try again.");
      setIsLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        setOrigin(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setOriginCoords({
          lat: latitude,
          lng: longitude,
          displayName: "Current Location",
        });

        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        )
          .then((res) => res.json())
          .then((data) => {
            if (data?.display_name) {
              setOrigin(data.display_name);
              setOriginCoords({
                lat: latitude,
                lng: longitude,
                displayName: data.display_name,
              });
            }
          })
          .catch((err) => {
            console.error("Reverse geocode failed:", err);
          });
      },
      (err) => {
        console.error("Geolocation error:", err.code, err.message);
        setMapError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow it in your browser's site settings."
            : "Could not access your location. Make sure GPS/location services are on.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Auto-detect the user's current location as the starting point on mount.
  // Marks originReady in every branch (success, fallback, and denied) so the
  // auto-route effect below always knows when it's safe to proceed.
  useEffect(() => {
    if (!navigator.geolocation) {
      setOrigin("Connaught Place, New Delhi, India");
      setOriginReady(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setOrigin(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setOriginCoords({ lat: latitude, lng: longitude, displayName: "Current Location" });
        setOriginReady(true);

        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.display_name) {
              setOrigin(data.display_name);
              setOriginCoords({ lat: latitude, lng: longitude, displayName: data.display_name });
            }
          })
          .catch(() => {
            // Reverse geocode failed — raw coordinates from above are still fine.
          });
      },
      (err) => {
        console.warn("Geolocation unavailable, using fallback:", err.message);
        setOrigin("Connaught Place, New Delhi, India");
        setOriginReady(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-run everything the moment a target is selected via "Route there" ---
  // Runs whenever selectedLocationTarget changes (not just on first mount),
  // waits for the origin to be ready, and calls the exact same pipeline the
  // manual button uses — so distance, ETA, safety scoring, and turn-by-turn
  // steps all populate automatically with zero extra clicks.
  useEffect(() => {
    if (!selectedLocationTarget || !originReady) return;
    if (lastAutoRoutedTargetId.current === selectedLocationTarget.id) return;
    lastAutoRoutedTargetId.current = selectedLocationTarget.id;

    setDestination(selectedLocationTarget.name);

    // SafetyLocation already carries real lat/lng — no need to geocode the
    // destination text at all, which also sidesteps Nominatim occasionally
    // failing to resolve a location's display name.
    const destinationPlace: GeocodedPlace = {
      lat: selectedLocationTarget.lat,
      lng: selectedLocationTarget.lng,
      displayName: selectedLocationTarget.name,
    };

    (async () => {
      let resolvedOrigin = originCoords;
      if (!resolvedOrigin) {
        resolvedOrigin = await geocodePlace(origin, { countryCode: "in" });
      }
      if (!resolvedOrigin) {
        setMapError(
          "Could not detect your starting location automatically. Set it manually above and click Re-calculate.",
        );
        return;
      }
      await runRouteGeneration(resolvedOrigin, destinationPlace);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationTarget, originReady]);

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
            <span>
              {isLoading
                ? "Calculating FIR Maps..."
                : "Re-calculate Safest Routes"}
            </span>
          </button>
        </div>

        {/* Origin & Destination Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">
              Start Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-[#A70F43]" />
              <PlaceAutocomplete
                value={origin}
                onChange={setOrigin}
                onSelect={(place) => setOriginCoords(place)}
                placeholder="Detecting your location..."
              />
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="text-[11px] text-[#A70F43] font-semibold mt-1.5 hover:underline"
            >
              📍 Use my current location
            </button>
          </div>

          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">
              Destination
            </label>
            <div className="relative">
              <PlaceAutocomplete
                value={destination}
                onChange={setDestination}
                onSelect={(place) => setDestinationCoords(place)}
                placeholder="Where are you headed?"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#6E676A] mb-1.5 font-medium">
              Time Context
            </label>
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
            <label className="block text-[#6E676A] mb-1.5 font-medium">
              Travel Mode
            </label>
            <select
              value={transportMode}
              onChange={(e: any) => setTransportMode(e.target.value)}
              className="w-full bg-[#FEFCFA] border border-[#EFE6E1] rounded-full px-4 py-2.5 text-[#221F20] focus:outline-none focus:border-[#A70F43]"
            >
              <option value="Walking">Walking (Solo / Group)</option>
              <option value="Wheelchair / Assistive">
                Wheelchair / Senior Walker
              </option>
              <option value="Solo Transit">E-Rickshaw / Night Bus</option>
            </select>
          </div>
        </div>

        {/* Quick Destination Presets */}
        <div className="flex items-center space-x-2 text-xs pt-1 overflow-x-auto no-scrollbar">
          <span className="text-[#6E676A] font-medium whitespace-nowrap">
            Quick Target:
          </span>
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setDestination(loc.name)}
              className="px-3 py-1.5 rounded-full bg-[#FEFCFA] hover:bg-[#FFF0F3] text-[#221F20] whitespace-nowrap transition-colors border border-[#EFE6E1]"
            >
              {loc.name.split(" ")[0]}...
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-4 rounded-[18px] bg-[#FFF0F3] border border-[#EFE6E1] text-[#A70F43] text-xs font-semibold">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Calculating your safest route automatically...</span>
        </div>
      )}

      {mapError && (
        <div className="flex items-start gap-2 p-4 rounded-[18px] bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{mapError}</span>
        </div>
      )}

      {originCoords && destinationCoords && (
        <div className="bg-white border border-[#EFE6E1] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#221F20] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#A70F43]" />
              Live Route Map
            </h3>
            <span className="text-[11px] text-[#6E676A]">
              OpenStreetMap + OSRM (real routing data) · Safety scoring via
              Gemini AI + community reports
            </span>
          </div>
          <LiveRouteMap
            origin={{ lat: originCoords.lat, lng: originCoords.lng }}
            destination={{
              lat: destinationCoords.lat,
              lng: destinationCoords.lng,
            }}
            path={routePath}
          />
        </div>
      )}
      {/* Generated Route Options Cards Grid */}
      {routes.length === 0 ? (
        <div className="bg-white border border-dashed border-[#EFE6E1] rounded-[24px] p-10 text-center space-y-2">
          <Navigation className="w-6 h-6 text-[#A70F43] mx-auto" />
          <p className="text-sm font-semibold text-[#221F20]">
            No route generated yet
          </p>
          <p className="text-xs text-[#6E676A]">
            Enter a start and destination above, then click "Re-calculate Safest
            Routes" to see live options — or pick "Route there" from the Map
            tab to have this happen automatically.
          </p>
        </div>
      ) : (
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
                    ? "bg-white border-[#A70F43] ring-2 ring-[#FFF0F3] shadow-[0_4px_20px_rgba(167,15,67,0.06)]"
                    : "bg-white border-[#EFE6E1] hover:border-[#A70F43]"
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
                          ? "bg-[#FFF0F3] text-[#A70F43] border border-[#EFE6E1]"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      Safety {route.safetyScore}/100
                    </div>
                  </div>

                  <h3 className="text-[18px] font-semibold text-[#221F20] mb-1.5">
                    {route.name}
                  </h3>

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
                        <span className="text-[#A70F43] font-bold">
                          {route.lightingPercent}%
                        </span>
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
                        <span className="text-[#221F20] font-bold">
                          {route.accessibilityScore}%
                        </span>
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
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-[#221F20]"
                      >
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
                      ? "bg-[#A70F43] hover:bg-[#8D0D39] text-white shadow-xs"
                      : "bg-[#FEFCFA] hover:bg-[#FFF0F3] text-[#221F20] border border-[#EFE6E1]"
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>Start Live Guided Walk</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

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
            {routeSteps.length === 0 ? (
              <p className="text-[#6E676A] text-xs">
                Generate a route to see live turn-by-turn steps.
              </p>
            ) : (
              routeSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-3 p-3.5 rounded-[18px] bg-[#FEFCFA] border border-[#EFE6E1]"
                >
                  <div className="w-6 h-6 rounded-full bg-[#A70F43] text-white flex items-center justify-center font-bold shrink-0 text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-[#221F20]">
                      {step.instruction}
                    </div>
                    <p className="text-[#6E676A] text-xs mt-0.5">
                      {formatDistance(step.distanceMeters)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};