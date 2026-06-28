import json
import os
import sys
import uuid
from typing import Dict, List, Any, Optional, Union
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pymongo import MongoClient
from matplotlib.ticker import FuncFormatter

class CyberpunkTheme:
    """
    Custom theme engine configured for a bright look with Orange & Lightish Blue.
    """
    BG_COLOR = "#ffffff"
    GRID_COLOR = "#edf2f7"
    TEXT_COLOR = "#2d3748"
    CYAN = "#00A8E8"       # Lightish Blue
    MAGENTA = "#FF6B35"    # Orange
    GRAY = "#718096"

    @classmethod
    def apply(cls):
        """Applies the cyberpunk theme to matplotlib rcParams."""
        plt.rcParams.update({
            "figure.facecolor": cls.BG_COLOR,
            "axes.facecolor": cls.BG_COLOR,
            "axes.edgecolor": cls.GRID_COLOR,
            "axes.grid": True,
            "grid.color": cls.GRID_COLOR,
            "grid.linestyle": "--",
            "grid.linewidth": 0.5,
            "text.color": cls.TEXT_COLOR,
            "axes.labelcolor": cls.CYAN,
            "xtick.color": cls.TEXT_COLOR,
            "ytick.color": cls.TEXT_COLOR,
            "font.family": "monospace",
            "legend.facecolor": cls.BG_COLOR,
            "legend.edgecolor": cls.GRID_COLOR,
        })

class AnalystEngine:
    """
    Universal Analyst Engine for data processing and visualization.
    """
    def __init__(self, db_uri: Optional[str] = None):
        self.db_uri = db_uri or os.getenv("MONGODB_URI")
        self.client: Optional[MongoClient] = None
        self.theme = CyberpunkTheme()

    def _get_client(self) -> MongoClient:
        if not self.client:
            try:
                self.client = MongoClient(self.db_uri)
            except Exception as e:
                raise ConnectionError(f"Failed to connect to MongoDB: {str(e)}")
        return self.client

    def load_data(self, source: str) -> pd.DataFrame:
        """
        Loads data from JSON file or MongoDB collection.
        """
        try:
            if source.startswith("mongodb://") or (":" in source and not os.path.exists(source)):
                return self.fetch_from_mongodb(source)
            
            if not os.path.exists(source):
                raise FileNotFoundError(f"Data source not found: {source}")
            
            return pd.read_json(source)
        except Exception as e:
            print(f"ERROR: Loading data failed: {str(e)}")
            raise

    def fetch_from_mongodb(self, collection_name: str, query: Dict = None) -> pd.DataFrame:
        """ Fetches data from MongoDB and returns a Pandas DataFrame. """
        try:
            client = self._get_client()
            db = client.get_database()
            collection = db[collection_name]
            cursor = collection.find(query or {})
            return pd.DataFrame(list(cursor))
        except Exception as e:
            print(f"ERROR: MongoDB fetch failed: {str(e)}")
            return pd.DataFrame()

    def process_data(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """
        Ensures types are correct.
        """
        if df.empty:
            return df
        
        x_col = config.get("x")
        y_col = config.get("y")

        if x_col in df.columns:
            df[x_col] = df[x_col].astype(str)
        
        if y_col in df.columns:
            df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
            
        return df

    def create_plot(self, df: pd.DataFrame, config: Dict[str, Any], output_path: str):
        """
        Generates plot based on config and saves to output_path.
        """
        self.theme.apply()
        
        plot_type = config.get("plot_type", "bar")
        x = config.get("x")
        y = config.get("y")
        title = config.get("title", "Analysis Result")

        fig, ax = plt.subplots(figsize=(10, 6), facecolor=self.theme.BG_COLOR)
        
        if plot_type == "bar":
            num_categories = df[x].nunique()
            orient = 'h' if num_categories > 5 else 'v'
            
            if orient == 'h':
                sns.barplot(data=df, y=x, x=y, color=self.theme.MAGENTA, ax=ax, edgecolor=self.theme.CYAN, linewidth=1)
            else:
                sns.barplot(data=df, x=x, y=y, color=self.theme.MAGENTA, ax=ax, edgecolor=self.theme.CYAN, linewidth=1)
                
        elif plot_type == "line":
            # Neon glowing footprint: overlay thin foreground line over thicker semi-transparent line
            sns.lineplot(data=df, x=x, y=y, color=self.theme.CYAN, linewidth=6, alpha=0.3, ax=ax, zorder=1)
            sns.lineplot(data=df, x=x, y=y, color=self.theme.CYAN, linewidth=1.5, marker='o', markerfacecolor=self.theme.MAGENTA, markeredgecolor=self.theme.TEXT_COLOR, markersize=8, ax=ax, zorder=2)
            # Fill under the line
            ax.fill_between(df[x], df[y], color=self.theme.CYAN, alpha=0.08)
            
        elif plot_type == "scatter":
            # Cross markers featuring alpha transparency
            sns.scatterplot(data=df, x=x, y=y, color=self.theme.MAGENTA, marker='x', s=120, alpha=0.7, ax=ax, zorder=2)
            # Add trend line with Cyan
            sns.regplot(data=df, x=x, y=y, scatter=False, color=self.theme.CYAN, line_kws={"linestyle": "--", "linewidth": 1.5}, ax=ax, zorder=1)
            
        elif plot_type == "pie":
            # Pie chart styled for cyberpunk themes
            colors = [self.theme.MAGENTA, self.theme.CYAN, "#ff00ffbb", "#00ffffbb", "#ff00ff77", "#00ffff77"]
            wedges, texts, autotexts = ax.pie(
                df[y], 
                labels=df[x], 
                autopct='%1.1f%%', 
                startangle=90, 
                colors=colors,
                textprops=dict(color=self.theme.TEXT_COLOR, family='monospace')
            )
            # Adjust styling of texts
            for text in texts:
                text.set_color(self.theme.TEXT_COLOR)
            for autotext in autotexts:
                autotext.set_color(self.theme.BG_COLOR)
                autotext.set_weight('bold')
            ax.axis('equal')
            # Gridlines not needed for pie
            ax.grid(False)
        
        else:
            sns.barplot(data=df, x=x, y=y, color=self.theme.MAGENTA, ax=ax)

        # Formatting
        # Align title to top-left with heavy weight and clear padding
        ax.set_title(title, loc="left", fontsize=16, fontweight='bold', color=self.theme.MAGENTA, pad=25)
        
        # Grid/labels formatting
        if plot_type != "pie":
            ax.set_xlabel(x.replace('_', ' ').title(), fontsize=11, fontweight='bold', color=self.theme.CYAN, labelpad=10)
            ax.set_ylabel(y.replace('_', ' ').title(), fontsize=11, fontweight='bold', color=self.theme.CYAN, labelpad=10)
            ax.yaxis.set_major_formatter(FuncFormatter(lambda val, pos: format(int(val), ',')))
            ax.tick_params(colors=self.theme.TEXT_COLOR, labelsize=9)
        else:
            ax.set_xlabel("")
            ax.set_ylabel("")

        # Caption
        plt.figtext(0.95, 0.02, "Source: Agentic Analyst (Python HUD Edition)", ha="right", fontsize=8, color=self.theme.GRAY, family="monospace")
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=300, facecolor=self.theme.BG_COLOR)
        plt.close()
        print(f"SUCCESS: Plot saved to {output_path}")

def main():
    """ CLI entry point supporting both positional arguments and --workspace flags. """
    workspace_dir = None
    if "--workspace" in sys.argv:
        try:
            ws_idx = sys.argv.index("--workspace")
            if ws_idx + 1 < len(sys.argv):
                workspace_dir = sys.argv[ws_idx + 1]
        except ValueError:
            pass

    if workspace_dir:
        config_path = os.path.join(workspace_dir, "plot_config.json")
        output_path = os.path.join(workspace_dir, "plot_output.png")
    else:
        if len(sys.argv) < 2:
            print("CRITICAL ERROR: Configuration file path not provided.")
            sys.exit(1)
        config_path = sys.argv[1]
        output_path = "plot_output.png"

    if not os.path.exists(config_path):
        print(f"CRITICAL ERROR: Configuration file not found at: {config_path}")
        sys.exit(1)

    with open(config_path, 'r') as f:
        config = json.load(f)

    # Standardize data paths relative to workspace if workspace active
    data_path = config.get("data_path", "analysis_output.json")
    if workspace_dir and not os.path.isabs(data_path):
        data_path = os.path.join(workspace_dir, os.path.basename(data_path))
    
    engine = AnalystEngine()
    try:
        df = engine.load_data(data_path)
        df = engine.process_data(df, config)
        
        if df.empty:
            raise ValueError("Aggregated dataset is empty. Cannot render plot.")

        engine.create_plot(df, config, output_path)
        
    except Exception as e:
        print(f"CRITICAL ERROR during visualization pipeline: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
