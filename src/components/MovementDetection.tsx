import React, { useState, useEffect } from 'react';
import { MovementSensorSettings } from '../types';
import { GuardIaLogo } from './GuardIaLogo';
import { Radio, AlertTriangle, ShieldCheck, Clock, Zap, Smartphone, Activity, CheckCircle2, Sliders, Volume2 } from 'lucide-react';

interface MovementDetectionProps {
  settings: MovementSensorSettings;
  onUpdateSettings: (newSettings: MovementSensorSettings) => void;
  onTriggerSos: () => void;
}

export const MovementDetection: React.FC<MovementDetectionProps> = ({
  settings,
  onUpdateSettings,
  onTriggerSos,
}) => {
  const [activeCountdown, setActiveCountdown] = useState<number | null>(null);
  const [activeAlarmType, setActiveAlarmType] = useState<string | null>(null);
  const [simulatedGForce, setSimulatedGForce] = useState<number>(1.0);

  // Live Device Motion API Listener
  useEffect(() => {
    if (!settings.isEnabled) return;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.8;
        setSimulatedGForce(parseFloat(totalAcc.toFixed(2)));

        // Real fall or violent shake detection threshold
        if (settings.fallDetection && totalAcc > 4.2) {
          triggerSafetyCheck('Sudden Fall Detected by Accelerometer');
        } else if (settings.shakingDetection && totalAcc > 3.0) {
          triggerSafetyCheck('Violent Shaking / Motion Spikes Detected');
        }
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }

    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, [settings]);

  // Countdown Interval Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeCountdown !== null && activeCountdown > 0) {
      timer = setTimeout(() => {
        setActiveCountdown(activeCountdown - 1);
      }, 1000);
    } else if (activeCountdown === 0) {
      // Time expired -> DISPATCH SOS
      setActiveCountdown(null);
      onTriggerSos();
    }
    return () => clearTimeout(timer);
  }, [activeCountdown, onTriggerSos]);

  const triggerSafetyCheck = (reason: string) => {
    setActiveAlarmType(reason);
    setActiveCountdown(20); // 20 seconds to respond "I'm Safe"
  };

  const handleUserConfirmedSafe = () => {
    setActiveCountdown(null);
    setActiveAlarmType(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Control Header */}
      <div className="bg-white border border-[#EFE6E1] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Radio className="w-5 h-5 text-[#A70F43] animate-pulse" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FFF0F3] text-[#A70F43] border border-[#EFE6E1]">
                  AI Sensor Safeguard
                </span>
              </div>
              <h2 className="text-2xl font-bold text-[#221F20] tracking-tight mt-1">
                AI-Powered Sensor & Movement Detection
              </h2>
              <p className="text-[15px] text-[#6E676A] mt-1">
                Monitors smartphone & watch sensors for sudden falls, violent shaking, dragging, or prolonged inactivity.
              </p>
            </div>
          </div>

          {/* Master Toggle Button */}
          <button
            onClick={() => onUpdateSettings({ ...settings, isEnabled: !settings.isEnabled })}
            className={`px-5 py-2.5 rounded-full text-xs font-semibold border transition-all flex items-center space-x-2 shadow-xs ${
              settings.isEnabled
                ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                : 'bg-[#FEFCFA] text-[#6E676A] border-[#EFE6E1]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>AI Sensor Detection: {settings.isEnabled ? 'ACTIVE' : 'DISABLED'}</span>
          </button>
        </div>
      </div>

      {/* Safety Check Countdown Overlay Pop-up Modal */}
      {activeCountdown !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#A70F43] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-center text-[#2F2B2D]">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#A70F43] text-white flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-white fill-white animate-pulse" />
            </div>

            <div>
              <span className="text-xs uppercase font-mono font-bold text-[#A70F43] tracking-wider">
                Unusual Motion Event
              </span>
              <h3 className="text-lg font-extrabold text-[#2F2B2D] mt-1">{activeAlarmType}</h3>
              <p className="text-xs text-[#7B7280] mt-1.5">
                Safera detected an abnormal movement pattern. Confirm safety within the countdown or an emergency SOS alert will be dispatched automatically.
              </p>
            </div>

            {/* Big Countdown Timer Circle */}
            <div className="my-3">
              <div className="text-4xl font-mono font-black text-[#A70F43] animate-pulse">
                00:{activeCountdown < 10 ? `0${activeCountdown}` : activeCountdown}
              </div>
              <span className="text-[10px] text-[#7B7280]">Seconds remaining until SOS dispatch</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleUserConfirmedSafe}
                className="py-2.5 rounded-xl bg-[#FFF8F9] hover:bg-[#FFF0F3] text-[#2F2B2D] border border-[#E9D8DE] font-bold text-xs transition-colors"
              >
                I AM SAFE (Dismiss)
              </button>
              <button
                onClick={onTriggerSos}
                className="py-2.5 rounded-xl bg-[#A70F43] hover:bg-[#8D0D39] text-white font-bold text-xs transition-colors shadow-sm border border-[#8D0D39]"
              >
                DISPATCH SOS NOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Dashboard & Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Real-time Motion Vector & Live Sensors */}
        <div className="lg:col-span-6 bg-white border border-[#E9D8DE] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9D8DE] pb-2">
            <h3 className="text-xs font-bold text-[#2F2B2D] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#A70F43]" />
              Live Accelerometer & Motion Telemetry
            </h3>
            <span className="text-xs font-mono text-[#A70F43] font-bold">
              {simulatedGForce} G-Force
            </span>
          </div>

          <div className="bg-[#FFF8F9] p-3 rounded-xl border border-[#E9D8DE] space-y-2">
            <div className="flex justify-between text-xs text-[#7B7280]">
              <span>Accelerometer Load Gauge:</span>
              <span className="font-bold text-[#2F2B2D]">{simulatedGForce > 2.5 ? 'CRITICAL SPIKE' : 'NORMAL'}</span>
            </div>
            <div className="w-full bg-[#E9D8DE] h-2.5 rounded-full overflow-hidden border border-[#E9D8DE]">
              <div
                className={`h-full transition-all ${
                  simulatedGForce > 3.0
                    ? 'bg-rose-500'
                    : simulatedGForce > 2.0
                    ? 'bg-amber-400'
                    : 'bg-[#A70F43]'
                }`}
                style={{ width: `${Math.min(100, (simulatedGForce / 5.0) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Individual Motion Checkers */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE]">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-[#A70F43]" />
                <span className="font-semibold text-[#2F2B2D]">Sudden Fall Detection</span>
              </div>
              <input
                type="checkbox"
                checked={settings.fallDetection}
                onChange={(e) => onUpdateSettings({ ...settings, fallDetection: e.target.checked })}
                className="w-4 h-4 accent-[#A70F43]"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE]">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#A70F43]" />
                <span className="font-semibold text-[#2F2B2D]">Violent Shaking / Struggle Detector</span>
              </div>
              <input
                type="checkbox"
                checked={settings.shakingDetection}
                onChange={(e) => onUpdateSettings({ ...settings, shakingDetection: e.target.checked })}
                className="w-4 h-4 accent-[#A70F43]"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE]">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-[#A70F43]" />
                <span className="font-semibold text-[#2F2B2D]">Dragging / Sudden Acceleration</span>
              </div>
              <input
                type="checkbox"
                checked={settings.draggingDetection}
                onChange={(e) => onUpdateSettings({ ...settings, draggingDetection: e.target.checked })}
                className="w-4 h-4 accent-[#A70F43]"
              />
            </div>

            {/* Prolonged Inactivity Settings */}
            <div className="p-3 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#A70F43]" />
                  <span className="font-semibold text-[#2F2B2D]">Inactivity Check-In Timer</span>
                </div>
                <span className="font-mono text-[#A70F43] font-bold">{settings.inactivityThresholdHours} Hours</span>
              </div>

              <p className="text-[10px] text-[#7B7280]">
                Pops up an automatic safety check-in prompt if no movement or app interaction occurs for {settings.inactivityThresholdHours} hours.
              </p>

              <input
                type="range"
                min="1"
                max="12"
                value={settings.inactivityThresholdHours}
                onChange={(e) => onUpdateSettings({ ...settings, inactivityThresholdHours: parseInt(e.target.value) })}
                className="w-full accent-[#A70F43] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Interactive Sensor Test Pad */}
        <div className="lg:col-span-6 bg-white border border-[#E9D8DE] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-[#E9D8DE] pb-2">
            <h3 className="text-xs font-bold text-[#2F2B2D] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#A70F43]" />
              Interactive Sensor Event Simulator
            </h3>
            <p className="text-xs text-[#7B7280] mt-0.5">
              Test how Safera responds to abnormal motion triggers safely
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <button
              onClick={() => {
                setSimulatedGForce(4.8);
                triggerSafetyCheck('Sudden High-Impact Fall (Simulated)');
              }}
              className="p-3 rounded-xl bg-[#FFF8F9] hover:bg-[#FFF0F3] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
            >
              <div className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#A70F43]" />
                <span>Simulate Fall Event</span>
              </div>
              <p className="text-[10px] text-[#7B7280]">Simulates 4.8G vertical drop and impact stillness.</p>
            </button>

            <button
              onClick={() => {
                setSimulatedGForce(3.6);
                triggerSafetyCheck('Violent Shaking / Defense Struggle (Simulated)');
              }}
              className="p-3 rounded-xl bg-[#FFF8F9] hover:bg-[#FFF0F3] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
            >
              <div className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#A70F43]" />
                <span>Simulate Violent Struggle</span>
              </div>
              <p className="text-[10px] text-[#7B7280]">Simulates rapid multi-axis phone shaking spikes.</p>
            </button>

            <button
              onClick={() => {
                setSimulatedGForce(3.1);
                triggerSafetyCheck('Sudden Dragging / High Acceleration (Simulated)');
              }}
              className="p-3 rounded-xl bg-[#FFF8F9] hover:bg-[#FFF0F3] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
            >
              <div className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#A70F43]" />
                <span>Simulate Forced Dragging</span>
              </div>
              <p className="text-[10px] text-[#7B7280]">Simulates abrupt speed increase & linear pulling motion.</p>
            </button>

            <button
              onClick={() => {
                setSimulatedGForce(1.0);
                triggerSafetyCheck(`Inactivity Check (${settings.inactivityThresholdHours}h Timer Expiry)`);
              }}
              className="p-3 rounded-xl bg-[#FFF8F9] hover:bg-[#FFF0F3] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
            >
              <div className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#A70F43]" />
                <span>Simulate Inactivity Expiry</span>
              </div>
              <p className="text-[10px] text-[#7B7280]">
                Pops up safety check notification after idle duration.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

