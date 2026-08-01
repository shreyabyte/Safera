import React, { useState, useEffect } from 'react';
import { EmergencyContact } from '../types';
import { GuardIaLogo } from './GuardIaLogo';
import {
  AlertTriangle,
  Phone,
  Send,
  Mic,
  ShieldAlert,
  CheckCircle2,
  UserPlus,
  Trash2,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react';

interface SosDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: EmergencyContact[];
  onAddContact: (contact: EmergencyContact) => void;
  onDeleteContact: (id: string) => void;
}

export const SosDialog: React.FC<SosDialogProps> = ({
  isOpen,
  onClose,
  contacts,
  onAddContact,
  onDeleteContact,
}) => {
  const [dispatchStage, setDispatchStage] = useState<'idle' | 'countdown' | 'dispatched'>('idle');
  const [cancelSeconds, setCancelSeconds] = useState(5);
  const [powerButtonClicks, setPowerButtonClicks] = useState(0);

  // Contact form state
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Family');

  // Power Button 4-Click Simulation Timer
  useEffect(() => {
    if (powerButtonClicks > 0) {
      const timer = setTimeout(() => setPowerButtonClicks(0), 2000);
      return () => clearTimeout(timer);
    }
  }, [powerButtonClicks]);

  const handleSimulatePowerClick = () => {
    const nextCount = powerButtonClicks + 1;
    setPowerButtonClicks(nextCount);
    if (nextCount >= 4) {
      setPowerButtonClicks(0);
      triggerSosDispatch();
    }
  };

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (dispatchStage === 'countdown' && cancelSeconds > 0) {
      timer = setTimeout(() => setCancelSeconds(cancelSeconds - 1), 1000);
    } else if (dispatchStage === 'countdown' && cancelSeconds === 0) {
      setDispatchStage('dispatched');
    }
    return () => clearTimeout(timer);
  }, [dispatchStage, cancelSeconds]);

  const triggerSosDispatch = () => {
    setCancelSeconds(5);
    setDispatchStage('countdown');
  };

  const handleCancelSos = () => {
    setDispatchStage('idle');
    setCancelSeconds(5);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9D8DE] rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl relative space-y-5 my-auto text-[#2F2B2D]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E9D8DE] pb-3">
          <div className="flex items-center space-x-3">
            <GuardIaLogo size="md" />
            <div>
              <h2 className="text-lg font-extrabold text-[#2F2B2D]">SOS Emergency Dispatch Hub</h2>
              <p className="text-xs text-[#7B7280]">
                Live location broadcast, emergency contacts SMS & police hotline dispatch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FFF8F9] hover:bg-[#FFF0F3] border border-[#E9D8DE] flex items-center justify-center text-[#7B7280] hover:text-[#2F2B2D] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dispatch Screen Stages */}
        {dispatchStage === 'countdown' && (
          <div className="bg-[#FFF0F3] border-2 border-[#A70F43] rounded-2xl p-5 text-center space-y-3 animate-pulse">
            <h3 className="text-sm font-bold text-[#A70F43]">DISPATCHING EMERGENCY SOS ALERT IN:</h3>
            <div className="text-5xl font-mono font-black text-[#2F2B2D]">{cancelSeconds}</div>
            <p className="text-xs text-[#7B7280]">
              Broadcasting Live GPS (28.6139, 77.2090) to {contacts.length} Emergency Contacts & Police Dispatch (112)
            </p>
            <button
              onClick={handleCancelSos}
              className="px-5 py-2 rounded-xl bg-[#A70F43] hover:bg-[#8D0D39] text-white font-extrabold text-xs shadow-sm"
            >
              CANCEL EMERGENCY ALARM
            </button>
          </div>
        )}

        {dispatchStage === 'dispatched' && (
          <div className="bg-[#FFF8F9] border-2 border-[#A70F43] rounded-2xl p-5 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#A70F43] text-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-base font-extrabold text-[#2F2B2D]">SOS DISPATCH BROADCAST SENT</h3>
            <div className="bg-white p-3 rounded-xl text-left text-xs font-mono text-[#2F2B2D] space-y-1 border border-[#E9D8DE]">
              <div>• Live Tracking URL: https://safera.app/track/sos-9821</div>
              <div>• SMS Sent to: {contacts.map((c) => c.name).join(', ')}</div>
              <div>• Police Dispatch Alert: Local Police Dispatch 112</div>
              <div>• Evidence Vault: Timestamped Recording Saved</div>
            </div>
            <button
              onClick={() => setDispatchStage('idle')}
              className="px-4 py-1.5 rounded-xl bg-[#FFF8F9] text-[#2F2B2D] font-bold text-xs border border-[#E9D8DE]"
            >
              Reset SOS Status
            </button>
          </div>
        )}

        {/* Primary 1-Press SOS Action */}
        <div className="text-center py-1 space-y-2">
          <button
            onClick={triggerSosDispatch}
            className="w-full py-4 rounded-2xl bg-[#A70F43] hover:bg-[#8D0D39] text-white font-black text-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-2.5 border border-[#8D0D39]"
          >
            <AlertTriangle className="w-7 h-7 fill-white text-[#A70F43] animate-pulse" />
            <span>PRESS TO DISPATCH INSTANT SOS</span>
          </button>
          <span className="text-[10px] text-[#7B7280] block">
            Sends location URL + SMS alert to pre-saved contacts instantly
          </span>
        </div>

        {/* Advanced Multi-Triggers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* 4x Power Button Simulator */}
          <button
            onClick={handleSimulatePowerClick}
            className="p-3 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#A70F43]" />
                4x Power Button
              </span>
              <span className="font-mono text-[#A70F43] font-bold">{powerButtonClicks}/4</span>
            </div>
            <p className="text-[10px] text-[#7B7280]">Press 4 times in quick succession for silent SOS.</p>
          </button>

          {/* Voice Command Listener */}
          <button
            onClick={triggerSosDispatch}
            className="p-3 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#A70F43]" />
                Voice Command
              </span>
              <span className="text-[9px] text-white uppercase font-bold bg-[#A70F43] px-1.5 rounded">"Help"</span>
            </div>
            <p className="text-[10px] text-[#7B7280]">Triggers when voice keyword "Help Safera" is spoken.</p>
          </button>

          {/* Gesture Trigger Simulator */}
          <button
            onClick={triggerSosDispatch}
            className="p-3 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE] hover:border-[#A70F43] text-left space-y-1 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#2F2B2D] flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#A70F43]" />
                Shake Gesture
              </span>
              <span className="text-[9px] text-[#7B7280] font-mono">Simulate</span>
            </div>
            <p className="text-[10px] text-[#7B7280]">Double sharp shake or 3 screen taps triggers SOS.</p>
          </button>
        </div>

        {/* Emergency Contacts Manager Section */}
        <div className="border-t border-[#E9D8DE] pt-4 space-y-3">
          <h3 className="text-xs font-bold text-[#2F2B2D] flex items-center justify-between">
            <span>Pre-Saved Emergency Contacts ({contacts.length})</span>
            <span className="text-[10px] text-[#7B7280] font-normal">Auto SMS & Live Link Enabled</span>
          </h3>

          <div className="space-y-1.5">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF8F9] border border-[#E9D8DE] text-xs"
              >
                <div>
                  <div className="font-bold text-[#2F2B2D] flex items-center gap-2">
                    <span>{contact.name}</span>
                    {contact.isPrimary && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#A70F43] text-white font-bold">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <div className="text-[#7B7280] font-mono text-[10px] mt-0.5">{contact.phone} • {contact.relation}</div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[9px] text-[#A70F43] bg-[#FFF0F3] px-2 py-0.5 rounded border border-[#E9D8DE] font-semibold">
                    SMS Ready
                  </span>
                  {!contact.isPrimary && (
                    <button
                      onClick={() => onDeleteContact(contact.id)}
                      className="p-1 text-[#7B7280] hover:text-[#A70F43] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Contact Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <input
              type="text"
              placeholder="Contact Name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="bg-[#FFF8F9] border border-[#E9D8DE] rounded-xl px-3 py-1.5 text-[#2F2B2D] focus:outline-none focus:border-[#A70F43]"
            />
            <input
              type="text"
              placeholder="Phone (+1 555...)"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              className="bg-[#FFF8F9] border border-[#E9D8DE] rounded-xl px-3 py-1.5 text-[#2F2B2D] focus:outline-none focus:border-[#A70F43]"
            />
            <button
              onClick={() => {
                if (newContactName && newContactPhone) {
                  onAddContact({
                    id: `c-${Date.now()}`,
                    name: newContactName,
                    relation: newContactRelation,
                    phone: newContactPhone,
                    isPrimary: false,
                    sendSms: true,
                  });
                  setNewContactName('');
                  setNewContactPhone('');
                }
              }}
              className="bg-[#A70F43] hover:bg-[#8D0D39] text-white font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-colors border border-[#8D0D39]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

