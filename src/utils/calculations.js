import { buildTravelDistanceSummary } from './travelDistance'

export function totalDistanceMiles(trips, home) {
  return buildTravelDistanceSummary(trips, home).totalMiles
}
