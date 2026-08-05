import React from 'react';

export default function MemoryPlaceDetails({ memory, className = '' }) {
  const placeName = memory?.place_name || memory?.placeName || '';
  const formattedAddress = memory?.formatted_address || memory?.formattedAddress || '';

  if (!placeName && !formattedAddress) return null;

  return (
    <div className={`space-y-1 ${className}`.trim()}>
      {placeName && <p className="text-sm font-medium text-ocean-dark">{placeName}</p>}
      {formattedAddress && <p className="text-sm text-gray-500">{formattedAddress}</p>}
    </div>
  );
}
