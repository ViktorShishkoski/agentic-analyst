import re
from typing import Dict, Any, List, Set
from bson import ObjectId
from pymongo import MongoClient

def flatten_document(doc: Any, prefix: str = "", path_types: Dict[str, Set[str]] = None, path_values: Dict[str, List[Any]] = None) -> None:
    """
    Recursively flattens a document, collecting all encountered types and values per dot-notation path.
    """
    if path_types is None:
        path_types = {}
    if path_values is None:
        path_values = {}

    def get_type_name(val: Any) -> str:
        if val is None:
            return "Null"
        if isinstance(val, bool):
            return "Boolean"
        if isinstance(val, int):
            return "Integer"
        if isinstance(val, float):
            return "Double"
        if isinstance(val, str):
            return "String"
        if isinstance(val, ObjectId):
            return "ObjectId"
        if isinstance(val, list):
            return "Array"
        if isinstance(val, dict):
            return "Object"
        return type(val).__name__

    if isinstance(doc, dict):
        for key, value in doc.items():
            full_path = f"{prefix}.{key}" if prefix else key
            t_name = get_type_name(value)
            
            if full_path not in path_types:
                path_types[full_path] = set()
                path_values[full_path] = []
            path_types[full_path].add(t_name)
            
            if t_name not in ("Object", "Array", "Null"):
                path_values[full_path].append(value)
                
            if isinstance(value, dict):
                flatten_document(value, full_path, path_types, path_values)
            elif isinstance(value, list):
                # Sample array elements if they are objects
                for item in value[:5]:
                    if isinstance(item, dict):
                        flatten_document(item, f"{full_path}[]", path_types, path_values)
                    else:
                        item_type = get_type_name(item)
                        array_item_path = f"{full_path}[]"
                        if array_item_path not in path_types:
                            path_types[array_item_path] = set()
                            path_values[array_item_path] = []
                        path_types[array_item_path].add(item_type)
                        if item_type not in ("Object", "Array", "Null"):
                            path_values[array_item_path].append(item)
    return path_types, path_values

def run_maximum_schema_discovery(mongo_uri: str, db_name: str, collection_name: str) -> Dict[str, Any]:
    """
    Performs defensive maximum-level schema discovery on a target MongoDB collection.
    """
    client = MongoClient(mongo_uri)
    try:
        db = client[db_name]
        col = db[collection_name]
        
        # 1. Statistical Sampling
        total_docs = col.estimated_document_count()
        sample_size = min(1000, total_docs) if total_docs > 0 else 0
        
        if total_docs > 5000:
            samples = list(col.aggregate([{"$sample": {"size": 1000}}]))
        else:
            samples = list(col.find().limit(1000))
            
        actual_sample_count = len(samples)
        
        path_types = {}
        path_values = {}
        path_occurrences = {}
        
        for doc in samples:
            doc_types, doc_values = flatten_document(doc, "", {}, {})
            for path in doc_types.keys():
                if path not in path_types:
                    path_types[path] = set()
                    path_values[path] = []
                    path_occurrences[path] = 0
                path_types[path].update(doc_types[path])
                path_values[path].extend(doc_values[path])
                path_occurrences[path] += 1
                
        # Get index information
        indexes = {}
        try:
            for idx in col.list_indexes():
                idx_name = idx.get("name")
                idx_key = list(idx.get("key", {}).keys())
                indexes[idx_name] = idx_key
        except Exception:
            pass

        # 2. Extract collection list to infer relationships
        all_collections = db.list_collection_names()
        
        fields_manifest = {}
        relationships = []
        
        for path, types in path_types.items():
            occurrence_count = path_occurrences[path]
            density = occurrence_count / actual_sample_count if actual_sample_count > 0 else 0.0
            
            # Format types & check for polymorphism
            types_list = list(types)
            is_polymorphic = len(types_list) > 1
            
            # Numeric analysis
            min_val = None
            max_val = None
            numeric_vals = [v for v in path_values[path] if isinstance(v, (int, float))]
            if numeric_vals:
                min_val = min(numeric_vals)
                max_val = max(numeric_vals)
                
            # Index coverage check
            is_indexed = any(path in keys for keys in indexes.values())
            
            fields_manifest[path] = {
                "types": types_list,
                "density": round(density, 4),
                "optional": density < 1.0,
                "polymorphic": is_polymorphic,
                "indexed": is_indexed,
            }
            if min_val is not None:
                fields_manifest[path]["range"] = {"min": min_val, "max": max_val}
                
            # 3. Implicit Relationship Inference
            # Check keys ending in '_id', 'Id', or matching collection names
            clean_key = path.split(".")[-1]
            if clean_key.lower().endswith("id") or clean_key.lower().endswith("_id") or clean_key == "_id":
                # Attempt to find a matching target collection
                target_cand = re.sub(r'(_id|id)$', '', clean_key, flags=re.IGNORECASE).strip("_")
                for other_col in all_collections:
                    # Match clean candidate to other collections
                    if target_cand.lower() == other_col.lower() or (other_col.lower().endswith("s") and target_cand.lower() == other_col[:-1].lower()):
                        relationships.append({
                            "local_field": path,
                            "foreign_collection": other_col,
                            "foreign_field": "_id",
                            "inference_reason": f"Naming alignment with collection '{other_col}'"
                        })
                        break
                    
        # 4. Metadata Compression Manifest
        manifest = {
            "collection": collection_name,
            "total_estimated_documents": total_docs,
            "sample_size_profiled": actual_sample_count,
            "indexes": indexes,
            "fields": fields_manifest,
            "suspected_relationships": relationships
        }
        
        return manifest
        
    finally:
        client.close()

if __name__ == "__main__":
    import os
    import json
    from dotenv import load_dotenv
    
    load_dotenv()
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27019/agentic_db")
    db_name = os.getenv("DB_NAME", "agentic_db")
    
    print("Testing Python maximum schema discovery on 'sales_data'...")
    try:
        res = run_maximum_schema_discovery(uri, db_name, "sales_data")
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(f"Discovery failed: {e}")
