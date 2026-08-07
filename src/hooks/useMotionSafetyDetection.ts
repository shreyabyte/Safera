import { useEffect, useRef, useState } from 'react';
import { MovementSensorSettings } from '../types';

const SAFETY_CHECK_SECONDS = 20;

export interface MotionSafetyState {
  /** Seconds left before auto-SOS fires, or null if no check is active. */
  activeCountdown: number | null;
  /** Human-readable reason shown in the overlay, e.g. "Sudden Fall Detected". */
  activeAlarmType: string | null;
  /** Live accelerometer magnitude in G, for any UI (e.g. the sensor test pad) that wants to display it. */
  gForce: number;
  /** User taps "I'm safe" — cancels the pending auto-SOS. */
  confirmSafe: () => void;
  /** Manually start a safety check countdown (used by the simulator buttons too). */
  triggerSafetyCheck: (reason: string) => void;
  /** Skip the countdown and dispatch SOS immediately. */
  dispatchNow: () => void;
  /**
   * iOS 13+ (Safari) requires an explicit user-gesture permission prompt
   * before `devicemotion` events fire at all — without this, sensor
   * detection silently does nothing on iPhone even with settings "enabled".
   * 'granted' | 'unsupported' mean events should work; 'unknown' means we
   * haven't asked yet (call requestMotionPermission from a click handler);
   * 'denied' means the user said no and we should say so in the UI.
   */
  motionPermission: 'unknown' | 'granted' | 'denied' | 'unsupported';
  /** Must be called from inside a real user click/tap handler on iOS. */
  requestMotionPermission: () => Promise<void>;
}

/**
 * Runs the phone's DeviceMotion listener at the app root (not inside a single
 * tab's component), so a violent shake, sudden fall, or forced dragging
 * triggers the safety-check countdown — and eventually onTriggerSos — no
 * matter which tab of the app is currently open. Only one instance of this
 * hook should be mounted (in App.tsx); components like MovementDetection
 * just read/display the shared state instead of listening themselves, to
 * avoid double-triggering.
 */
export function useMotionSafetyDetection(
  settings: MovementSensorSettings,
  onTriggerSos: () => void
): MotionSafetyState {
  const [activeCountdown, setActiveCountdown] = useState<number | null>(null);
  const [activeAlarmType, setActiveAlarmType] = useState<string | null>(null);
  const [gForce, setGForce] = useState(1.0);
  const [motionPermission, setMotionPermission] = useState<
    'unknown' | 'granted' | 'denied' | 'unsupported'
  >('unknown');

  // Most browsers (Android, desktop) don't gate devicemotion behind a
  // permission prompt at all — only iOS 13+ Safari does. Detect that once
  // so the UI doesn't ask for permission it'll never need.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceMotionEvent) {
      setMotionPermission('unsupported');
      return;
    }
    if (typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
      setMotionPermission('granted');
    }
  }, []);

  const requestMotionPermission = async () => {
    if (typeof window === 'undefined' || !window.DeviceMotionEvent) {
      setMotionPermission('unsupported');
      return;
    }
    if (typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
      setMotionPermission('granted');
      return;
    }
    try {
      // Must be called synchronously from a user gesture (e.g. a button's
      // onClick) on iOS Safari, or it silently rejects.
      const result = await (DeviceMotionEvent as any).requestPermission();
      setMotionPermission(result === 'granted' ? 'granted' : 'denied');
    } catch (err) {
      console.error('DeviceMotionEvent.requestPermission failed', err);
      setMotionPermission('denied');
    }
  };

  // Guards against re-triggering a new countdown while one's already running,
  // and lets the countdown effect below always see the latest onTriggerSos
  // without needing it in its dependency array.
  const countdownActiveRef = useRef(false);
  const onTriggerSosRef = useRef(onTriggerSos);
  onTriggerSosRef.current = onTriggerSos;

  const triggerSafetyCheck = (reason: string) => {
    if (countdownActiveRef.current) return; // a check is already in progress
    countdownActiveRef.current = true;
    setActiveAlarmType(reason);
    setActiveCountdown(SAFETY_CHECK_SECONDS);
  };

  const confirmSafe = () => {
    countdownActiveRef.current = false;
    setActiveCountdown(null);
    setActiveAlarmType(null);
  };

  const dispatchNow = () => {
    countdownActiveRef.current = false;
    setActiveCountdown(null);
    onTriggerSosRef.current();
  };

  // Live DeviceMotion listener — mounted once at the app root so it keeps
  // running regardless of which tab the person is viewing.
  useEffect(() => {
    if (!settings.isEnabled) return;
    // On iOS, listening without permission granted is a silent no-op —
    // don't attach the listener until we know it'll actually receive events.
    if (motionPermission === 'denied' || motionPermission === 'unknown') return;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.8;
        setGForce(parseFloat(totalAcc.toFixed(2)));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.isEnabled, settings.fallDetection, settings.shakingDetection, motionPermission]);

  // Countdown ticker — expiry dispatches SOS automatically.
  useEffect(() => {
    if (activeCountdown === null) return;

    if (activeCountdown === 0) {
      dispatchNow();
      return;
    }

    const timer = setTimeout(() => {
      setActiveCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountdown]);

  return {
    activeCountdown,
    activeAlarmType,
    gForce,
    confirmSafe,
    triggerSafetyCheck,
    dispatchNow,
    motionPermission,
    requestMotionPermission,
  };
}