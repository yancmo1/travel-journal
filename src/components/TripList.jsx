import React from 'react'
import { formatDateDisplay } from '../utils/format'

export default function TripList({ trips = [], onEdit, onDelete }) {
  return (
    <div>
      <h3 className="font-medium mb-2">Trips ({trips.length})</h3>
      <div className="space-y-2 max-h-64 overflow-auto">
        {trips.map(t => (
          <div key={t.id} className="p-2 border rounded flex justify-between items-start">
            <div>
              <div className="font-semibold">{t.location?.name || 'Unknown'}</div>
              <div className="text-sm text-slate-600">{t.startDate ? formatDateDisplay(t.startDate) : 'Date TBD'}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => onEdit && onEdit(t)} className="text-sm text-blue-600">Edit</button>
              <button onClick={() => onDelete && onDelete(t.id)} className="text-sm text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
