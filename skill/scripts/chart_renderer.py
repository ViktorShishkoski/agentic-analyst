import os
import sys
import json
import uuid
import pandas as pd
from typing import Dict, Any, Optional

# Premium warm theme color constants
BG_COLOR = "#0f1117"
PANEL_COLOR = "#161922"
BORDER_COLOR = "#2a2d37"
TEXT_COLOR = "#E8E4DF"
AMBER_GOLD = "#D4A853"
SLATE_TEAL = "#5B8A8A"
GOLD_LIGHT = "#E5B86A"
TEAL_LIGHT = "#6B9A9A"
MUTED_TEXT = "#918D86"

COLOR_PALETTE = [AMBER_GOLD, SLATE_TEAL, GOLD_LIGHT, TEAL_LIGHT, "#C4963C", "#4A7A7A"]

def load_data(data_path: str) -> pd.DataFrame:
    """Loads CSV or JSON data from path."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data source not found at: {data_path}")

    # Detect by file extension
    ext = os.path.splitext(data_path)[1].lower()
    if ext == '.csv':
        return pd.read_csv(data_path)
    
    # Try reading as JSON
    try:
        return pd.read_json(data_path)
    except Exception:
        # Try JSON Lines
        try:
            return pd.read_json(data_path, lines=True)
        except Exception as e:
            raise ValueError(f"Failed to parse JSON file {data_path}: {str(e)}")

def process_data(df: pd.DataFrame, x: str, y: Optional[str]) -> pd.DataFrame:
    """Standardizes types for plotting."""
    if df.empty:
        return df
    
    if x in df.columns:
        df[x] = df[x].astype(str)
        
    if y and y in df.columns:
        df[y] = pd.to_numeric(df[y], errors='coerce')
        
    return df

def generate_plotly_plot(df: pd.DataFrame, config: Dict[str, Any], output_path: str, html_output_path: Optional[str] = None) -> bool:
    """
    Generates a Plotly chart and saves as static PNG and optional HTML.
    Returns True on success, False if Kaleido fails.
    """
    import plotly.express as px
    import plotly.graph_objects as go

    plot_type = config.get("plot_type", "bar")
    x = config.get("x")
    y = config.get("y")
    title = config.get("title", "Data Visualization")
    color_by = config.get("color_by")
    sort_by = config.get("sort_by")
    orientation = config.get("orientation", "v")

    if sort_by and sort_by in df.columns:
        df = df.sort_values(by=sort_by)

    # Base figure instantiation
    fig = None
    
    if plot_type == "bar":
        fig = px.bar(
            df, x=x, y=y, 
            color=color_by if color_by in df.columns else None,
            orientation=orientation,
            color_discrete_sequence=COLOR_PALETTE,
            title=title
        )
        if orientation == 'h':
            # Swap x and y labels
            fig.update_layout(xaxis_title=y, yaxis_title=x)
            
    elif plot_type == "line":
        fig = px.line(
            df, x=x, y=y,
            color=color_by if color_by in df.columns else None,
            color_discrete_sequence=COLOR_PALETTE,
            title=title,
            markers=True
        )
        
    elif plot_type == "scatter":
        fig = px.scatter(
            df, x=x, y=y,
            color=color_by if color_by in df.columns else None,
            color_discrete_sequence=COLOR_PALETTE,
            title=title,
            trendline="ols" if (df[x].dtype in ['int64', 'float64'] and df[y].dtype in ['int64', 'float64']) else None
        )
        
    elif plot_type == "pie":
        fig = px.pie(
            df, names=x, values=y,
            color_discrete_sequence=COLOR_PALETTE,
            title=title
        )
        
    elif plot_type == "histogram":
        fig = px.histogram(
            df, x=x, y=y,
            color_discrete_sequence=COLOR_PALETTE,
            title=title
        )
        
    elif plot_type == "heatmap":
        # Expecting x and y to map to columns, and y to be the value column
        pivot_df = df.pivot_table(index=y, columns=x, aggfunc='size', fill_value=0) if not y else df.pivot(index=y, columns=x, values=y)
        fig = px.imshow(
            pivot_df,
            color_continuous_scale=[[0, BG_COLOR], [0.5, SLATE_TEAL], [1, AMBER_GOLD]],
            title=title
        )
        
    elif plot_type == "box":
        fig = px.box(
            df, x=x, y=y,
            color_discrete_sequence=COLOR_PALETTE,
            title=title
        )
    
    if not fig:
        # Fallback to a simple bar chart
        fig = px.bar(df, x=x, y=y, color_discrete_sequence=COLOR_PALETTE, title=title)

    # Style layout with premium dark theme
    fig.update_layout(
        paper_bgcolor=BG_COLOR,
        plot_bgcolor=BG_COLOR,
        font=dict(color=TEXT_COLOR, family="DM Sans, sans-serif"),
        title=dict(
            font=dict(color=AMBER_GOLD, size=18, family="DM Sans, sans-serif"),
            pad=dict(t=10, b=10)
        ),
        xaxis=dict(
            gridcolor=BORDER_COLOR,
            linecolor=BORDER_COLOR,
            tickfont=dict(color=MUTED_TEXT),
            titlefont=dict(color=TEXT_COLOR)
        ),
        yaxis=dict(
            gridcolor=BORDER_COLOR,
            linecolor=BORDER_COLOR,
            tickfont=dict(color=MUTED_TEXT),
            titlefont=dict(color=TEXT_COLOR),
            tickformat=",.2s" # abbreviate large numbers
        ),
        legend=dict(
            bgcolor=PANEL_COLOR,
            bordercolor=BORDER_COLOR,
            borderwidth=1
        ),
        margin=dict(l=60, r=40, t=60, b=60)
    )

    # Auto rotate x labels if too many items
    if len(df) > 8:
        fig.update_layout(xaxis_tickangle=-45)

    # Save HTML if requested
    if html_output_path:
        fig.write_html(html_output_path, include_plotlyjs="cdn")

    # Try saving PNG static image using kaleido
    try:
        fig.write_image(output_path, scale=2) # 2x scale for higher resolution
        return True
    except Exception as e:
        print(f"Plotly write_image failed: {str(e)}. Falling back to Matplotlib.", file=sys.stderr)
        return False

def generate_matplotlib_fallback(df: pd.DataFrame, config: Dict[str, Any], output_path: str):
    """Fallback plotting engine using Matplotlib & Seaborn in case Plotly/Kaleido fails."""
    import matplotlib.pyplot as plt
    import seaborn as sns
    from matplotlib.ticker import FuncFormatter

    plot_type = config.get("plot_type", "bar")
    x = config.get("x")
    y = config.get("y")
    title = config.get("title", "Data Visualization")
    orientation = config.get("orientation", "v")

    # Set up matplotlib styles
    plt.rcParams.update({
        "figure.facecolor": BG_COLOR,
        "axes.facecolor": BG_COLOR,
        "axes.edgecolor": BORDER_COLOR,
        "axes.grid": True,
        "grid.color": BORDER_COLOR,
        "grid.linestyle": "-",
        "grid.linewidth": 0.5,
        "text.color": TEXT_COLOR,
        "axes.labelcolor": TEXT_COLOR,
        "xtick.color": MUTED_TEXT,
        "ytick.color": MUTED_TEXT,
        "font.family": "sans-serif",
        "legend.facecolor": PANEL_COLOR,
        "legend.edgecolor": BORDER_COLOR,
    })

    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    
    if plot_type == "bar":
        if orientation == 'h':
            sns.barplot(data=df, y=x, x=y, color=AMBER_GOLD, ax=ax, edgecolor=PANEL_COLOR)
        else:
            sns.barplot(data=df, x=x, y=y, color=AMBER_GOLD, ax=ax, edgecolor=PANEL_COLOR)
            
    elif plot_type == "line":
        sns.lineplot(data=df, x=x, y=y, color=SLATE_TEAL, marker='o', markerfacecolor=AMBER_GOLD, markersize=6, ax=ax)
        # Area fill
        ax.fill_between(df[x], df[y], color=SLATE_TEAL, alpha=0.15)
        
    elif plot_type == "scatter":
        sns.scatterplot(data=df, x=x, y=y, color=SLATE_TEAL, s=80, ax=ax, edgecolors="white")
        
    elif plot_type == "pie":
        # Pie chart doesn't use grids
        ax.grid(False)
        colors = COLOR_PALETTE[:len(df[x].unique())]
        df.groupby(x)[y].sum().plot(kind='pie', autopct='%1.1f%%', colors=colors, ax=ax, textprops={'color': TEXT_COLOR})
        ax.set_ylabel('')
        
    elif plot_type == "histogram":
        sns.histplot(data=df, x=x, y=y, color=AMBER_GOLD, kde=True, ax=ax)
        
    elif plot_type == "box":
        sns.boxplot(data=df, x=x, y=y, color=SLATE_TEAL, ax=ax)
        
    else:
        sns.barplot(data=df, x=x, y=y, color=AMBER_GOLD, ax=ax)

    # Formatting axis & titles
    ax.set_title(title, fontsize=16, fontweight='bold', color=AMBER_GOLD, pad=15)
    ax.set_xlabel(x.replace('_', ' ').title(), fontsize=11, fontweight='bold')
    if y:
        ax.set_ylabel(y.replace('_', ' ').title(), fontsize=11, fontweight='bold')
        # Large number abbreviation
        ax.yaxis.set_major_formatter(FuncFormatter(lambda val, pos: f'{val*1e-6:.1f}M' if val >= 1e6 else f'{val*1e-3:.1f}K' if val >= 1e3 else f'{val:.0f}'))

    # Rotate labels if crowded
    if len(df) > 6:
        plt.xticks(rotation=45, ha='right')

    plt.figtext(0.9, 0.02, "Source: Agentic Analyst", ha="right", fontsize=8, color=MUTED_TEXT)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, facecolor=BG_COLOR)
    plt.close()

def main():
    if len(sys.argv) < 2:
        print("CRITICAL ERROR: Configuration file path not provided.", file=sys.stderr)
        sys.exit(1)

    config_path = sys.argv[1]
    if not os.path.exists(config_path):
        print(f"CRITICAL ERROR: Configuration file not found at: {config_path}", file=sys.stderr)
        sys.exit(1)

    with open(config_path, 'r') as f:
        config = json.load(f)

    data_path = config.get("data_path", "analysis_output.json")
    x = config.get("x")
    y = config.get("y")

    try:
        df = load_data(data_path)
        df = process_data(df, x, y)

        # Output folder logic
        data_filename = os.path.basename(data_path)
        if "data_" in data_filename:
            uid = data_filename.split("data_")[-1].replace(".json", "")
        else:
            uid = str(uuid.uuid4())[:8]

        output_dir = "public/temp_plots"
        os.makedirs(output_dir, exist_ok=True)
        temp_plot_path = os.path.join(output_dir, f"plot_{uid}.png")
        temp_html_path = os.path.join(output_dir, f"plot_{uid}.html")

        # Try Plotly first, fallback to Matplotlib
        success = False
        try:
            import plotly
            success = generate_plotly_plot(df, config, temp_plot_path, temp_html_path)
        except ImportError:
            print("Plotly not installed, using Matplotlib fallback.", file=sys.stderr)

        if not success:
            generate_matplotlib_fallback(df, config, temp_plot_path)

        # Create copy as plot_output.png in root/backend for node to find
        import shutil
        shutil.copy(temp_plot_path, "plot_output.png")

        print(f"SUCCESS: Plot generated successfully and saved to {temp_plot_path}")
    except Exception as e:
        print(f"CRITICAL ERROR during chart generation: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
