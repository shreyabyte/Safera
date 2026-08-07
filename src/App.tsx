import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { SafetyMap } from './components/SafetyMap';
import { RouteGenerator } from './components/RouteGenerator';
import { AccessibilityMapper } from './components/AccessibilityMapper';
import { MovementDetection } from './components/MovementDetection';
import { SafetyCheckOverlay } from './components/SafetyCheckOverlay';
import { SosDialog } from './components/SosDialog';
import { EvidenceVault } from './components/EvidenceVault';
import { VitalSigns } from './components/VitalSigns';
import { LegalRightsAdvisor } from './components/LegalRightsAdvisor';
import { CommunityHub } from './components/CommunityHub';
import { OfflineEmergencyToolkit } from './components/OfflineEmergencyToolkit';
import { AiCompanion } from './components/AiCompanion';
import { GuardIaLogo } from './components/GuardIaLogo';
import { WifiOff, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useMotionSafetyDetection } from './hooks/useMotionSafetyDetection';
import { useEvidenceRecorder } from './hooks/useEvidenceRecorder';

import {
  INITIAL_LOCATIONS,
  INITIAL_REPORTS,
  INITIAL_CONTACTS,
  INITIAL_EVIDENCE,
  INITIAL_LEGAL_ARTICLES,
} from './data/mockData';

import { SafetyLocation, CommunityReport, EmergencyContact, EvidenceItem, VitalSignData, MovementSensorSettings, RouteOption } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('map');
  const [locations, setLocations] = useState<SafetyLocation[]>(INITIAL_LOCATIONS);
  const [reports, setReports] = useState<CommunityReport[]>(INITIAL_REPORTS);
  const [contacts, setContacts] = useState<EmergencyContact[]>(INITIAL_CONTACTS);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(INITIAL_EVIDENCE);

  const [vitals, setVitals] = useState<VitalSignData>({
    timestamp: 'Just now',
    heartRate: 74,
    hrv: 62,
    stressLevel: 28,
    isSpike: false,
    wearableName: 'Apple Watch Ultra',
    connected: true,
  });

  const [sensorSettings, setSensorSettings] = useState<MovementSensorSettings>({
    isEnabled: true,
    fallDetection: true,
    shakingDetection: true,
    draggingDetection: true,
    inactivityThresholdHours: 5,
    autoCheckInIntervalMinutes: 30,
  });

  // Real connectivity, not a manual mock: reflects navigator.onLine + the
  // online/offline events. `forceOfflineDemo` layers on top purely so the
  // existing "Offline Maps: LOADED/STANDBY" switch in the toolkit still has
  // something to toggle for testing — you can force offline mode on top of
  // a real connection, but you can't fake being online when you're not.
  const isOnline = useOnlineStatus();
  const [forceOfflineDemo, setForceOfflineDemo] = useState(false);
  const isOffline = forceOfflineDemo || !isOnline;
  const setIsOffline = (val: boolean) => setForceOfflineDemo(val);

  const [isSosOpen, setIsSosOpen] = useState(false);
  const [selectedRouteTarget, setSelectedRouteTarget] = useState<SafetyLocation | undefined>(undefined);

  const handleAddEvidence = (item: EvidenceItem) => {
    setEvidenceList((prev) => [item, ...prev]);
  };

  // Mounted once, here at the app root — same reason as
  // useMotionSafetyDetection below: SOS can fire from any tab, so the
  // actual camera/mic capture + encryption + upload pipeline can't live
  // inside EvidenceVault.tsx anymore (that component only renders when
  // activeTab === 'vault', so an SOS trigger from another tab would have
  // had nothing to call).
  const evidenceRecorder = useEvidenceRecorder(handleAddEvidence);

  // Mounted once, here at the app root, so shake/fall/drag detection (and
  // the resulting "confirm you're safe or SOS auto-dispatches" countdown)
  // keeps running no matter which tab is currently open — Map, Vault,
  // Companion, wherever. Previously this listener only existed inside the
  // Sensors tab's own component and stopped the moment you navigated away.
  const {
    activeCountdown,
    activeAlarmType,
    gForce,
    confirmSafe,
    triggerSafetyCheck,
    dispatchNow,
    motionPermission,
    requestMotionPermission,
  } = useMotionSafetyDetection(sensorSettings, () => setIsSosOpen(true));

  const handleAddReport = (newReport: CommunityReport) => {
    setReports((prev) => [newReport, ...prev]);
  };

  const handleUpvoteReport = (id: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              upvotes: r.upvotes + 1,
              trustScore: Math.min(99, r.trustScore + 1),
            }
          : r
      )
    );
  };

  const handleAddContact = (contact: EmergencyContact) => {
    setContacts((prev) => [...prev, contact]);
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSelectLocationForRoute = (loc: SafetyLocation) => {
    setSelectedRouteTarget(loc);
    setActiveTab('routes');
  };

  // RouteGenerator calls this once it has consumed selectedRouteTarget and
  // auto-generated a route for it. Without this, selectedRouteTarget stays
  // set in App's state forever — and because RouteGenerator is unmounted
  // whenever activeTab !== 'routes' (conditionally rendered below), simply
  // switching tabs and back to "Routes" via the navbar remounts it with a
  // fresh internal ref guard, re-triggering the SAME auto-route generation
  // even though the user never clicked "Route there" / "Generate Safest
  // Route Here" again. Clearing the target here is what makes automatic
  // routing fire only in response to an explicit route-me-there action.
  const handleRouteTargetConsumed = () => {
    setSelectedRouteTarget(undefined);
  };

  const handleStartNavigation = (route: RouteOption) => {
    alert(`Starting Safera Live Guided Navigation for "${route.name}". Live tracking link active.`);
  };

  return (
    <div className="min-h-screen bg-[#FCF7F1] text-[#221F20] font-sans flex flex-col justify-between">
      <div>
        {/* Navigation Bar & Header */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onTriggerSos={() => setIsSosOpen(true)}
          isOffline={isOffline}
          setIsOffline={setIsOffline}
          isRecordingVault={evidenceRecorder.isRecording}
          heartRate={vitals.heartRate}
          movementSensorsActive={sensorSettings.isEnabled}
          userName="Shreya"
        />

        {/* Offline Banner Indicator */}
        {isOffline && (
          <div className="bg-[#FFF8F9] border-b border-[#E9D8DE] text-[#A70F43] py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4 text-[#A70F43]" />
            <span>Safera Running in Cached Offline Mode (Local Maps, SMS Alert Fallback, Siren Active)</span>
          </div>
        )}

        {/* Main Workspace Container */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {activeTab === 'map' && (
            <SafetyMap
              locations={locations}
              reports={reports}
              onSelectLocationForRoute={handleSelectLocationForRoute}
              onOpenReportModal={() => setActiveTab('community')}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'routes' && (
            <RouteGenerator
              locations={locations}
              selectedLocationTarget={selectedRouteTarget}
              onTargetConsumed={handleRouteTargetConsumed}
              onStartNavigation={handleStartNavigation}
            />
          )}

          {activeTab === 'accessibility' && (
            <AccessibilityMapper
              locations={locations}
              onSelectLocationForRoute={handleSelectLocationForRoute}
            />
          )}

          {activeTab === 'sensors' && (
            <MovementDetection
              settings={sensorSettings}
              onUpdateSettings={setSensorSettings}
              onTriggerSos={() => setIsSosOpen(true)}
              gForce={gForce}
              triggerSafetyCheck={triggerSafetyCheck}
              motionPermission={motionPermission}
              requestMotionPermission={requestMotionPermission}
            />
          )}

          {activeTab === 'vault' && (
            <EvidenceVault
              evidenceList={evidenceList}
              recorder={evidenceRecorder}
            />
          )}

          {activeTab === 'vitals' && (
            <VitalSigns
              vitals={vitals}
              onUpdateVitals={setVitals}
              onTriggerSos={() => setIsSosOpen(true)}
            />
          )}

          {activeTab === 'legal' && (
            <LegalRightsAdvisor articles={INITIAL_LEGAL_ARTICLES} />
          )}

          {activeTab === 'community' && (
            <CommunityHub
              reports={reports}
              onAddReport={handleAddReport}
              onUpvoteReport={handleUpvoteReport}
            />
          )}

          {activeTab === 'toolkit' && (
            <OfflineEmergencyToolkit
              isOffline={isOffline}
              isRealOffline={!isOnline}
              setIsOffline={setIsOffline}
              onTriggerSos={() => setIsSosOpen(true)}
              contacts={contacts}
            />
          )}

          {activeTab === 'companion' && <AiCompanion />}
        </main>
      </div>

      {/* Global Safety Check Countdown — renders on top of whatever tab is
          open, since the motion listener above now runs app-wide. */}
      <SafetyCheckOverlay
        activeCountdown={activeCountdown}
        activeAlarmType={activeAlarmType}
        onConfirmSafe={confirmSafe}
        onDispatchNow={dispatchNow}
      />

      {/* SOS Emergency Modal */}
      <SosDialog
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        contacts={contacts}
        onAddContact={handleAddContact}
        onDeleteContact={handleDeleteContact}
        isOffline={isOffline}
        onStartRecording={evidenceRecorder.startRecording}
        onStopRecording={evidenceRecorder.stopRecording}
        isRecording={evidenceRecorder.isRecording}
      />

      {/* Footer */}
      <footer className="border-t border-[#EFE6E1] bg-[#FEFCFA] py-6 mt-12 text-center text-xs text-[#6E676A]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <GuardIaLogo size="sm" showText={false} />
            <span className="font-semibold text-[#221F20]">Safera Personal Safety & Accessibility System</span>
            <span>•</span>
            <span className="text-xs text-[#6E676A]">Powered by Gemini AI</span>
          </div>
          <div className="text-[#6E676A] font-medium text-xs">
            Live Location GPS Active • Encryption SHA-256 Enabled
          </div>
        </div>
      </footer>
    </div>
  );
}