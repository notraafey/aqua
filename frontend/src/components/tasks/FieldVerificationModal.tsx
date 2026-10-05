import React, { useState } from 'react';
import {
  Task,
  VerificationStatusType,
  StructuredFieldObservations,
  PhotoEvidence,
} from '@aquasentinel/shared';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { apiClient } from '../../api/client.js';
import {
  Camera,
  MapPin,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Info,
  X,
  FileCheck,
  Compass,
} from 'lucide-react';

interface FieldVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onVerificationSubmitted: () => void;
}

const SAMPLE_PHOTOS = [
  {
    name: 'Algal Bloom (Green Foam)',
    filename: 'field_algal_foam_01.jpg',
    description: 'Thick green scummy foam visible across 35% of reach surface',
    statusMatch: 'CONFIRMED' as VerificationStatusType,
    previewUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="%23064e3b"/><circle cx="40" cy="45" r="25" fill="%2310b981"/><circle cx="75" cy="50" r="30" fill="%23047857"/><text x="10" y="80" fill="%23ecfdf5" font-size="10" font-family="sans-serif">Green Foam</text></svg>',
  },
  {
    name: 'Clear Water (False Alarm)',
    filename: 'field_clear_reach_02.jpg',
    description: 'Water surface transparent with normal bed visibility; no biogenic scum',
    statusMatch: 'NOT_CONFIRMED' as VerificationStatusType,
    previewUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="%230c4a6e"/><circle cx="60" cy="45" r="35" fill="%2338bdf8"/><text x="10" y="80" fill="%23f0f9ff" font-size="10" font-family="sans-serif">Clear Water</text></svg>',
  },
  {
    name: 'Sediment Turbidity (Uncertain)',
    filename: 'field_sediment_runoff_03.jpg',
    description: 'Suspended inorganic silt following stormwater runoff; ambiguous optical signature',
    statusMatch: 'UNCERTAIN' as VerificationStatusType,
    previewUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="%2378350f"/><circle cx="60" cy="45" r="30" fill="%23d97706"/><text x="10" y="80" fill="%23fffbeb" font-size="10" font-family="sans-serif">Turbid Silt</text></svg>',
  },
];

export const FieldVerificationModal: React.FC<FieldVerificationModalProps> = ({
  isOpen,
  onClose,
  task,
  onVerificationSubmitted,
}) => {
  const [inspectorName, setInspectorName] = useState(task.assignedTo || 'Alex Rivera');
  const [status, setStatus] = useState<VerificationStatusType>('CONFIRMED');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Structured observations
  const [waterColour, setWaterColour] = useState('DENSE_GREEN');
  const [surfaceAppearance, setSurfaceAppearance] = useState('FOAM');
  const [odour, setOdour] = useState('FISHY');
  const [foam, setFoam] = useState(true);
  const [visibleAlgae, setVisibleAlgae] = useState(true);
  const [deadFish, setDeadFish] = useState<number>(3);
  const [flowConditions, setFlowConditions] = useState('STAGNANT');
  const [weatherConditions, setWeatherConditions] = useState('SUNNY');

  // Location / coordinates
  const targetCoords = task.location?.coordinates || [22.94, 39.37];
  const [currentCoords, setCurrentCoords] = useState<[number, number]>([targetCoords[0], targetCoords[1]]);
  const [accuracyMeters, setAccuracyMeters] = useState(8);

  // Photo Evidence
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

  if (!isOpen) return null;

  const handleStatusChange = (newStatus: VerificationStatusType) => {
    setStatus(newStatus);
    if (newStatus === 'CONFIRMED') {
      setWaterColour('DENSE_GREEN');
      setSurfaceAppearance('FOAM');
      setOdour('FISHY');
      setFoam(true);
      setVisibleAlgae(true);
      setDeadFish(3);
      setNotes('Dense biogenic scum and green surface foam confirmed. Strong odor and dead fish observed.');
      setSelectedPhotoIndex(0);
    } else if (newStatus === 'NOT_CONFIRMED') {
      setWaterColour('CLEAR');
      setSurfaceAppearance('NORMAL');
      setOdour('NONE');
      setFoam(false);
      setVisibleAlgae(false);
      setDeadFish(0);
      setNotes('Inspection confirms clear water conditions. No algal scum or visible contamination detected on site.');
      setSelectedPhotoIndex(1);
    } else {
      setWaterColour('SLIGHTLY_TURBID');
      setSurfaceAppearance('CLOUDY');
      setOdour('EARTHY');
      setFoam(false);
      setVisibleAlgae(false);
      setDeadFish(0);
      setNotes('Ambiguous optical runoff. High sediment turbidity without obvious algal mats. Secondary laboratory sampling requested.');
      setSelectedPhotoIndex(2);
    }
  };

  const handleUseDeviceGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords([pos.coords.longitude, pos.coords.latitude]);
          setAccuracyMeters(Math.round(pos.coords.accuracy));
        },
        () => {
          // Fallback to task coordinates with slight jitter
          setCurrentCoords([targetCoords[0] + 0.0001, targetCoords[1] + 0.0001]);
          setAccuracyMeters(10);
        }
      );
    } else {
      setCurrentCoords([targetCoords[0], targetCoords[1]]);
      setAccuracyMeters(10);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const activePhoto = SAMPLE_PHOTOS[selectedPhotoIndex];
      const photoEvidence: PhotoEvidence[] = [
        {
          evidenceId: `photo-${Date.now()}`,
          verificationId: '',
          timestamp: new Date().toISOString(),
          filename: activePhoto.filename,
          mediaType: 'image/jpeg',
          description: activePhoto.description,
          source: 'field_camera',
        },
      ];

      const observations: StructuredFieldObservations = {
        waterColour,
        surfaceAppearance,
        odour,
        foam,
        visibleAlgae,
        deadFish: Number(deadFish),
        flowConditions,
        weatherConditions,
      };

      // 1. Create verification draft
      await apiClient.createVerification({
        taskId: task.id,
        incidentId: task.incidentId,
        inspector: {
          name: inspectorName,
          role: 'FIELD_INSPECTOR',
          organization: 'Volos Municipal Environmental Dept',
        },
        location: {
          type: 'Point',
          coordinates: currentCoords,
          accuracyMeters,
          validationStatus: 'AT_LOCATION',
          isWithinGeofence: true,
        },
        observations,
        notes,
        photos: photoEvidence,
        clientSubmissionId: `field-app-${Date.now()}`,
        actor: inspectorName,
      });

      onVerificationSubmitted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit field verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-2xs">
              <Camera size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Field Verification & Ground Truth</h3>
                <Badge variant="cyan" size="sm">Task #{task.id.slice(0, 8)}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Record in-situ field telemetry, photo evidence, and corroboration verdict.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-800">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Task Instructions Banner */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-slate-700">Target Objective</span>
              <Badge variant="amber" size="sm">{task.priority} Priority</Badge>
            </div>
            <p className="text-slate-900 text-xs font-bold">{task.title}</p>
            <p className="text-slate-600 text-xs leading-relaxed">{task.instructions}</p>
          </div>

          {/* Inspector & Geolocation Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Field Inspector
              </label>
              <select
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="Alex Rivera">Alex Rivera (Volos Environmental Dept)</option>
                <option value="Elena Vasquez">Elena Vasquez (Thessaly Water Agency)</option>
                <option value="Nikos Katsaros">Nikos Katsaros (Pagasetic Coastal Patrol)</option>
                <option value="Maria Dimitriou">Maria Dimitriou (Volos Civil Protection)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  GPS Coordinates & Geofence
                </label>
                <button
                  type="button"
                  onClick={handleUseDeviceGps}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-mono font-medium"
                >
                  <Compass size={12} /> Acquire GPS
                </button>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                <MapPin size={14} className="text-emerald-600 shrink-0" />
                <span className="font-mono text-slate-700 text-[11px] truncate">
                  {currentCoords[1].toFixed(5)}°N, {currentCoords[0].toFixed(5)}°E
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold ml-auto px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-200">
                  AT_LOCATION (±{accuracyMeters}m)
                </span>
              </div>
            </div>
          </div>

          {/* Ground Truth Verdict Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Ground Truth Verdict
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleStatusChange('CONFIRMED')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  status === 'CONFIRMED'
                    ? 'bg-emerald-50/70 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold">CONFIRMED</span>
                  <CheckCircle2 size={16} className={status === 'CONFIRMED' ? 'text-emerald-600' : 'text-slate-400'} />
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Corroborates alert with tangible evidence</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('NOT_CONFIRMED')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  status === 'NOT_CONFIRMED'
                    ? 'bg-sky-50/70 border-sky-400 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold">NOT CONFIRMED</span>
                  <XCircle size={16} className={status === 'NOT_CONFIRMED' ? 'text-sky-600' : 'text-slate-400'} />
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Refutes alert; clean water conditions</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('UNCERTAIN')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  status === 'UNCERTAIN'
                    ? 'bg-amber-50/70 border-amber-400 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold">UNCERTAIN</span>
                  <HelpCircle size={16} className={status === 'UNCERTAIN' ? 'text-amber-600' : 'text-slate-400'} />
                </div>
                <span className="text-[11px] opacity-80 leading-tight">Ambiguous; requires lab follow-up</span>
              </button>
            </div>
          </div>

          {/* Structured Telemetry Grid */}
          <div className="space-y-3">
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Structured Field Telemetry
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Water Color</label>
                <select
                  value={waterColour}
                  onChange={(e) => setWaterColour(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="DENSE_GREEN">Dense Green</option>
                  <option value="CLEAR">Clear</option>
                  <option value="SLIGHTLY_TURBID">Slightly Turbid</option>
                  <option value="MILKY_WHITE">Milky White</option>
                  <option value="DARK_BROWN">Dark Brown</option>
                  <option value="REDDISH">Reddish Brown</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Appearance</label>
                <select
                  value={surfaceAppearance}
                  onChange={(e) => setSurfaceAppearance(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="FOAM">Surface Foam</option>
                  <option value="NORMAL">Normal / Clean</option>
                  <option value="SCUM">Algal Scum</option>
                  <option value="SHEEN">Oily Sheen</option>
                  <option value="CLOUDY">Cloudy Silt</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Odour</label>
                <select
                  value={odour}
                  onChange={(e) => setOdour(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="FISHY">Fishy / Septic</option>
                  <option value="NONE">None / Natural</option>
                  <option value="SEWAGE">Sewage</option>
                  <option value="EARTHY">Earthy / Geosmin</option>
                  <option value="CHEMICAL">Chemical / Solvent</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dead Fish Count</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={deadFish}
                  onChange={(e) => setDeadFish(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="col-span-2 flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={foam}
                    onChange={(e) => setFoam(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span>Surface Foam Present</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={visibleAlgae}
                    onChange={(e) => setVisibleAlgae(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span>Visible Algal Mats</span>
                </label>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Flow Conditions</label>
                  <select
                    value={flowConditions}
                    onChange={(e) => setFlowConditions(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="STAGNANT">Stagnant</option>
                    <option value="SLOW">Slow</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="FAST">Fast / High Flow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weather Conditions</label>
                  <select
                    value={weatherConditions}
                    onChange={(e) => setWeatherConditions(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="SUNNY">Sunny / High Solar</option>
                    <option value="OVERCAST">Overcast</option>
                    <option value="RAIN">Rain / Storm</option>
                    <option value="RECENT_STORM">Recent Storm Runoff</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Evidence Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Photo Evidence Attachment
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SAMPLE_PHOTOS.map((sample, idx) => (
                <div
                  key={sample.filename}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center sm:flex-col gap-2.5 ${
                    selectedPhotoIndex === idx
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={sample.previewUrl}
                    alt={sample.name}
                    className="w-16 h-12 sm:w-full sm:h-20 object-cover rounded-lg border border-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{sample.name}</p>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{sample.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Field Observations & Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any sensory notes, odor descriptions, bank runoff signs..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>Submission triggers immediate Bayesian reassessment and FHIR outbox event.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-1.5">Submitting...</span>
                </>
              ) : (
                <>
                  <FileCheck size={14} className="mr-1.5" />
                  Submit Verification
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
