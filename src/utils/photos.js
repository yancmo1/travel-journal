const VALID_ROTATIONS = new Set([0, 90, 180, 270]);

export function getPhotoRotation(photo) {
  const rotation = Number(photo?.rotation || 0);
  return VALID_ROTATIONS.has(rotation) ? rotation : 0;
}

export function getPhotoImageStyle(photo) {
  const rotation = getPhotoRotation(photo);
  return rotation ? { transform: `rotate(${rotation}deg)` } : undefined;
}

export function nextPhotoRotation(photo) {
  return (getPhotoRotation(photo) + 90) % 360;
}
