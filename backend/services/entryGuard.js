/**
 * 🛡️ ENTRY GUARD SERVICE
 * Enforces strict data entry formats and sanitizes data for R-based visualization.
 */

export const ENTRY_INSTRUCTION = `Format Required:
[Category/Group]: [Value] | [Optional: Timestamp]
Example: "Boston Celtics: 220 | 2026-05-07"
Note: Values must be numbers only. No units (lbs, kg, $).`;

/**
 * Strips units and non-numeric characters from a string to leave only a number.
 * @param {string|number} val 
 * @returns {number}
 */
function stripUnits(val) {
    if (typeof val === 'number') return val;
    // Regex to extract the first numeric-looking part (handling decimals and negatives)
    const match = val.toString().replace(/[^\d.-]/g, '');
    return parseFloat(match);
}

/**
 * Validates and sanitizes a single entry or a list of entries.
 * @param {string|Array} input 
 * @returns {Array} List of sanitized entries
 */
export function validateAndSanitize(input) {
    let entries = [];

    // Handle JSON list
    if (Array.isArray(input)) {
        entries = input;
    } else if (typeof input === 'string') {
        let cleanedInput = input.trim();
        
        // Try to find JSON array or object in the string if direct parsing fails
        try {
            const jsonStart = cleanedInput.indexOf('[');
            const jsonObjectStart = cleanedInput.indexOf('{');
            
            let startPos = -1;
            if (jsonStart !== -1 && (jsonObjectStart === -1 || jsonStart < jsonObjectStart)) {
                startPos = jsonStart;
            } else if (jsonObjectStart !== -1) {
                startPos = jsonObjectStart;
            }

            if (startPos !== -1) {
                const potentialJson = cleanedInput.substring(startPos);
                const parsed = JSON.parse(potentialJson);
                entries = Array.isArray(parsed) ? parsed : [parsed];
            } else {
                throw new Error("No JSON found");
            }
        } catch (e) {
            // Not JSON or parsing failed, treat as single formatted string: [Category]: [Value] | [Timestamp]
            const parts = cleanedInput.split('|').map(p => p.trim());
            const catVal = parts[0].split(':').map(p => p.trim());
            
            if (catVal.length < 2) {
                throw new Error(ENTRY_INSTRUCTION);
            }

            entries = [{
                category: catVal[0],
                value: catVal[1],
                timestamp: parts[1] || null
            }];
        }
    }

    return entries.map(entry => {
        // 1. Validate numeric value (Rule 1: No Units)
        const cleanValue = stripUnits(entry.value);
        if (isNaN(cleanValue)) {
            throw new Error(`Invalid numeric value: ${entry.value}. \n\n${ENTRY_INSTRUCTION}`);
        }

        // 2. Inject timestamp if missing
        const timestamp = entry.timestamp || new Date().toISOString();

        // 3. Sanitize Category (remove special characters for R compatibility)
        // R prefers alphanumeric and dots/underscores for headers
        const cleanCategory = entry.category
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/^_+|_+$/g, '');

        return {
            category: cleanCategory,
            value: cleanValue,
            timestamp: timestamp
        };
    });
}
