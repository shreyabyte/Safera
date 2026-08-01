import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { SafetyMap } from './components/SafetyMap';
import { RouteGenerator } from './components/RouteGenerator';
import { AccessibilityMapper } from './components/AccessibilityMapper';
import { MovementDetection } from './components/MovementDetection';
import { SosDialog } from './components/SosDialog';
import { EvidenceVault } from './components/EvidenceVault';
import { VitalSigns } from './components/VitalSigns';
import { LegalRightsAdvisor } from './components/LegalRightsAdvisor';
import { CommunityHub } from './components/CommunityHub';
import { OfflineEmergencyToolkit } from './components/OfflineEmergencyToolkit';
import { AiCompanion } from './components/AiCompanion';
import { GuardIaLogo } from './components/GuardIaLogo';
import { WifiOff, AlertTriangle } from 'lucide-react';

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

  const [isOffline, setIsOffline] = useState(false);
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isRecordingVault, setIsRecordingVault] = useState(false);
  const [selectedRouteTarget, setSelectedRouteTarget] = useState<SafetyLocation | undefined>(undefined);

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

  const handleAddEvidence = (item: EvidenceItem) => {
    setEvidenceList((prev) => [item, ...prev]);
  };

  const handleSelectLocationForRoute = (loc: SafetyLocation) => {
    setSelectedRouteTarget(loc);
    setActiveTab('routes');
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
          isRecordingVault={isRecordingVault}
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
            />
          )}

          {activeTab === 'vault' && (
            <EvidenceVault
              evidenceList={evidenceList}
              onAddEvidence={handleAddEvidence}
              isRecordingVault={isRecordingVault}
              setIsRecordingVault={setIsRecordingVault}
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
              setIsOffline={setIsOffline}
              onTriggerSos={() => setIsSosOpen(true)}
            />
          )}

          {activeTab === 'companion' && <AiCompanion />}
        </main>
      </div>

      {/* SOS Emergency Modal */}
      <SosDialog
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        contacts={contacts}
        onAddContact={handleAddContact}
        onDeleteContact={handleDeleteContact}
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
