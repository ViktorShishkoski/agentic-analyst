// generic_processor.js
// Standardized Data Processing for Python/Pandas Compatibility
const DB_NAME = "analyst_db";
const COLL = "raw_data";
const targetDb = db.getSiblingDB(DB_NAME);

/**
 * @param {string} groupField - The key to group by (e.g., "team")
 * @param {string} metricField - The value to average (e.g., "weight")
 * @param {Array} targets - The specific items to compare
 */
function performAnalysis(groupField, metricField, targets) {
    const pipeline = [
        { $match: { [groupField]: { $in: targets } } },
        { 
            $group: { 
                _id: `$${groupField}`, 
                avgMetric: { $avg: { $toDouble: `$${metricField}` } } 
            } 
        },
        { $project: { category: "$_id", value: "$avgMetric", _id: 0 } }
    ];
    
    const results = targetDb[COLL].aggregate(pipeline).toArray();
    print(JSON.stringify(results)); // Standardized JSON output
}

// If running via --eval with global variables
if (typeof groupField !== 'undefined' && typeof metricField !== 'undefined' && typeof targets !== 'undefined') {
    performAnalysis(groupField, metricField, targets);
}
