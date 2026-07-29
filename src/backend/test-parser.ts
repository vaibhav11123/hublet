import { KeywordIntentParser } from './src/parsers/intent-parser';

const parser = new KeywordIntentParser();

const tests = [
  "Looking for 2bhk in Indiranagar under 70L",
  "Need a 3 BHK near Electronic City budget 1.2cr",
  "Want 2 bedroom flat in Koramangala and HSR, area minimum 1200 sqft",
  "3bhk budget 50-70 lakhs",
  "Need 4 bedroom apartment with parking and gym",
  "budget is 1.5cr in whitefield",
  "2.5bhk near sarjapur road > 1cr",
  "looking for area at least 1500 sqft with balcony",
  "areas like hebbal, kothanur"
];

console.log("--- Intent Parsing Tests ---");
tests.forEach(test => {
  console.log(`\nInput: "${test}"`);
  const result = parser.parse(test);
  console.log("Result:", JSON.stringify(result, null, 2));
});
