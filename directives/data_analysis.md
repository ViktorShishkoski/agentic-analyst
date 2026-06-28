# Standard Operating Procedure (SOP) — Data Analysis Workflow

This SOP defines the deterministic protocol for executing data analysis, visualization, profiling, and exporting tasks.

## 1. Input Processing & Format Detection
When a file path or database source is provided:
1. Run `python skill/scripts/ingest_detector.py <filepath>` to detect the format (CSV, JSON, Parquet), encoding, delimiter, and schema structure.
2. Verify if a Byte Order Mark (BOM) or encoding conversion is required.
3. Match against schema guidelines in [data_formats.md](file:///c:/Users/vikto/OneDrive/Desktop/agentic-analyst/skill/references/data_formats.md).

## 2. DB Schema Profiling
For MongoDB data sources:
1. Run `python skill/scripts/schema_profiler.py --db <dbname> [--collection <colname>]` to profile the database collections.
2. Establish cardinality for fields to determine categoricals, and scales (min/max/mean) for numeric columns.

## 3. Visualization Generation
When rendering a chart:
1. Map the analysis target to a chart type based on [chart_types.md](file:///c:/Users/vikto/OneDrive/Desktop/agentic-analyst/skill/references/chart_types.md).
2. Generate a chart configuration JSON:
   ```json
   {
     "plot_type": "bar | line | scatter | pie | histogram | heatmap | box",
     "x": "column_x",
     "y": "column_y",
     "title": "Title of Chart",
     "data_path": "path_to_in_memory_or_temp_file.json",
     "orientation": "v | h"
   }
   ```
3. Run `python skill/scripts/chart_renderer.py <config_path>` to render the plot. It will output to `public/temp_plots/plot_<uuid>.png` (and `plot_output.png` copy).

## 4. Exporting Data
To export reports:
1. Run `python skill/scripts/export_handler.py --format <csv|excel|svg|pdf> --input <input_path> --output <output_path> [--config <config_path>]`.
2. Ensure Excel spreadsheets are styled with headers using openpyxl.

## 5. Error Handling & Self-Annealing
- **Kaleido/Plotly static failures**: If Kaleido fails to render static PNGs, fall back to Matplotlib rendering automatically.
- **Mixed Data types**: Cast fields to numeric using `pd.to_numeric` with `errors='coerce'` to handle text inputs.
- **Empty Datasets**: Ensure all scripts fail gracefully with appropriate error messages instead of raising uncaught exceptions.
