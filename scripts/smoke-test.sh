#!/bin/bash

# Travel Tracker Smoke Test Script
# Tests all critical API endpoints

set -e

API_URL="http://localhost:3080/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "🧪 Travel Tracker Smoke Test"
echo "=================================="
echo ""

# Test 1: API Health
echo -n "1️⃣  Testing API health... "
HEALTH=$(curl -s "${API_URL}/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 2: User Registration
echo -n "2️⃣  Testing user registration... "
TIMESTAMP=$(date +%s)
TEST_EMAIL="testuser${TIMESTAMP}@example.com"
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"test123\",\"displayName\":\"Test User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
  echo -e "${GREEN}✓ PASS${NC}"
  TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
  echo -e "${RED}✗ FAIL${NC}"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi

# Test 3: Get User Info
echo -n "3️⃣  Testing auth/me... "
ME_RESPONSE=$(curl -s "${API_URL}/auth/me" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$ME_RESPONSE" | grep -q "${TEST_EMAIL}"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 4: Create Traveler
echo -n "4️⃣  Testing create traveler... "
TRAVELER_RESPONSE=$(curl -s -X POST "${API_URL}/travelers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"name":"Test Child","relationship":"child"}')
if echo "$TRAVELER_RESPONSE" | grep -q "Test Child"; then
  echo -e "${GREEN}✓ PASS${NC}"
  TRAVELER_ID=$(echo "$TRAVELER_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 5: Get Travelers
echo -n "5️⃣  Testing get travelers... "
TRAVELERS_RESPONSE=$(curl -s "${API_URL}/travelers" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$TRAVELERS_RESPONSE" | grep -q "Test Child"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 6: Create Trip
echo -n "6️⃣  Testing create trip... "
TRIP_RESPONSE=$(curl -s -X POST "${API_URL}/trips" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "locationName":"Test City, TX",
    "latitude":30.2672,
    "longitude":-97.7431,
    "country":"United States",
    "state":"Texas",
    "startDate":"2024-01-15",
    "endDate":"2024-01-17",
    "tripType":"Road Trip",
    "notes":"Test trip for smoke test"
  }')
if echo "$TRIP_RESPONSE" | grep -q "Test City"; then
  echo -e "${GREEN}✓ PASS${NC}"
  TRIP_ID=$(echo "$TRIP_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
else
  echo -e "${RED}✗ FAIL${NC}"
  echo "Response: $TRIP_RESPONSE"
  exit 1
fi

# Test 7: Get Trips
echo -n "7️⃣  Testing get trips... "
TRIPS_RESPONSE=$(curl -s "${API_URL}/trips" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$TRIPS_RESPONSE" | grep -q "Test City"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 8: Update Trip
echo -n "8️⃣  Testing update trip... "
UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/trips/${TRIP_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "locationName":"Updated City, TX",
    "latitude":30.2672,
    "longitude":-97.7431,
    "country":"United States",
    "state":"Texas",
    "startDate":"2024-01-15",
    "endDate":"2024-01-17",
    "tripType":"Flight",
    "notes":"Updated test trip"
  }')
if echo "$UPDATE_RESPONSE" | grep -q "Updated City"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 9: Get Trip by ID
echo -n "9️⃣  Testing get trip by ID... "
TRIP_BY_ID=$(curl -s "${API_URL}/trips/${TRIP_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$TRIP_BY_ID" | grep -q "Updated City"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 10: Create Journey
echo -n "🔟 Testing create journey... "
JOURNEY_RESPONSE=$(curl -s -X POST "${API_URL}/journeys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"title\":\"Test Family Journey\",
    \"startDate\":\"2024-01-15\",
    \"endDate\":\"2024-01-17\",
    \"journeyType\":\"Road Trip\",
    \"summary\":\"Journey smoke test\",
    \"memoryIds\":[${TRIP_ID}]
  }")
if echo "$JOURNEY_RESPONSE" | grep -q "Test Family Journey"; then
  echo -e "${GREEN}✓ PASS${NC}"
  JOURNEY_ID=$(echo "$JOURNEY_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
else
  echo -e "${RED}✗ FAIL${NC}"
  echo "Response: $JOURNEY_RESPONSE"
  exit 1
fi

# Test 11: Get Journeys
echo -n "1️⃣1️⃣  Testing get journeys... "
JOURNEYS_RESPONSE=$(curl -s "${API_URL}/journeys" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$JOURNEYS_RESPONSE" | grep -q "Test Family Journey"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 12: Update Journey
echo -n "1️⃣2️⃣  Testing update journey... "
UPDATE_JOURNEY=$(curl -s -X PUT "${API_URL}/journeys/${JOURNEY_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"title\":\"Updated Family Journey\",
    \"startDate\":\"2024-01-15\",
    \"journeyType\":\"Road Trip\",
    \"memoryIds\":[${TRIP_ID}]
  }")
if echo "$UPDATE_JOURNEY" | grep -q "Updated Family Journey"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 13: Delete Journey
echo -n "1️⃣3️⃣  Testing delete journey... "
DELETE_JOURNEY=$(curl -s -X DELETE "${API_URL}/journeys/${JOURNEY_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$DELETE_JOURNEY" | grep -q "success"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 14: Check Photo Location Backfill
echo -n "1️⃣4️⃣  Testing photo location backfill status... "
BACKFILL_STATUS=$(curl -s "${API_URL}/photos/location-backfill" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$BACKFILL_STATUS" | grep -q '"count"'; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 15: Run No-op Photo Location Backfill
echo -n "1️⃣5️⃣  Testing safe photo location backfill... "
BACKFILL_RESPONSE=$(curl -s -X POST "${API_URL}/photos/location-backfill" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$BACKFILL_RESPONSE" | grep -q '"updated"'; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 16: Get Analytics
echo -n "1️⃣6️⃣  Testing analytics... "
ANALYTICS_RESPONSE=$(curl -s "${API_URL}/analytics" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$ANALYTICS_RESPONSE" | grep -q "totalTrips"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 17: Delete Trip
echo -n "1️⃣7️⃣  Testing delete trip... "
DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/trips/${TRIP_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$DELETE_RESPONSE" | grep -q "deleted"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 18: Delete Traveler
echo -n "1️⃣8️⃣  Testing delete traveler... "
DELETE_TRAVELER=$(curl -s -X DELETE "${API_URL}/travelers/${TRAVELER_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$DELETE_TRAVELER" | grep -q "deleted"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}✅ All smoke tests passed!${NC}"
echo "=================================="
echo ""
echo -e "${YELLOW}✨ Memory experience check:${NC}"
echo "To try the redesigned site:"
echo "1. Go to http://localhost:3080"
echo "2. Create the first private account"
echo "3. Swipe the daily memory card or use the arrow buttons"
echo "4. Open 'Our journeys' to see the grouped stories"
echo "5. Open 'All places' to add memories and photos"
echo ""
