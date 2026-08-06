import { useEffect, useState } from 'react';
import api from '../utils/api';
import { formatDateOnly } from '../utils/format';
import { getPhotoImageStyle } from '../utils/photos';
import MemoryPlaceDetails from '../components/MemoryPlaceDetails';

export default function SharedJourneyPage({ token }) {
  const [journey, setJourney] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSharedJourney(token).then(setJourney).catch(err => setError(err.message || 'This private link is unavailable.'));
  }, [token]);

  if (error) return <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8] p-6"><div className="rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-semibold text-ocean-dark">Private journey unavailable</h1><p className="mt-2 text-gray-600">{error}</p><a className="mt-5 inline-block font-semibold text-ocean-teal" href="/">Open Postcards of Us</a></div></main>;
  if (!journey) return <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8] text-ocean-dark">Loading private journey…</main>;

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[#fffdf9] px-5 py-8 text-[#23302c] sm:px-10 sm:py-12">
      <header className="border-b border-ocean-teal/10 pb-8">
        <p className="memory-eyebrow">A private family story</p>
        <h1 className="mt-2 text-4xl font-semibold text-ocean-dark sm:text-6xl">{journey.title}</h1>
        <p className="mt-3 text-gray-600">{formatJourneyDate(journey)}</p>
        {journey.summary && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-700">{journey.summary}</p>}
      </header>
      <div className="mt-8 space-y-10">
        {journey.memories.map((memory, index) => (
          <article key={memory.id} className="border-b border-gray-100 pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sunset-orange">Stop {index + 1} · {formatMemoryDate(memory)}</p>
            <h2 className="mt-2 text-3xl font-semibold text-ocean-dark">{memory.location_name}</h2>
            <MemoryPlaceDetails memory={memory} className="mt-2" />
            <p className="mt-1 text-gray-500">{[memory.city, memory.state, memory.country].filter(Boolean).join(', ')}</p>
            {memory.notes && <p className="mt-4 max-w-3xl whitespace-pre-wrap leading-relaxed text-gray-700">{memory.notes}</p>}
            {memory.photos?.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{memory.photos.map(photo => <figure key={photo.id}><img src={`/photos/${photo.file_path || photo.thumbnail_path}`} alt={photo.caption || photo.filename || ''} style={getPhotoImageStyle(photo)} className="aspect-square w-full rounded-xl object-cover" />{photo.caption && <figcaption className="mt-1 text-sm text-gray-600">{photo.caption}</figcaption>}</figure>)}</div>}
          </article>
        ))}
      </div>
      <footer className="pt-8 text-sm text-gray-500">Shared privately from Postcards of Us.</footer>
    </main>
  );
}

function formatJourneyDate(journey) {
  if (!journey.start_date) return journey.date_label || 'Dates still being remembered';
  const start = formatDateOnly(journey.start_date, { month: 'long', day: 'numeric', year: 'numeric' });
  if (!journey.end_date || journey.end_date === journey.start_date) return start;
  return `${start} — ${formatDateOnly(journey.end_date, { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function formatMemoryDate(memory) {
  return memory.start_date ? formatDateOnly(memory.start_date, { month: 'short', day: 'numeric', year: 'numeric' }) : memory.date_label || 'Date unknown';
}
