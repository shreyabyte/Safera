import React, { useEffect, useRef, useState } from 'react';
import { EvidenceItem } from '../types';
import { getBestEffortLocation, SosCoords } from '../utils/sos';
import { reverseGeocode } from '../lib/geocode';
import { getOrCreateVaultKey, encryptBlob } from '../lib/evidenceCrypto';

const MAX_RECORDING_MS = 15 * 60 * 1000; // safety cap so a stuck SOS session doesn't record forever

export interface EvidenceRecorderState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isRecording: boolean;
  isSaving: boolean;
  recordSeconds: number;
  cameraMode: 'front' | 'rear';
  setCameraMode: (mode: 'front' | 'rear') => void;
  recordType: 'video' | 'audio';
  setRecordType: (type: 'video' | 'audio') => void;
  recordingCoords: SosCoords | null;
  recordingLocationName: string | null;
  /** Starts capture immediately. Safe to call from any tab (SOS dialog, vault UI, sensors, etc). */
  startRecording: () => Promise<void>;
  /** Stops capture, encrypts the result, uploads it, and saves it to the vault. */
  stopRecording: () => Promise<void>;
}

/**
 * Runs the camera/mic capture + encryption + upload pipeline at the app
 * root (mounted once in App.tsx), not inside EvidenceVault.tsx — so an
 * SOS trigger can start recording no matter which tab is currently open.
 * EvidenceVault.tsx just displays/controls this shared state instead of
 * owning its own separate MediaRecorder instance.
 */
export function useEvidenceRecorder(onSaved: (item: EvidenceItem) => void): EvidenceRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [cameraMode, setCameraMode] = useState<'front' | 'rear'>('front');
  const [recordType, setRecordType] = useState<'video' | 'audio'>('video');
  const [recordingCoords, setRecordingCoords] = useState<SosCoords | null>(null);
  const [recordingLocationName, setRecordingLocationName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  // Live timer while recording
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => setRecordSeconds((prev) => prev + 1), 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isRecording) return; // already recording — SOS + manual button both call this safely

    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: recordType === 'video' ? { facingMode: cameraMode === 'front' ? 'user' : 'environment' } : false,
          audio: true,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.log('Camera permission or availability:', err);
    }

    setRecordingCoords(null);
    setRecordingLocationName(null);
    getBestEffortLocation().then(async (fix) => {
      setRecordingCoords(fix);
      if (fix) {
        const name = await reverseGeocode(fix.lat, fix.lng);
        setRecordingLocationName(name);
      }
    });

    recordedChunksRef.current = [];
    if (stream && 'MediaRecorder' in window) {
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.log('MediaRecorder unavailable, falling back to metadata-only capture:', err);
        mediaRecorderRef.current = null;
      }
    }

    setIsRecording(true);

    // Safety cap — an SOS session that's never manually stopped still
    // finalizes and uploads instead of recording indefinitely.
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    maxDurationTimeoutRef.current = setTimeout(() => {
      void stopRecordingRef.current();
    }, MAX_RECORDING_MS);
  };

  const stopRecording = async () => {
    if (!isRecording && !mediaRecorderRef.current) return;

    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }

    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    const coordsAtStop = recordingCoords;
    const locationNameAtStop = recordingLocationName;
    const secondsAtStop = recordSeconds;
    const typeAtStop = recordType;

    const finalize = async (blob: Blob) => {
      setIsSaving(true);

      // Local playback/export URL — this is the user's own device, so
      // keeping a local plaintext blob for "Export" to keep working is
      // fine. What leaves the device (the upload below) is encrypted.
      const localUrl = blob.size > 0 ? URL.createObjectURL(blob) : '';

      let isCloudBackedUp = false;
      let isEncrypted = false;

      if (blob.size > 0) {
        try {
          const vaultKey = await getOrCreateVaultKey();
          const encrypted = await encryptBlob(vaultKey, blob);
          isEncrypted = true;

          const res = await fetch('/api/evidence/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: `Safera_${typeAtStop.toUpperCase()}_${new Date().toISOString().slice(0, 10)}_${Date.now()}.webm`,
              mimeType: recorder?.mimeType || 'video/webm',
              encryptedBase64: encrypted.ciphertextBase64,
              ivBase64: encrypted.ivBase64,
              sha256Hash: encrypted.sha256Hash,
              capturedAt: new Date().toISOString(),
              lat: coordsAtStop?.lat ?? null,
              lng: coordsAtStop?.lng ?? null,
            }),
          });
          isCloudBackedUp = res.ok;
          if (!res.ok) {
            console.warn('Evidence upload failed with status', res.status);
          }
        } catch (err) {
          console.warn('Evidence encryption/upload failed, evidence stays local-only:', err);
        }
      }

      const newEntry: EvidenceItem = {
        id: `ev-${Date.now()}`,
        title: `Safera_${typeAtStop.toUpperCase()}_${new Date().toISOString().slice(0, 10)}_${Date.now()}.webm`,
        type: typeAtStop,
        timestamp: new Date().toLocaleString(),
        locationName:
          locationNameAtStop || (coordsAtStop ? `${coordsAtStop.lat.toFixed(4)}, ${coordsAtStop.lng.toFixed(4)}` : 'Location unavailable'),
        coords: coordsAtStop ? { lat: coordsAtStop.lat, lng: coordsAtStop.lng } : { lat: 0, lng: 0 },
        duration: `00:${secondsAtStop < 10 ? '0' + secondsAtStop : secondsAtStop}`,
        fileSize: blob.size > 0 ? `${(blob.size / (1024 * 1024)).toFixed(1)} MB` : `${(secondsAtStop * 1.2 + 1.5).toFixed(1)} MB (estimated)`,
        mediaUrl: localUrl,
        isEncrypted,
        isCloudBackedUp,
      };

      onSaved(newEntry);
      stopCamera();
      setIsSaving(false);
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        void finalize(blob);
        mediaRecorderRef.current = null;
      };
      recorder.stop();
    } else {
      // No MediaRecorder support (or camera permission was denied) — still
      // save a metadata-only entry rather than silently dropping the report.
      await finalize(new Blob());
    }
  };

  // Lets startRecording's setTimeout always call the *latest* stopRecording
  // (which closes over current state) without needing it in a dependency array.
  stopRecordingRef.current = stopRecording;

  return {
    videoRef,
    isRecording,
    isSaving,
    recordSeconds,
    cameraMode,
    setCameraMode,
    recordType,
    setRecordType,
    recordingCoords,
    recordingLocationName,
    startRecording,
    stopRecording,
  };
}
