import os
import sys
import argparse
import pandas as pd
import json
from typing import Optional

# Set up path so we can import chart_renderer if it's run from elsewhere
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import chart_renderer
except ImportError:
    chart_renderer = None

def load_data(filepath: str) -> pd.DataFrame:
    """Loads CSV or JSON data from filepath."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Input file not found: {filepath}")
        
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.csv':
        return pd.read_csv(filepath)
    try:
        return pd.read_json(filepath)
    except Exception:
        try:
            return pd.read_json(filepath, lines=True)
        except Exception as e:
            raise ValueError(f"Failed to load JSON: {str(e)}")

def export_csv(df: pd.DataFrame, output_path: str):
    """Exports raw data to CSV with standard quoting."""
    df.to_csv(output_path, index=False, quoting=1) # Quote all strings
    print(f"SUCCESS: Exported CSV to {output_path}")

def export_excel(df: pd.DataFrame, output_path: str):
    """Exports raw data to Excel with formatted headers using openpyxl."""
    try:
        # Excel writer using openpyxl
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Sheet1')
            
            # Format header row
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            
            # Premium warm headers
            header_fill = PatternFill(start_color='161922', end_color='161922', fill_type='solid')
            header_font = Font(name='Segoe UI', size=11, bold=True, color='D4A853')
            thin_border = Border(
                left=Side(style='thin', color='2A2D37'),
                right=Side(style='thin', color='2A2D37'),
                top=Side(style='thin', color='2A2D37'),
                bottom=Side(style='medium', color='D4A853')
            )
            
            for col_idx in range(1, len(df.columns) + 1):
                cell = worksheet.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal='center', vertical='center')
                cell.border = thin_border
                
            # Auto-adjust column widths
            for col in worksheet.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 3, 10)
                
        print(f"SUCCESS: Exported Excel to {output_path}")
    except ImportError:
        # Fallback without formatting if openpyxl is not installed
        df.to_excel(output_path, index=False)
        print(f"SUCCESS: Exported Excel (unformatted fallback) to {output_path}")

def export_chart_image(format_type: str, data_path: str, config_path: Optional[str], output_path: str):
    """Generates and exports a chart to SVG or PDF format using Plotly."""
    if not chart_renderer:
        raise ImportError("chart_renderer module is not available.")

    # Load configuration
    config = {}
    if config_path and os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
    
    # If config_path is not specified, build a simple default configuration
    if not config:
        df = load_data(data_path)
        cols = list(df.columns)
        config = {
            "plot_type": "bar",
            "x": cols[0] if cols else "",
            "y": cols[1] if len(cols) > 1 else None,
            "title": f"Exported {format_type.upper()} Chart",
            "data_path": data_path
        }
    else:
        # Ensure data_path in config points to the command line input
        config["data_path"] = data_path

    # Generate plot using plotly
    import plotly.express as px
    df = load_data(data_path)
    df = chart_renderer.process_data(df, config.get("x"), config.get("y"))

    # Recreate the plotly figure (following chart_renderer details)
    plot_type = config.get("plot_type", "bar")
    x = config.get("x")
    y = config.get("y")
    title = config.get("title", "Exported Visualization")
    color_by = config.get("color_by")
    sort_by = config.get("sort_by")
    orientation = config.get("orientation", "v")

    if sort_by and sort_by in df.columns:
        df = df.sort_values(by=sort_by)

    # Plotly generation
    if plot_type == "bar":
        fig = px.bar(df, x=x, y=y, color=color_by if color_by in df.columns else None,
                     orientation=orientation, color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title)
    elif plot_type == "line":
        fig = px.line(df, x=x, y=y, color=color_by if color_by in df.columns else None,
                      color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title, markers=True)
    elif plot_type == "scatter":
        fig = px.scatter(df, x=x, y=y, color=color_by if color_by in df.columns else None,
                         color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title)
    elif plot_type == "pie":
        fig = px.pie(df, names=x, values=y, color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title)
    elif plot_type == "histogram":
        fig = px.histogram(df, x=x, y=y, color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title)
    elif plot_type == "box":
        fig = px.box(df, x=x, y=y, color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title)
    else:
        fig = px.bar(df, x=x, y=y, color_discrete_sequence=chart_renderer.COLOR_PALETTE, title=title)

    # Apply premium layout styling
    fig.update_layout(
        paper_bgcolor=chart_renderer.BG_COLOR,
        plot_bgcolor=chart_renderer.BG_COLOR,
        font=dict(color=chart_renderer.TEXT_COLOR, family="DM Sans, sans-serif"),
        title=dict(font=dict(color=chart_renderer.AMBER_GOLD, size=18, family="DM Sans, sans-serif")),
        xaxis=dict(gridcolor=chart_renderer.BORDER_COLOR, linecolor=chart_renderer.BORDER_COLOR),
        yaxis=dict(gridcolor=chart_renderer.BORDER_COLOR, linecolor=chart_renderer.BORDER_COLOR),
        legend=dict(bgcolor=chart_renderer.PANEL_COLOR, bordercolor=chart_renderer.BORDER_COLOR, borderwidth=1),
        margin=dict(l=60, r=40, t=60, b=60)
    )

    try:
        # Save static vector/format image (svg or pdf)
        fig.write_image(output_path, format=format_type)
        print(f"SUCCESS: Exported chart as {format_type.upper()} to {output_path}")
    except Exception as e:
        # PDF fallback using matplotlib if kaleido fails
        if format_type == 'pdf':
            print("Plotly PDF export failed, using Matplotlib PDF fallback...", file=sys.stderr)
            chart_renderer.generate_matplotlib_fallback(df, config, output_path)
            print(f"SUCCESS: Exported chart as PDF (Matplotlib fallback) to {output_path}")
        else:
            raise RuntimeError(f"Failed to export Plotly chart to {format_type}: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description="Export handler for raw data and chart outputs.")
    parser.add_argument("--format", required=True, choices=["csv", "excel", "svg", "pdf"], help="Output format.")
    parser.add_argument("--input", required=True, help="Input data file path.")
    parser.add_argument("--output", required=True, help="Output destination path.")
    parser.add_argument("--config", help="Optional chart configuration JSON path for SVG/PDF exports.")
    
    args = parser.parse_args()

    try:
        if args.format == "csv":
            df = load_data(args.input)
            export_csv(df, args.output)
        elif args.format == "excel":
            df = load_data(args.input)
            export_excel(df, args.output)
        elif args.format in ["svg", "pdf"]:
            export_chart_image(args.format, args.input, args.config, args.output)
    except Exception as e:
        print(f"CRITICAL ERROR during export: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
