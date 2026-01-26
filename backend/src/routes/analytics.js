import { Router } from 'express';
import { query } from '../utils/db.js';
import { haversineDistance, getDecade, tripDuration } from '../utils/calculations.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const trips = await query(`
      SELECT t.*, 
        COALESCE(json_agg(DISTINCT tr.*) FILTER (WHERE tr.id IS NOT NULL), '[]') as travelers
      FROM trips t
      LEFT JOIN trip_travelers tt ON t.id = tt.trip_id
      LEFT JOIN travelers tr ON tt.traveler_id = tr.id
      GROUP BY t.id
      ORDER BY t.start_date DESC
    `);

    const allTrips = trips.rows;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentDecade = getDecade(currentYear);

    // Basic counts
    const totalTrips = allTrips.length;
    const uniqueLocations = new Set(allTrips.map(t => t.location_name)).size;
    const countries = new Set(allTrips.filter(t => t.country).map(t => t.country)).size;
    const states = new Set(allTrips.filter(t => t.state).map(t => t.state)).size;

    // Duration statistics
    const durations = allTrips
      .filter(t => t.start_date)
      .map(t => tripDuration(t.start_date, t.end_date));
    
    const totalDaysTraveled = durations.reduce((a, b) => a + b, 0);
    const avgTripLength = durations.length ? (totalDaysTraveled / durations.length).toFixed(1) : 0;
    const longestTrip = durations.length ? Math.max(...durations) : 0;
    const shortestTrip = durations.length ? Math.min(...durations) : 0;

    // Distance statistics
    const tripsWithDistance = allTrips.filter(t => t.home_distance_miles);
    const furthestFromHome = tripsWithDistance.length 
      ? tripsWithDistance.reduce((max, t) => t.home_distance_miles > max.home_distance_miles ? t : max)
      : null;

    // Calculate total miles traveled (cumulative between trips)
    const tripsWithCoords = allTrips
      .filter(t => t.latitude && t.longitude)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    
    let totalMiles = 0;
    for (let i = 1; i < tripsWithCoords.length; i++) {
      totalMiles += haversineDistance(
        tripsWithCoords[i-1].latitude, tripsWithCoords[i-1].longitude,
        tripsWithCoords[i].latitude, tripsWithCoords[i].longitude
      );
    }

    // Year-based statistics
    const tripsByYear = {};
    allTrips.forEach(t => {
      if (t.start_date) {
        const year = new Date(t.start_date).getFullYear();
        tripsByYear[year] = (tripsByYear[year] || 0) + 1;
      }
    });

    const years = Object.keys(tripsByYear).map(Number).sort();
    const busiestYear = years.length 
      ? years.reduce((max, y) => tripsByYear[y] > tripsByYear[max] ? y : max, years[0])
      : null;

    // Decade statistics
    const tripsByDecade = {};
    allTrips.forEach(t => {
      if (t.start_date) {
        const decade = getDecade(new Date(t.start_date).getFullYear());
        tripsByDecade[decade] = (tripsByDecade[decade] || 0) + 1;
      }
    });

    // This year / this decade
    const tripsThisYear = tripsByYear[currentYear] || 0;
    const tripsThisDecade = tripsByDecade[currentDecade] || 0;

    // Miles this year and decade
    const tripsThisYearList = tripsWithCoords.filter(t => 
      new Date(t.start_date).getFullYear() === currentYear
    );
    const tripsThisDecadeList = tripsWithCoords.filter(t => 
      getDecade(new Date(t.start_date).getFullYear()) === currentDecade
    );

    let milesThisYear = 0;
    for (let i = 1; i < tripsThisYearList.length; i++) {
      milesThisYear += haversineDistance(
        tripsThisYearList[i-1].latitude, tripsThisYearList[i-1].longitude,
        tripsThisYearList[i].latitude, tripsThisYearList[i].longitude
      );
    }

    let milesThisDecade = 0;
    for (let i = 1; i < tripsThisDecadeList.length; i++) {
      milesThisDecade += haversineDistance(
        tripsThisDecadeList[i-1].latitude, tripsThisDecadeList[i-1].longitude,
        tripsThisDecadeList[i].latitude, tripsThisDecadeList[i].longitude
      );
    }

    // Trip type breakdown
    const tripTypeBreakdown = {};
    allTrips.forEach(t => {
      const type = t.trip_type || 'Other';
      tripTypeBreakdown[type] = (tripTypeBreakdown[type] || 0) + 1;
    });

    // Traveler breakdowns
    const travelers = await query('SELECT * FROM travelers');
    const travelerBreakdown = {};
    
    travelers.rows.forEach(tr => {
      const count = allTrips.filter(t => 
        t.travelers && t.travelers.some(tv => tv.id === tr.id)
      ).length;
      travelerBreakdown[tr.name] = count;
    });

    // Couple only trips (trips with exactly 2 travelers who are husband/wife)
    const coupleTrips = allTrips.filter(t => {
      if (!t.travelers || t.travelers.length !== 2) return false;
      const relationships = t.travelers.map(tv => tv.relationship);
      return relationships.includes('husband') && relationships.includes('wife');
    }).length;

    // Most visited destination
    const locationCounts = {};
    allTrips.forEach(t => {
      const loc = t.location_name;
      if (loc) locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });
    const mostVisited = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Travel streak (consecutive years with at least one trip)
    let streak = 0;
    if (years.length) {
      for (let y = currentYear; y >= years[0]; y--) {
        if (tripsByYear[y]) streak++;
        else break;
      }
    }

    // Month analysis
    const tripsByMonth = {};
    allTrips.forEach(t => {
      if (t.start_date) {
        const month = new Date(t.start_date).getMonth();
        tripsByMonth[month] = (tripsByMonth[month] || 0) + 1;
      }
    });
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const busiestMonth = Object.entries(tripsByMonth)
      .sort((a, b) => b[1] - a[1])[0];

    // International vs domestic
    const internationalTrips = allTrips.filter(t => t.country && t.country !== 'United States').length;
    const domesticTrips = totalTrips - internationalTrips;
    const internationalPct = totalTrips ? ((internationalTrips / totalTrips) * 100).toFixed(1) : 0;

    res.json({
      summary: {
        totalTrips,
        uniqueLocations,
        countries,
        states,
        totalDaysTraveled,
        totalMiles: Math.round(totalMiles)
      },
      duration: {
        avgTripLength: parseFloat(avgTripLength),
        longestTrip,
        shortestTrip,
        totalDays: totalDaysTraveled
      },
      distance: {
        totalMiles: Math.round(totalMiles),
        milesThisYear: Math.round(milesThisYear),
        milesThisDecade: Math.round(milesThisDecade),
        furthestFromHome: furthestFromHome ? {
          location: furthestFromHome.location_name,
          miles: Math.round(furthestFromHome.home_distance_miles)
        } : null
      },
      frequency: {
        tripsByYear,
        tripsByDecade,
        tripsThisYear,
        tripsThisDecade,
        busiestYear,
        travelStreak: streak
      },
      types: tripTypeBreakdown,
      travelers: {
        breakdown: travelerBreakdown,
        coupleOnlyTrips: coupleTrips
      },
      funStats: {
        mostVisited: mostVisited ? { location: mostVisited[0], count: mostVisited[1] } : null,
        busiestMonth: busiestMonth ? { month: monthNames[busiestMonth[0]], count: busiestMonth[1] } : null,
        internationalPct: parseFloat(internationalPct),
        domesticTrips,
        internationalTrips
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
