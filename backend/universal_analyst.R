#!/usr/bin/env Rscript

# UNIVERSAL VISUALIZATION TEMPLATE - V4 (Cyberpunk Edition)
# ---------------------------------------------------------
# Reads a structured JSON config and generates ggplot2 plots.
# Supports isolated workspace CLI flags.

# 1. Package Management
if (!require("jsonlite")) install.packages("jsonlite", repos = "http://cran.us.r-project.org")
if (!require("ggplot2")) install.packages("ggplot2", repos = "http://cran.us.r-project.org")
if (!require("scales")) install.packages("scales", repos = "http://cran.us.r-project.org")
library(jsonlite)
library(ggplot2)
library(scales)

# 2. Argument Parsing (Check for --workspace flag)
args <- commandArgs(trailingOnly = TRUE)
workspace_dir <- NULL

if ("--workspace" %in% args) {
  ws_idx <- which(args == "--workspace")
  if (ws_idx + 1 <= length(args)) {
    workspace_dir <- args[ws_idx + 1]
  }
}

if (!is.null(workspace_dir)) {
  config_path <- file.path(workspace_dir, "plot_config.json")
  output_path <- file.path(workspace_dir, "plot_output.png")
} else {
  if (length(args) < 1) {
    stop("CRITICAL ERROR: Configuration file path not provided.")
  }
  config_path <- args[1]
  output_path <- "plot_output.png"
}

if (!file.exists(config_path)) {
  stop(paste("CRITICAL ERROR: Configuration file not found at:", config_path))
}

config <- fromJSON(config_path)

# Resolve data path relative to workspace if active
data_path <- config$data_path
if (!is.null(workspace_dir) && !grepl("^/", data_path) && !grepl("^[A-Za-z]:", data_path)) {
  data_path <- file.path(workspace_dir, basename(data_path))
}

if (!file.exists(data_path)) {
  stop(paste("CRITICAL ERROR: Data file not found at:", data_path))
}

# Load Data
df <- fromJSON(data_path)

if (is.list(df) && !is.data.frame(df)) {
  df <- as.data.frame(df)
}

if (nrow(df) == 0) {
  stop("CRITICAL ERROR: Loaded dataset contains 0 records. Cannot plot.")
}

# Force Types to prevent ggplot2 errors
df$category <- as.character(df[[config$x]])
df$value <- as.numeric(df[[config$y]])

# 3. Theme Definition: Cyberpunk
theme_cyberpunk <- function() {
  theme_minimal() +
    theme(
      # Background and Canvas
      plot.background = element_rect(fill = "#0a0a0b", color = NA),
      panel.background = element_rect(fill = "#0a0a0b", color = NA),
      
      # Gridlines: dashed and muted dark gray
      panel.grid.major = element_line(color = "#323232", size = 0.2, linetype = "dashed"),
      panel.grid.minor = element_line(color = "#323232", size = 0.1, linetype = "dashed"),
      
      # Text and Fonts (monospace)
      text = element_text(color = "#ffffff", family = "mono"),
      axis.text = element_text(color = "#ffffff", size = 9),
      axis.title = element_text(color = "#00ffff", face = "bold", size = 11),
      
      # Top-left aligned title with padding (hjust = 0)
      plot.title = element_text(color = "#ff00ff", face = "bold", size = 16, hjust = 0, margin = margin(b = 25)),
      plot.caption = element_text(color = "#555555", size = 8, hjust = 1, margin = margin(t = 15)),
      
      # Legends
      legend.background = element_rect(fill = "#0a0a0b", color = "#323232"),
      legend.text = element_text(color = "#ffffff"),
      legend.title = element_text(color = "#00ffff", face = "bold"),
      
      # Margins
      plot.margin = margin(20, 20, 20, 20)
    )
}

# 4. Rendering Logic
plot_type <- config$plot_type

if (plot_type == "bar") {
  num_categories <- length(unique(df$category))
  p <- ggplot(df, aes(x = category, y = value)) +
       geom_col(fill = "#ff00ff", color = "#00ffff", size = 0.5, width = 0.7)
       
  if (num_categories > 5) {
    p <- p + coord_flip()
  }
  
} else if (plot_type == "line") {
  # Neon glow footprint: overlay thin bright line over thicker semi-transparent line
  p <- ggplot(df, aes(x = category, y = value)) +
       geom_area(aes(group = 1), fill = "#00ffff", alpha = 0.08) +
       geom_line(aes(group = 1), color = "#00ffff", size = 3.5, alpha = 0.3) +
       geom_line(aes(group = 1), color = "#00ffff", size = 1) +
       geom_point(color = "#ff00ff", size = 3)
       
} else if (plot_type == "scatter") {
  # Cross shape with alpha transparency & trend line
  df$x_numeric <- as.numeric(as.factor(df$category))
  p <- ggplot(df, aes(x = x_numeric, y = value)) +
       geom_point(color = "#ff00ff", shape = 4, size = 4, stroke = 1.5, alpha = 0.7) +
       geom_smooth(method = "lm", color = "#00ffff", linetype = "dashed", size = 1, se = FALSE) +
       scale_x_continuous(breaks = 1:nrow(df), labels = df$category)
       
} else if (plot_type == "pie") {
  p <- ggplot(df, aes(x = "", y = value, fill = category)) +
       geom_bar(stat = "identity", width = 1, color = "#0a0a0b") +
       coord_polar("y", start = 0) +
       scale_fill_manual(values = c("#ff00ff", "#00ffff", "#ff00ffaa", "#00ffffaa", "#ff00ff55", "#00ffff55"))
       
} else {
  # Fallback
  p <- ggplot(df, aes(x = category, y = value)) +
       geom_col(fill = "#ff00ff")
}

# Apply Labels and Cyberpunk Theme
cap_x <- tools::toTitleCase(config$x)
cap_y <- tools::toTitleCase(config$y)

if (plot_type == "pie") {
  p <- p + 
       theme_cyberpunk() + 
       labs(title = config$title, caption = "Source: Agentic Analyst (R HUD Edition)") +
       theme(
         axis.title.x = element_blank(),
         axis.title.y = element_blank(),
         axis.text.x = element_blank(),
         axis.text.y = element_blank(),
         panel.grid.major = element_blank(),
         panel.grid.minor = element_blank()
       )
} else {
  p <- p + 
       theme_cyberpunk() + 
       labs(
         title = config$title, 
         x = cap_x, 
         y = cap_y,
         caption = "Source: Agentic Analyst (R HUD Edition)"
       ) +
       scale_y_continuous(labels = scales::comma)
}

# 5. Save Output
ggsave(output_path, plot = p, width = 10, height = 6, dpi = 300, bg = "#0a0a0b")

cat(paste0("SUCCESS: Universal R Plot saved to ", output_path, "\n"))