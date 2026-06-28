import os
import sys
import json
import argparse
from typing import Dict, List, Any, Set, Tuple
from pymongo import MongoClient

def flatten_dict(d: Dict[str, Any], prefix: str = "") -> List[Tuple[str, Any]]:
    """Recursively flattens a nested dictionary into dot-notation keys and values."""
    results = []
    for key, val in d.items():
        full_key = f"{prefix}.{key}" if prefix else key
        
        # Avoid recursion on lists, datetime, ObjectId, etc.
        if (isinstance(val, dict) and 
            not isinstance(val, (list, tuple)) and 
            type(val).__name__ not in ["ObjectId", "datetime", "Date"]):
            results.extend(flatten_dict(val, full_key))
        else:
            results.append((full_key, val))
    return results

def get_nested_val(doc: Dict[str, Any], dot_key: str) -> Tuple[Any, bool]:
    """Retrieves a nested value from a document given a dot-notation key."""
    parts = dot_key.split('.')
    curr = doc
    for p in parts:
        if isinstance(curr, dict) and p in curr:
            curr = curr[p]
        else:
            return None, False
    return curr, True

def get_type_string(val: Any) -> str:
    """Returns a string representation of the value's type compatible with JS profiler."""
    if isinstance(val, bool):
        return "boolean"
    if isinstance(val, (int, float)):
        return "number"
    if isinstance(val, list):
        return "Array"
    if val is None:
        return "Null"
    
    typename = type(val).__name__
    if typename in ["ObjectId", "datetime"]:
        return typename
        
    return "string"

def profile_collection(db, col_name: str) -> Dict[str, Any]:
    """Profiles a single MongoDB collection and returns its metadata schema."""
    collection = db[col_name]
    
    # 1. Sample 5 documents to extract keys
    samples = list(collection.find().limit(5))
    if not samples:
        return {"fields": {}, "row_count": 0}
        
    # Get total row count
    row_count = collection.count_documents({})

    all_keys: Set[str] = set()
    for doc in samples:
        for k, _ in flatten_dict(doc):
            all_keys.add(k)

    fields_profile = {}

    for key in all_keys:
        # Find first sample containing key to establish type
        sample_val = None
        found = False
        for s in samples:
            val, ok = get_nested_val(s, key)
            if ok:
                sample_val = val
                found = True
                break
                
        if not found:
            continue
            
        field_type = get_type_string(sample_val)
        details = {}
        
        # Fetch distinct values
        try:
            # Pymongo distinct
            unique_values = collection.distinct(key)
        except Exception:
            unique_values = []
            
        # Serialize distinct values to be JSON-safe
        safe_unique = []
        for v in unique_values:
            if type(v).__name__ in ["ObjectId", "datetime"]:
                safe_unique.append(str(v))
            else:
                safe_unique.append(v)
                
        details["is_categorical"] = len(safe_unique) < 25
        details["values_sample"] = safe_unique[:10]

        if field_type == "string":
            if len(safe_unique) < 25:
                details["cardinality"] = "low"
                details["allowed_values"] = safe_unique
            else:
                details["cardinality"] = "high"
                
        elif field_type == "number":
            # Scale Check via aggregation
            pipeline = [
                {"$group": {
                    "_id": None,
                    "min": {"$min": f"${key}"},
                    "max": {"$max": f"${key}"},
                    "mean": {"$avg": f"${key}"}
                }}
            ]
            try:
                stats = list(collection.aggregate(pipeline))
                if stats and stats[0]:
                    details["scale"] = {
                        "min": stats[0]["min"],
                        "max": stats[0]["max"],
                        "mean": stats[0]["mean"]
                    }
            except Exception:
                pass

        fields_profile[key] = {
            "type": field_type,
            **details
        }

    return {
        "fields": fields_profile,
        "row_count": row_count
    }

def main():
    parser = argparse.ArgumentParser(description="Standalone MongoDB Schema Profiler.")
    parser.add_argument("--db", default="agentic_db", help="Target MongoDB database name.")
    parser.add_argument("--collection", help="Target collection name. If not specified, profiles all collections.")
    
    args = parser.parse_args()

    uri = os.getenv("MONGODB_URI")
    if not uri:
        # Fallback to local MongoDB
        uri = "mongodb://localhost:27017"

    try:
        client = MongoClient(uri)
        db = client[args.db]
        
        profile_result = {}
        
        if args.collection:
            # Profile single collection
            profile_result[args.collection] = profile_collection(db, args.collection)
        else:
            # Profile all collections
            collections = [c["name"] for c in db.list_collections() if not c["name"].startswith("system.")]
            for col in collections:
                profile_result[col] = profile_collection(db, col)
                
        print(json.dumps(profile_result, indent=2, default=str))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
