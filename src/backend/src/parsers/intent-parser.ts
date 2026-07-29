/**
 * Simple intent parser interface
 * This can be replaced with NLP/ML-based parsing later
 */

export interface ParsedIntent {
  localities: string[];
  areaMin?: number;
  areaMax?: number;
  bhk?: number;
  budgetMin?: number;
  budgetMax?: number;
  amenities: string[];
}

export interface IntentParser {
  parse(rawText: string): ParsedIntent;
}

/**
 * Keyword-based parser with known-locality scanning
 * Handles inputs like "Thane", "3 BHK in Thane", "Office space in Mumbai" etc.
 */
export class KeywordIntentParser implements IntentParser {
  /**
   * Known Indian cities and localities — sorted longest-first so multi-word names
   * (e.g. "Navi Mumbai", "Thane West") are matched before their shorter prefixes.
   */
  private readonly KNOWN_LOCALITIES: string[] = [
    // Multi-word names first (will be sorted at runtime anyway, kept readable here)
    'navi mumbai', 'thane west', 'thane east', 'mira road', 'vasai virar',
    'lower parel', 'marine lines', 'nariman point', 'vile parle',
    'kopar khairane', 'pimple saudagar', 'koregaon park', 'kalyani nagar',
    'electronic city', 'hitech city', 'jubilee hills', 'banjara hills',
    'hsr layout', 'jp nagar', 'kr puram', 'teen haath naka', 'vartak nagar',
    'wagle estate', 'ghodbunder road', 'manpada', 'kolshet',
    // Major Indian cities
    'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'ahmedabad',
    'chennai', 'kolkata', 'surat', 'pune', 'jaipur', 'lucknow', 'kanpur',
    'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna',
    'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad',
    'meerut', 'rajkot', 'varanasi', 'aurangabad', 'dhanbad', 'amritsar',
    'coimbatore', 'mysore', 'mysuru', 'kochi', 'noida', 'gurgaon', 'gurugram',
    // Mumbai / MMR
    'andheri', 'bandra', 'powai', 'malad', 'goregaon', 'borivali', 'kandivali',
    'dahisar', 'bhayander', 'vasai', 'virar', 'nalasopara', 'juhu', 'versova',
    'lokhandwala', 'khar', 'santacruz', 'jogeshwari', 'kurla', 'ghatkopar',
    'vikhroli', 'mulund', 'bhandup', 'nahur', 'worli', 'prabhadevi', 'mahim',
    'dadar', 'matunga', 'sion', 'chembur', 'dharavi', 'colaba', 'fort',
    'churchgate', 'kalyan', 'dombivli', 'ulhasnagar', 'bhiwandi', 'badlapur',
    'ambernath', 'panvel', 'kharghar', 'nerul', 'belapur', 'vashi', 'turbhe',
    'airoli', 'ghansoli', 'rabale', 'mahape', 'majiwada', 'naupada', 'charai',
    'panchpakhadi', 'upvan', 'owale', 'pokhran', 'kopri', 'uthalsar',
    // Pune
    'kothrud', 'hadapsar', 'viman nagar', 'baner', 'aundh', 'hinjewadi',
    'wakad', 'shivajinagar', 'kharadi', 'undri', 'kondhwa', 'sinhagad road',
    // Bangalore
    'koramangala', 'indiranagar', 'whitefield', 'marathahalli', 'hebbal',
    'yelahanka', 'sarjapur', 'bannerghatta', 'jayanagar', 'ecity',
    // Hyderabad
    'gachibowli', 'madhapur', 'kondapur', 'ameerpet', 'secunderabad',
    'kukatpally', 'miyapur',
  ].sort((a, b) => b.length - a.length); // longest first

  private readonly NOISE_WORDS = new Set([
    'a', 'an', 'the', 'this', 'that', 'my', 'your', 'our', 'their',
    'in', 'at', 'on', 'near', 'around', 'within', 'by', 'of', 'to',
    'looking', 'for', 'need', 'want', 'buy', 'get', 'find',
    'flat', 'house', 'apartment', 'property', 'properties', 'home', 'homes',
    'room', 'rooms', 'studio', 'office', 'space', 'plot', 'land', 'villa',
    'bhk', 'sqft', 'crore', 'budget', 'lakh', 'lac', 'cr',
    'good', 'nice', 'best', 'affordable', 'cheap', 'luxury',
    'residential', 'commercial', 'locality', 'area', 'location', 'sector',
    'new', 'old', 'ready', 'possession',
  ]);

  parse(rawText: string): ParsedIntent {
    const text = rawText.toLowerCase();

    return {
      localities: this.extractLocalities(text),
      areaMin: this.extractAreaMin(text),
      areaMax: this.extractAreaMax(text),
      bhk: this.extractBHK(text),
      budgetMin: this.extractBudgetMin(text),
      budgetMax: this.extractBudgetMax(text),
      amenities: this.extractAmenities(text),
    };
  }

  private extractLocalities(text: string): string[] {
    const found: string[] = [];

    // ── Pass 1: scan for known localities directly in the text ────────────────
    // Longest-first order prevents "mumbai" matching inside "navi mumbai".
    const alreadyCovered = new Set<number>(); // track char positions consumed
    for (const loc of this.KNOWN_LOCALITIES) {
      const pattern = new RegExp(`\\b${loc.replace(/ /g, '\\s+')}\\b`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(text)) !== null) {
        // Check no character in this match was already claimed by a longer match
        const start = m.index;
        const end = start + m[0].length;
        let overlap = false;
        for (let i = start; i < end; i++) {
          if (alreadyCovered.has(i)) { overlap = true; break; }
        }
        if (!overlap) {
          found.push(loc);
          for (let i = start; i < end; i++) alreadyCovered.add(i);
          break; // one hit per locality name is enough
        }
      }
    }

    // ── Pass 2: preposition-based extraction for unlisted localities ─────────
    const prepositions = ['in', 'near', 'around', 'at'];
    for (const prep of prepositions) {
      // Match the preposition followed by 1–3 capitalised/title-case words
      // (we run on the original-case input to catch "Thane", "Navi Mumbai" etc.)
      const re = new RegExp(`\\b${prep}\\s+([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+){0,2})`, 'g');
      let m: RegExpExecArray | null;
      const original = text.replace(/\b\w/g, c => c.toUpperCase()); // re-capitalise for matching
      while ((m = re.exec(original)) !== null) {
        const candidate = m[1].toLowerCase().trim();
        if (!this.isNoise(candidate) && !found.includes(candidate)) {
          found.push(candidate);
        }
      }
    }

    // ── Pass 3: "localities/areas like X, Y" pattern ─────────────────────────
    const listMatch = text.match(/(?:localities|areas)\s+(?:like|such as)\s+([a-z,\s]+)/i);
    if (listMatch) {
      listMatch[1].split(/,|\band\b/).map(s => s.trim()).forEach(c => {
        if (!this.isNoise(c) && !found.includes(c)) found.push(c);
      });
    }

    // Remove shorter entries that are strict substrings of a longer entry
    const deduped = [...new Set(found)];
    return deduped.filter(
      loc => !deduped.some(other => other !== loc && other.includes(loc) && other.length > loc.length)
    );
  }

  private isNoise(text: string): boolean {
    return text.length < 3 || this.NOISE_WORDS.has(text);
  }

  private extractBHK(text: string): number | undefined {
    // Look for patterns like "2 bhk", "3bhk", "2-bhk", "4.5bhk"
    const bhkMatch = text.match(/(\d+(?:\.\d+)?)\s*[-]?\s*bhk/i);
    if (bhkMatch) {
      return Math.floor(parseFloat(bhkMatch[1]));
    }

    // Look for patterns like "2 bedroom", "3 rooms", "1 flat"
    const roomMatch = text.match(/(\d+)\s*(?:bedroom|room|flat|apartment|bed)/i);
    if (roomMatch) {
      return parseInt(roomMatch[1]);
    }

    // Handle just "2bhk" as a single token
    const simpleMatch = text.match(/\b(\d+)\s*b\b/i);
    if (simpleMatch) {
      return parseInt(simpleMatch[1]);
    }

    return undefined;
  }

  private extractAreaMin(text: string): number | undefined {
    // Look for patterns like "minimum 1000 sqft" or "at least 1200 sq ft"
    const minMatch = text.match(/(?:minimum|min|at least)\s*(\d+)\s*(?:sq\s*ft|sqft|square feet)/i);
    if (minMatch) {
      return parseInt(minMatch[1]);
    }

    // Look for range patterns like "1000-1500 sqft"
    const rangeMatch = text.match(/(\d+)\s*[-to]\s*(\d+)\s*(?:sq\s*ft|sqft|square feet)/i);
    if (rangeMatch) {
      return parseInt(rangeMatch[1]);
    }

    return undefined;
  }

  private extractAreaMax(text: string): number | undefined {
    // Look for patterns like "maximum 1500 sqft" or "up to 2000 sq ft"
    const maxMatch = text.match(/(?:maximum|max|up to)\s*(\d+)\s*(?:sq\s*ft|sqft|square feet)/i);
    if (maxMatch) {
      return parseInt(maxMatch[1]);
    }

    // Look for range patterns like "1000-1500 sqft"
    const rangeMatch = text.match(/(\d+)\s*[-to]\s*(\d+)\s*(?:sq\s*ft|sqft|square feet)/i);
    if (rangeMatch) {
      return parseInt(rangeMatch[2]);
    }

    return undefined;
  }

  private extractBudgetMin(text: string): number | undefined {
    // Look for various shorthand patterns like '1.2cr', '50l', '75lac'
    const lakhMultiplier = 100000;
    const croreMultiplier = 10000000;

    // Range patterns like "50-70 lakhs" or "1.2-1.5 cr"
    const rangeMatch = text.match(/budget.*?(\d+\.?\d*)\s*[-to]\s*(\d+\.?\d*)\s*(?:lakhs?|lacs?|l|cr|crores?)/i);
    if (rangeMatch) {
      const isCr = /cr|crore/i.test(rangeMatch[0]);
      return parseFloat(rangeMatch[1]) * (isCr ? croreMultiplier : lakhMultiplier);
    }

    // Handle "under {Price}" pattern (often implies max, but check for "above/min" too)
    const priceContextMatch = text.match(/(?:under|below|max|maximum|up to)\s*(\d+\.?\d*)\s*(?:lakhs?|lacs?|l\b|cr|crores?\b)/i);
    if (priceContextMatch) {
      // If the query only has one price and it's an "under" pattern, budgetMin is undefined/null
      return undefined;
    }

    // "Above 50L", "> 50L", "min 50L"
    const minPatterns = [
      /(?:minimum|min|at least|above|>|greater than|starting from)\s*(?:budget\s*)?(\d+\.?\d*)\s*(?:lakhs?|lacs?|l\b)/i,
      /(?:minimum|min|at least|above|>|greater than|starting from)\s*(?:budget\s*)?(\d+\.?\d*)\s*(?:cr|crore|crores\b)/i
    ];

    for (const pattern of minPatterns) {
      const match = text.match(pattern);
      if (match) {
        const isCr = /cr|crore/i.test(match[0]);
        return parseFloat(match[1]) * (isCr ? croreMultiplier : lakhMultiplier);
      }
    }

    return undefined;
  }

  private extractBudgetMax(text: string): number | undefined {
    const lakhMultiplier = 100000;
    const croreMultiplier = 10000000;

    // Range patterns like "50-70 lakhs" or "1.2-1.5 cr"
    const rangeMatch = text.match(/budget.*?(\d+\.?\d*)\s*[-to]\s*(\d+\.?\d*)\s*(?:lakhs?|lacs?|l|cr|crores?)/i);
    if (rangeMatch) {
      const isCr = /cr|crore/i.test(rangeMatch[0]);
      return parseFloat(rangeMatch[2]) * (isCr ? croreMultiplier : lakhMultiplier);
    }

    // "Under 70L", "< 70L", "max 70L", "below 70L"
    const maxPatterns = [
      /(?:maximum|max|up to|under|below|around|budget|within|<|less than)\s*(?:budget\s*)?(\d+\.?\d*)\s*(?:lakhs?|lacs?|l\b)/i,
      /(?:maximum|max|up to|under|below|around|budget|within|<|less than)\s*(?:budget\s*)?(\d+\.?\d*)\s*(?:cr|crore|crores\b)/i,
      /\b(\d+\.?\d*)\s*(?:lakhs?|lacs?|l\b)/i, // Suffix only fallback: "70 Lakhs"
      /\b(\d+\.?\d*)\s*(?:cr|crore|crores\b)/i  // Suffix only fallback: "1.2 Cr"
    ];

    // Priority check: avoid picking up BHK numbers (like 3) if they precede "bhk"
    const bhkMatch = text.match(/(\d+)\s*bhk/i);
    const bhkVal = bhkMatch ? bhkMatch[1] : null;

    for (const pattern of maxPatterns) {
      const match = text.match(pattern);
      if (match) {
        const valStr = match[1];
        // If this matched value is actually the BHK count (e.g. "3" in "3BHK"), skip it
        if (bhkVal && valStr === bhkVal && !match[0].includes('lakh') && !match[0].includes('cr')) {
          continue;
        }

        const isCr = /cr|crore/i.test(match[0]);
        return parseFloat(valStr) * (isCr ? croreMultiplier : lakhMultiplier);
      }
    }

    // Shorthand cases like "budget 1.2cr" (treat as max)
    const simpleBudget = text.match(/budget\s*(?:is\s*)?(\d+\.?\d*)\s*(?:cr|crore|l|lakhs?)/i);
    if (simpleBudget) {
      const isCr = /cr|crore/i.test(simpleBudget[0]);
      return parseFloat(simpleBudget[1]) * (isCr ? croreMultiplier : lakhMultiplier);
    }

    return undefined;
  }

  private extractAmenities(text: string): string[] {
    const amenities: string[] = [];
    
    // Common amenities to look for
    const commonAmenities = [
      'parking', 'gym', 'swimming pool', 'pool', 'garden', 'security', 'lift',
      'elevator', 'power backup', 'clubhouse', 'playground', 'wifi', 'internet',
      'ac', 'air conditioning', 'balcony', 'terrace',
    ];

    for (const amenity of commonAmenities) {
      if (text.includes(amenity)) {
        amenities.push(amenity);
      }
    }

    // Pass 2: flexible parsing after "with" keyword for comma-separated items
    const withMatch = text.match(/with\s+([a-z\s,]+)(?:$|under|in|budget)/i);
    if (withMatch) {
      const candidates = withMatch[1].split(/,|\band\b/).map(s => s.trim());
      for (const cand of candidates) {
        if (cand.length > 2 && !this.NOISE_WORDS.has(cand) && !amenities.includes(cand)) {
          amenities.push(cand);
        }
      }
    }

    return [...new Set(amenities)]; // Remove duplicates
  }
}
