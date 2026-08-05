import { useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import api from '../utils/api';

export default function DataBackupPanel() {
  const {
    trips, travelers, journeys,
    loadTrips, loadTravelers, loadJourneys, loadAnalytics,
  } = useData();
  const fileRef = useRef(null);
  const [backup, setBackup] = useState(null);
  const [importError, setImportError] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  function makeBackup() {
    return {
      format: 'travel-journal-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      note: 'This JSON backup contains memory, journey, traveler, and photo metadata. Original photo files are not embedded.',
      travelers: travelers.map(person => ({
        id: person.id,
        name: person.name,
        relationship: person.relationship,
        is_active: person.is_active,
      })),
      journeys: journeys.map(journey => ({
        id: journey.id,
        title: journey.title,
        start_date: journey.start_date,
        end_date: journey.end_date,
        date_label: journey.date_label,
        journey_type: journey.journey_type,
        summary: journey.summary,
        cover_photo_id: journey.cover_photo_id,
        memoryIds: (journey.memories || []).map(memory => memory.id),
      })),
      trips: trips.map(trip => ({
        id: trip.id,
        location_name: trip.location_name,
        place_name: trip.place_name,
        formatted_address: trip.formatted_address,
        city: trip.city,
        latitude: trip.latitude,
        longitude: trip.longitude,
        country: trip.country,
        state: trip.state,
        start_date: trip.start_date,
        end_date: trip.end_date,
        date_label: trip.date_label,
        date_precision: trip.date_precision,
        trip_type: trip.trip_type,
        notes: trip.notes,
        journey_id: trip.journey_id,
        journey_order: trip.journey_order,
        travelerNames: (trip.travelers || []).map(person => person.name),
        photos: (trip.photos || []).map(photo => ({
          filename: photo.filename,
          caption: photo.caption,
          date_taken: photo.date_taken,
          latitude: photo.latitude,
          longitude: photo.longitude,
          is_cover: photo.is_cover,
          rotation: photo.rotation,
        })),
      })),
    };
  }

  function exportBackup() {
    const payload = makeBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postcards-of-us-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Backup downloaded. Keep it somewhere separate from the server.');
  }

  async function readImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError('');
    setMessage('');
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.format !== 'travel-journal-backup' || parsed.version !== 1) throw new Error('That file is not a supported Postcards of Us backup.');
      if (!Array.isArray(parsed.travelers) || !Array.isArray(parsed.journeys) || !Array.isArray(parsed.trips)) throw new Error('The backup is missing one or more data sections.');
      setBackup(parsed);
    } catch (error) {
      setBackup(null);
      setImportError(error.message || 'That backup could not be read.');
    } finally {
      event.target.value = '';
    }
  }

  async function importBackup() {
    if (!backup) return;
    if (!window.confirm(`Import ${backup.trips.length} memories and ${backup.journeys.length} journeys as new records? Existing data will not be overwritten. Photo files must be uploaded again.`)) return;

    setWorking(true);
    setImportError('');
    setMessage('');
    try {
      const travelerByName = new Map(travelers.map(person => [normalize(person.name), person.id]));
      const travelerIds = new Map();
      for (const person of backup.travelers) {
        const key = normalize(person.name);
        if (travelerByName.has(key)) {
          travelerIds.set(person.id, travelerByName.get(key));
        } else {
          const created = await api.createTraveler({ name: person.name, relationship: person.relationship || 'other' });
          travelerIds.set(person.id, created.id);
          travelerByName.set(key, created.id);
        }
      }

      const journeyIds = new Map();
      for (const journey of backup.journeys) {
        const created = await api.createJourney({
          title: journey.title,
          startDate: journey.start_date?.slice(0, 10) || '',
          endDate: journey.end_date?.slice(0, 10) || '',
          dateLabel: journey.date_label || '',
          journeyType: journey.journey_type || 'Other',
          summary: journey.summary || '',
          memoryIds: [],
        });
        journeyIds.set(journey.id, created.id);
      }

      const tripIds = new Map();
      for (const trip of backup.trips) {
        const created = await api.createTrip({
          locationName: trip.location_name,
          placeName: trip.place_name || '',
          formattedAddress: trip.formatted_address || '',
          city: trip.city || '',
          latitude: trip.latitude,
          longitude: trip.longitude,
          country: trip.country || '',
          state: trip.state || '',
          startDate: trip.start_date?.slice(0, 10) || '',
          endDate: trip.end_date?.slice(0, 10) || '',
          dateLabel: trip.date_label || '',
          datePrecision: trip.date_precision || 'exact',
          tripType: trip.trip_type || 'Other',
          notes: trip.notes || '',
          travelerIds: (trip.travelerNames || []).map(name => travelerIds.get(backup.travelers.find(person => normalize(person.name) === normalize(name))?.id)).filter(Boolean),
        });
        tripIds.set(trip.id, created.id);
      }

      for (const journey of backup.journeys) {
        const newId = journeyIds.get(journey.id);
        const memoryIds = (journey.memoryIds || []).map(id => tripIds.get(id)).filter(Boolean);
        await api.updateJourney(newId, {
          title: journey.title,
          startDate: journey.start_date?.slice(0, 10) || '',
          endDate: journey.end_date?.slice(0, 10) || '',
          dateLabel: journey.date_label || '',
          journeyType: journey.journey_type || 'Other',
          summary: journey.summary || '',
          memoryIds,
          coverPhotoId: null,
        });
      }

      await Promise.all([
        loadTrips(),
        loadTravelers({ includeInactive: true }),
        loadJourneys(),
        loadAnalytics(),
      ]);
      setBackup(null);
      setMessage(`Imported ${backup.trips.length} memories and ${backup.journeys.length} journeys. Re-upload photo files from the backup’s metadata list.`);
    } catch (error) {
      setImportError(error.message || 'The backup could not be imported. Some records may have been created; review the collection before retrying.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="settings-card settings-backup-card rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="memory-eyebrow">Safety net</p>
          <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Export or import family data</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Export a portable JSON copy of memories, people, journeys, and photo metadata. Import adds new records and never overwrites existing ones; original photo files are not embedded.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={exportBackup} className="rounded-lg bg-ocean-blue px-4 py-2 text-sm font-semibold text-white">Download backup</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Choose backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={readImport} className="hidden" />
        </div>
      </div>
      {backup && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Ready to import</p><p className="mt-1">{backup.trips.length} memories · {backup.travelers.length} people · {backup.journeys.length} journeys</p><button type="button" onClick={importBackup} disabled={working} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{working ? 'Importing…' : 'Import as new records'}</button></div>}
      {(message || importError) && <p className={`mt-3 text-sm ${importError ? 'text-red-600' : 'text-green-700'}`} role="status">{importError || message}</p>}
    </section>
  );
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}
