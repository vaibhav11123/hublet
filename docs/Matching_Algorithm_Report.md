# Hublet Matching Algorithm Report

Date: March 9, 2026

## 1. Summary

Hublet currently uses a **rule-based weighted scoring algorithm** to match buyers with properties (and properties with buyers).  
It is deterministic and does not use machine learning.

Important: seller profile signals such as `rating` and `trustScore` are **not** part of match-score computation in the current implementation.

## 2. Implementation Files

- Core matcher:
  - `src/backend/src/matchers/rule-based-matcher.ts`
- Match orchestration and persistence:
  - `src/backend/src/services/matching.service.ts`
- Buyer intent parsing from raw text (upstream input to matcher):
  - `src/backend/src/parsers/intent-parser.ts`

## 3. Scoring Formula

Total score is a weighted sum of four component scores:

```
totalScore =
  0.35 * locationScore +
  0.30 * budgetScore +
  0.20 * sizeScore +
  0.15 * amenitiesScore
```

Weights:

- Location: 35%
- Budget: 30%
- Size: 20%
- Amenities: 15%

`totalScore` is rounded to 2 decimals.

## 4. Component Rules

### 4.1 Location Score (0 to 100)

- Exact locality match: `100`
- Partial text containment match: `70`
  - Example: buyer locality contains property locality (or vice versa)
- No match: `0`

### 4.2 Budget Score (0 to 100)

- No budget preference set by buyer: `50` (neutral)
- Property inside buyer budget range: `100`
- Property above max budget:
  - <=10% over: `70`
  - <=20% over: `40`
  - >20% over: `10`
- Property below min budget:
  - <=10% under: `70`
  - <=20% under: `40`
  - >20% under: `10`
- Fallback case: `30`

### 4.3 Size Score (0 to 100)

Built from BHK + area sub-scores, capped at 100.

BHK part:

- Exact BHK: `+50`
- BHK difference = 1: `+25`
- No BHK preference: `+25`

Area part:

- In buyer area range: `+50`
- Not in range but close:
  - Closest difference < 200 sqft: `+25`
  - Closest difference < 500 sqft: `+10`
- No area preference: `+25`

### 4.4 Amenities Score (0 to 100)

- No amenity preference set: `50` (neutral)
- Else:
  - `round( matchedAmenities / requestedAmenities * 100 )`

## 5. Matching Pipeline in Service Layer

In `matching.service.ts`, the flow is:

1. Load buyer intent + active properties (or reverse for property-to-buyers).
2. Compute score using `RuleBasedMatcher.score(...)`.
3. Filter by minimum threshold:
   - default `minScore = 50`
4. Sort descending by `totalScore`.
5. Limit results:
   - default `limit = 50`
6. Persist match rows with score breakdown:
   - `matchScore`, `locationScore`, `budgetScore`, `sizeScore`, `amenitiesScore`

## 6. Intent Parsing Notes

`KeywordIntentParser` extracts:

- localities
- area min/max
- BHK
- budget min/max
- amenities

using regex and keyword heuristics from free-text buyer input.

## 7. Current Limitations

- Seller trust/rating is not included in score.
- Location matching is string-based and can miss semantic/geospatial similarity.
- Amenities matching requires near-exact text normalization.
- Budget/size closeness uses fixed rule thresholds.

## 8. Conclusion

The current matcher is a clear, explainable baseline with stable behavior and low complexity.  
It is designed to be replaceable later through the matcher interface.
