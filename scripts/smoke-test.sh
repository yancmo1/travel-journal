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
TEST_USER="testuser${TIMESTAMP}"
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"password\":\"test123\",\"displayName\":\"Test User\"}")

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
if echo "$ME_RESPONSE" | grep -q "${TEST_USER}"; then
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
    "notes":"Test trip for smoke test",
    "travelerIds":[1]
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
    "notes":"Updated test trip",
    "travelerIds":[1]
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

# Test 10: Get Analytics
echo -n "🔟 Testing analytics... "
ANALYTICS_RESPONSE=$(curl -s "${API_URL}/analytics" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$ANALYTICS_RESPONSE" | grep -q "totalTrips"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 11: Delete Trip
echo -n "1️⃣1️⃣  Testing delete trip... "
DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/trips/${TRIP_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
if echo "$DELETE_RESPONSE" | grep -q "deleted"; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Test 12: Delete Traveler
echo -n "1️⃣2️⃣  Testing delete traveler... "
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
echo -e "${YELLOW}📸 Photo Intelligence Test:${NC}"
echo "To test photo upload and analysis:"
echo "1. Go to http://localhost:3080"
echo "2. Click 'Photo Intelligence' tab"
echo "3. Upload photos with GPS data"
echo "4. Watch backend logs: docker logs -f travel-journal-backend-1"
echo ""
echo "Backend logs will show:"
echo "  [PHOTO ANALYZE] Starting analysis..."
echo "  [PHOTO ANALYZE] Files: IMG_001.jpg, IMG_002.jpg"
echo "  [PHOTO ANALYZE] X of Y photos have GPS and date data"
echo "  [PHOTO ANALYZE] Clustering X valid photos..."
echo "  [PHOTO ANALYZE] Suggested X trips"
echo "  [PHOTO ANALYZE] Analysis complete"
echo ""
