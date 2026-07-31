import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import TripForm from '../components/TripForm';
import { formatDateOnly } from '../utils/format';
import { getPhotoImageStyle } from '../utils/photos';

export default function TimelinePage({ setPage }) {
  const { trips } = useData();
  const [editingTrip, setEditingTrip] = useState(null);
  const today = new Date();
  const onThisDay = useMemo(() => trips.filter(memory => {
    if (!memory.start_date) return false;
    const date = new Date(memory.start_date);
    return date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }), [trips, today.getMonth(), today.getDate()]);
  const timeline = useMemo(() => [...trips].sort((a, b) => {
    const aTime = a.start_date ? Date.parse(a.start_date) : Number.MAX_SAFE_INTEGER;
    const bTime = b.start_date ? Date.parse(b.start_date) : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.id - b.id;
  }), [trips]);

  return (
    <div className="space-y-7">
      <header>
        <p className="memory-eyebrow">The long view</p>
        <h1 className="mt-2 text-3xl font-semibold text-ocean-dark sm:text-4xl">Our timeline</h1>
        <p className="mt-2 text-gray-600">A gentle way to wander through the years, with today’s memories waiting at the top.</p>
      </header>

      {onThisDay.length > 0 && (
        <section className="rounded-2xl border border-sunset-orange/20 bg-orange-50/70 p-5 shadow-sm">
          <p className="memory-eyebrow">On this day</p>
          <h2 className="mt-1 text-2xl font-semibold text-ocean-dark">{formatDateOnly(today, { month: 'long', day: 'numeric' })}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {onThisDay.map(memory => <TimelineCard key={memory.id} memory={memory} onEdit={setEditingTrip} />)}
          </div>
        </section>
      )}

      <section className="relative border-l-2 border-ocean-teal/20 pl-5 sm:pl-8">
        {timeline.map(memory => <TimelineCard key={memory.id} memory={memory} timeline onEdit={setEditingTrip} />)}
        {!timeline.length && <div className="memory-empty -ml-5">Add a memory to begin the timeline.</div>}
      </section>

      <button type="button" onClick={() => setPage('trips')} className="rounded-full bg-ocean-blue px-5 py-3 font-semibold text-white hover:bg-ocean-dark">
        Add or edit memories
      </button>

      {editingTrip && (
        <TripForm
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
        />
      )}
    </div>
  );
}

function TimelineCard({ memory, timeline = false, onEdit }) {
  const photo = memory.photos?.find(item => item.is_cover) || memory.photos?.[0];
  return (
    <button
      type="button"
      onClick={() => onEdit(memory)}
      className="relative mb-5 block w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-ocean-teal/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ocean-teal focus:ring-offset-2"
      aria-label={`Edit memory at ${memory.location_name}`}
    >
      {timeline && <span className="absolute -left-[2.05rem] top-5 h-4 w-4 rounded-full border-4 border-[#f5f0e8] bg-ocean-teal sm:-left-[2.55rem]" aria-hidden="true" />}
      <div className="flex gap-4">
        {photo && <img src={`/photos/${photo.thumbnail_path || photo.file_path}`} alt={photo.caption || memory.location_name} style={getPhotoImageStyle(photo)} className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sunset-orange">{formatMemoryDate(memory)}</p>
          <h3 className="mt-1 text-xl font-semibold text-ocean-dark">{memory.location_name}</h3>
          <p className="text-sm text-gray-500">{[memory.city, memory.state, memory.country].filter(Boolean).join(', ') || memory.trip_type}</p>
          {memory.notes && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{memory.notes}</p>}
          {memory.travelers?.length > 0 && <p className="mt-2 text-xs text-ocean-teal">With {memory.travelers.map(person => person.name).join(', ')}</p>}
        </div>
      </div>
    </button>
  );
}

function formatMemoryDate(memory) {
  return memory.start_date ? formatDateOnly(memory.start_date, { month: 'short', day: 'numeric', year: 'numeric' }) : memory.date_label || 'Date unknown';
}
