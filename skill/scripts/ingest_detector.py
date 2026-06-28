import os
import sys
import json
import csv
import codecs
from typing import Dict, List, Any, Tuple, Optional

# Try importing pandas to assist type inference, but make it optional
try:
    import pandas as pd
except ImportError:
    pd = None

def detect_format_and_encoding(filepath: str) -> Tuple[str, str, Optional[str]]:
    """
    Detects format (parquet, csv, json, jsonl), encoding (utf-8, utf-16, etc.), and delimiter if csv.
    """
    # Check for Parquet magic bytes
    if os.path.getsize(filepath) >= 4:
        with open(filepath, 'rb') as f:
            magic = f.read(4)
            if magic == b'PAR1':
                return 'parquet', 'binary', None

    # Detect encoding using standard BOM marks or fallback to UTF-8
    encoding = 'utf-8'
    bom_encodings = [
        (codecs.BOM_UTF8, 'utf-8-sig'),
        (codecs.BOM_UTF16_LE, 'utf-16'),
        (codecs.BOM_UTF16_BE, 'utf-16'),
        (codecs.BOM_UTF32_LE, 'utf-32'),
        (codecs.BOM_UTF32_BE, 'utf-32'),
    ]
    with open(filepath, 'rb') as f:
        raw = f.read(4)
        for bom, enc in bom_encodings:
            if raw.startswith(bom):
                encoding = enc
                break

    # Read preview lines to distinguish CSV vs JSON vs JSON Lines
    preview_bytes = b""
    try:
        with open(filepath, 'rb') as f:
            # Skip BOM if present
            for bom, enc in bom_encodings:
                if raw.startswith(bom):
                    f.seek(len(bom))
                    break
            preview_bytes = f.read(4096)
    except Exception:
        pass

    try:
        preview_text = preview_bytes.decode(encoding, errors='replace')
    except Exception:
        preview_text = preview_bytes.decode('utf-8', errors='replace')
        encoding = 'utf-8'

    preview_stripped = preview_text.strip()
    
    # Check if JSON or JSONL
    if preview_stripped.startswith('[') or preview_stripped.startswith('{'):
        # Could be JSON or JSON Lines
        # Let's try parsing as standard JSON
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                json.load(f)
            return 'json', encoding, None
        except Exception:
            # If standard JSON fails, let's see if it's JSON Lines
            lines = preview_stripped.split('\n')
            if len(lines) > 0:
                try:
                    json.loads(lines[0])
                    return 'jsonl', encoding, None
                except Exception:
                    pass

    # Default to CSV, and detect delimiter
    delimiters = [',', ';', '\t', '|']
    delimiter_counts = {d: 0 for d in delimiters}
    lines = preview_stripped.split('\n')[:5]
    for line in lines:
        for d in delimiters:
            delimiter_counts[d] += line.count(d)
    
    best_delim = ','
    max_count = -1
    for d, count in delimiter_counts.items():
        if count > max_count:
            max_count = count
            best_delim = d

    # If no delimiters found, stick to comma
    if max_count == 0:
        best_delim = ','

    return 'csv', encoding, best_delim

def infer_column_types(filepath: str, file_format: str, encoding: str, delimiter: Optional[str]) -> Tuple[List[Dict[str, Any]], int]:
    """
    Infers column names, types, sample values, null counts, and total row count.
    """
    columns = []
    row_count = 0

    if pd is not None:
        try:
            if file_format == 'parquet':
                df = pd.read_parquet(filepath)
            elif file_format == 'json':
                df = pd.read_json(filepath)
            elif file_format == 'jsonl':
                df = pd.read_json(filepath, lines=True)
            else: # csv
                df = pd.read_csv(filepath, sep=delimiter, encoding=encoding)
            
            row_count = len(df)
            for col in df.columns:
                series = df[col]
                null_count = int(series.isna().sum())
                non_nulls = series.dropna()
                
                # Sample values (up to 5 unique values)
                sample_values = non_nulls.unique()[:5].tolist()
                # Ensure values are JSON serializable
                sample_values = [str(x) if not isinstance(x, (int, float, bool, str)) else x for x in sample_values]

                # Determine type
                dtype_str = str(series.dtype)
                inferred_type = 'string'
                
                if 'int' in dtype_str:
                    inferred_type = 'numeric'
                elif 'float' in dtype_str:
                    inferred_type = 'numeric'
                elif 'bool' in dtype_str:
                    inferred_type = 'boolean'
                elif 'datetime' in dtype_str or 'date' in dtype_str:
                    inferred_type = 'datetime'
                else:
                    # Try converting strings to datetime or numeric
                    # Check if series contains datetimes
                    try:
                        parsed_dates = pd.to_datetime(non_nulls, errors='raise')
                        # Don't convert purely numeric strings to datetime
                        if not all(isinstance(x, (int, float)) for x in non_nulls.head(5)):
                            inferred_type = 'datetime'
                    except Exception:
                        try:
                            pd.to_numeric(non_nulls, errors='raise')
                            inferred_type = 'numeric'
                        except Exception:
                            # Check if categorical
                            unique_ratio = len(non_nulls.unique()) / max(1, len(non_nulls))
                            if unique_ratio < 0.15 or len(non_nulls.unique()) < 25:
                                inferred_type = 'categorical'
                            else:
                                inferred_type = 'string'
                
                columns.append({
                    "name": str(col),
                    "type": inferred_type,
                    "sample_values": sample_values,
                    "null_count": null_count
                })
            return columns, row_count
        except Exception as e:
            # Fall back to pure python parsing if pandas fails
            pass

    # Pure Python fallback parser
    if file_format == 'csv':
        try:
            with open(filepath, 'r', encoding=encoding, errors='replace') as f:
                reader = csv.reader(f, delimiter=delimiter)
                headers = next(reader, None)
                if not headers:
                    return [], 0
                
                row_data = []
                for row in reader:
                    row_data.append(row)
                    row_count += 1
                
                row_count += 1 # Include header in row count estimate if counting rows
                # Let's rebuild the column profile
                for i, col_name in enumerate(headers):
                    col_vals = []
                    null_cnt = 0
                    for r in row_data:
                        if i < len(r):
                            val = r[i].strip()
                            if val == "" or val.lower() in ['null', 'nan', 'none']:
                                null_cnt += 1
                            else:
                                col_vals.append(val)
                        else:
                            null_cnt += 1

                    # Type inference on strings
                    unique_vals = list(set(col_vals))
                    sample = unique_vals[:5]
                    
                    # Try to parse
                    is_num = True
                    is_bool = True
                    for val in col_vals[:100]:
                        try:
                            float(val)
                        except ValueError:
                            is_num = False
                        if val.lower() not in ['true', 'false', '1', '0', 'yes', 'no']:
                            is_bool = False

                    if is_num:
                        inferred = 'numeric'
                        sample = [float(x) for x in sample]
                    elif is_bool:
                        inferred = 'boolean'
                    elif len(unique_vals) < 25 or (len(col_vals) > 0 and len(unique_vals)/len(col_vals) < 0.15):
                        inferred = 'categorical'
                    else:
                        inferred = 'string'

                    columns.append({
                        "name": col_name,
                        "type": inferred,
                        "sample_values": sample,
                        "null_count": null_cnt
                    })
                return columns, len(row_data)
        except Exception:
            pass

    return [], 0

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided. Usage: python ingest_detector.py <filepath>"}))
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(json.dumps({"error": f"File not found: {filepath}"}))
        sys.exit(1)

    try:
        fmt, encoding, delimiter = detect_format_and_encoding(filepath)
        columns, row_count = infer_column_types(filepath, fmt, encoding, delimiter)
        
        result = {
            "format": fmt,
            "delimiter": delimiter,
            "encoding": encoding,
            "columns": columns,
            "row_count": row_count
        }
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
