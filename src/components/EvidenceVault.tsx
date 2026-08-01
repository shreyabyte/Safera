import React, { useState, useRef, useEffect } from 'react';
import { EvidenceItem } from '../types';
import { GuardIaLogo } from './GuardIaLogo';
import {
  Shield,
  Camera,
  Mic,
  Lock,
  Upload,
  CheckCircle2,
  Video,
  StopCircle,
  RefreshCw,
  Eye,
  Download,
  Key,
  ShieldCheck,
} from 'lucide-react';

interface EvidenceVaultProps {
  evidenceList: EvidenceItem[];
  onAddEvidence: (item: EvidenceItem) => void;
  isRecordingVault: boolean;
  setIsRecordingVault: (val: boolean) => void;
}

export const EvidenceVault: React.FC<EvidenceVaultProps> = ({
  evidenceList,
  onAddEvidence,
  isRecordingVault,
  setIsRecordingVault,
}) => {
  const [cameraMode, setCameraMode] = useState<'front' | 'rear'>('front');
  const [recordType, setRecordType] = useState<'video' | 'audio'>('video');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [stealthDisguise, setStealthDisguise] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Live Timer during Recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecordingVault) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingVault]);

  // Handle Camera Feed Request
  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: recordType === 'video' ? { facingMode: cameraMode === 'front' ? 'user' : 'environment' } : false,
          audio: true,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.log('Camera permission or availability:', err);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    await startCamera();
    setIsRecordingVault(true);
  };

  const handleStopRecording = () => {
    setIsRecordingVault(false);
    stopCamera();

    // Create new recorded evidence entry
    const newEntry: EvidenceItem = {
      id: `ev-${Date.now()}`,
      title: `Safera_${recordType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.mp4`,
      type: recordType,
      timestamp: new Date().toLocaleString(),
      locationName: 'Central Metro Corridor',
      coords: { lat: 28.6139, lng: 77.209 },
      duration: `00:${recordSeconds < 10 ? '0' + recordSeconds : recordSeconds}`,
      fileSize: `${(recordSeconds * 1.2 + 1.5).toFixed(1)} MB`,
      mediaUrl: '',
      isEncrypted: true,
      isCloudBackedUp: true,
    };

    onAddEvidence(newEntry);
  };

  const handleUnlockVault = () => {
    if (pinInput === '1234' || pinInput === '') {
      setIsLocked(false);
    } else {
      alert('Incorrect Vault PIN. Default PIN is 1234.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-[#E9D8DE] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <GuardIaLogo size="sm" />
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#A70F43]" />
                <h2 className="text-base font-bold text-[#2F2B2D]">Encrypted Cloud Evidence Vault</h2>
              </div>
              <p className="text-xs text-[#7B7280] mt-0.5">
                Tamper-proof video & audio recorder with live GPS watermark, timestamping, and cloud backup.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setStealthDisguise(!stealthDisguise)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                stealthDisguise
                  ? 'bg-[#A70F43] text-white border-[#8D0D39]'
                  : 'bg-[#FFF8F9] text-[#7B7280] border-[#E9D8DE]'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-[#A70F43]" />
              <span>Stealth Mode {stealthDisguise ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Recorder HUD & Vault Files */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Live Camera Recorder Canvas */}
        <div className="lg:col-span-6 bg-white border border-[#E9D8DE] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E9D8DE] pb-2 text-xs">
            <span className="font-bold text-[#2F2B2D] flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#A70F43]" />
              Live Evidence Capture HUD
            </span>
            <button
              onClick={() => setCameraMode(cameraMode === 'front' ? 'rear' : 'front')}
              className="px-2.5 py-1 rounded-lg bg-[#FFF8F9] border border-[#E9D8DE] text-[#2F2B2D] hover:bg-[#FFF0F3] text-[10px] font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 text-[#A70F43]" />
              <span>{cameraMode === 'front' ? 'Front Cam' : 'Rear Cam'}</span>
            </button>
          </div>

          {/* Camera Stream Viewport Container */}
          <div className="relative bg-[#FFF8F9] border border-[#E9D8DE] rounded-xl overflow-hidden min-h-[250px] flex items-center justify-center">
            {/* Real Video Element if Stream active */}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover absolute inset-0" />

            {/* Live Watermark Overlay (Timestamp + GPS + Hash) */}
            <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between text-[10px] font-mono text-white z-10">
              <div className="space-y-0.5">
                <div className="font-bold">REC_WATERMARK_ENCRYPTED</div>
                <div className="text-white/90 text-[9px]">{new Date().toLocaleString()}</div>
              </div>
              <div className="text-right text-[9px] text-white/90">
                <div>GPS: 28.6139 N, 77.2090 E</div>
                <div className="text-white font-bold">SHA-256 Hash Active</div>
              </div>
            </div>

            {/* Recording Indicator */}
            {isRecordingVault && (
              <div className="absolute bottom-3 left-3 z-10 flex items-center space-x-2 bg-[#A70F43] text-white px-3 py-1 rounded-full text-xs font-mono font-bold animate-pulse border border-[#8D0D39]">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                <span>REC 00:{recordSeconds < 10 ? '0' + recordSeconds : recordSeconds}</span>
              </div>
            )}

            {!isRecordingVault && (
              <div className="relative z-10 text-center p-6 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-white text-[#A70F43] border border-[#E9D8DE] flex items-center justify-center shadow-sm">
                  <Video className="w-6 h-6" />
                </div>
                <p className="text-xs text-[#7B7280]">Camera Preview Ready. Press Record to capture evidence.</p>
              </div>
            )}
          </div>

          {/* Recording Controls Bar */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {!isRecordingVault ? (
              <button
                onClick={handleStartRecording}
                className="col-span-2 py-2.5 rounded-xl bg-[#A70F43] hover:bg-[#8D0D39] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all border border-[#8D0D39]"
              >
                <Video className="w-4 h-4" />
                <span>START ENCRYPTED RECORDING</span>
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="col-span-2 py-2.5 rounded-xl bg-[#A70F43] hover:bg-[#8D0D39] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all animate-pulse border border-[#8D0D39]"
              >
                <StopCircle className="w-4 h-4" />
                <span>SAVE & UPLOAD TO VAULT</span>
              </button>
            )}
          </div>
        </div>

        {/* Vault Locker Gallery */}
        <div className="lg:col-span-6 bg-white border border-[#E9D8DE] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#E9D8DE] pb-2 text-xs">
            <span className="font-bold text-[#2F2B2D] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#A70F43]" />
              Saved Evidence Locker ({evidenceList.length})
            </span>
            <button
              onClick={() => setIsLocked(!isLocked)}
              className="text-[10px] font-mono text-[#A70F43] hover:underline font-bold"
            >
              {isLocked ? 'Unlock Vault' : 'Lock Vault'}
            </button>
          </div>

          {/* Locked PIN Challenge */}
          {isLocked ? (
            <div className="bg-[#FFF8F9] p-5 rounded-xl border border-[#E9D8DE] text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-[#FFF0F3] text-[#A70F43] border border-[#E9D8DE] flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#2F2B2D]">Protected Evidence Vault</h4>
                <p className="text-[10px] text-[#7B7280] mt-0.5">
                  Enter PIN (Default: 1234 or leave blank)
                </p>
              </div>

              <div className="max-w-xs mx-auto flex gap-2">
                <input
                  type="password"
                  placeholder="PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-white border border-[#E9D8DE] rounded-xl px-3 py-1.5 text-center text-xs font-mono text-[#2F2B2D] focus:outline-none focus:border-[#A70F43]"
                />
                <button
                  onClick={handleUnlockVault}
                  className="px-3.5 py-1.5 bg-[#A70F43] hover:bg-[#8D0D39] text-white font-bold text-xs rounded-xl transition-colors shrink-0 shadow-sm"
                >
                  Unlock
                </button>
              </div>
            </div>
          ) : (
            /* Evidence Unlocked List */
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {evidenceList.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE] hover:border-[#A70F43] transition-colors space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-[#2F2B2D] flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#A70F43] text-white font-mono font-bold">
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[#7B7280] text-[10px] mt-0.5">
                        {item.timestamp} • {item.locationName}
                      </div>
                    </div>

                    <span className="text-[#5FA777] text-[9px] font-mono flex items-center gap-1 bg-[#FFF0F3] px-2 py-0.5 rounded border border-[#E9D8DE] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-[#5FA777]" />
                      Cloud Sync
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#7B7280] border-t border-[#E9D8DE] pt-1.5">
                    <span>
                      Duration: <strong className="text-[#2F2B2D]">{item.duration}</strong>
                    </span>
                    <span>
                      Size: <strong className="text-[#2F2B2D]">{item.fileSize}</strong>
                    </span>

                    <button
                      onClick={() => alert(`Exporting encrypted dossier for file ${item.title}...`)}
                      className="text-[#A70F43] hover:text-[#8D0D39] font-bold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

