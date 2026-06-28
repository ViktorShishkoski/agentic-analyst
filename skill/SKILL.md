---
name: data-analysis
description: Trigger this skill for all tasks related to data analysis, data visualization, file exploration (CSV, JSON, Parquet), charting, creating dashboards, profiling database schemas, or exporting analytical results. Use this when the user requests insights from data or plots representing statistical metrics.
---

# Data Analysis & Visualization Skill

This skill equips the agent to ingest, explore, profile, visualize, and export structured data from file uploads or live databases.

## Protocols

### 1. Data Ingestion Protocol
- **Supported Formats**: CSV, JSON (including JSON Lines), and Apache Parquet.
- **Auto-Detection**: Use `skill/scripts/ingest_detector.py` to identify file format, delimiters, encodings, and infer schema type information.
- **BOM Handling**: Handle Byte Order Marks (BOM) properly when parsing text files.

### 2. Interactive Exploration Protocol
- Construct database queries or Pandas operations to filter, slice, and group data.
- Profile columns using statistical metrics: min, max, mean, std, cardinality, and uniqueness.

### 3. Visualization Rendering Protocol
- **Engine**: Plotly-based styling.
- **Theme**: Premium warm-neutral dark background with amber-gold and slate-teal accent colors.
- **Outputs**: High-resolution 300 DPI static PNG plots and interactive HTML visualizations.
- **Chart Selection**: Map the request to the correct chart type (Bar, Line, Scatter, Pie, Histogram, Heatmap, Box).

### 4. Export Protocol
- Export analytical charts to SVG/PDF and tabular data to CSV/Excel formats using `skill/scripts/export_handler.py`.

### 5. Collaboration Scaffold
- Generate shareable HTML views and embed summaries or dashboards inside client reports.
