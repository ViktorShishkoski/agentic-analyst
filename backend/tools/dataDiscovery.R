# DATA DISCOVERY SCRIPT
# Generates summary statistics for a dataset and returns them as JSON.

if (!require("jsonlite")) install.packages("jsonlite", repos='http://cran.us.r-project.org')
library(jsonlite)

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  stop("Usage: Rscript dataDiscovery.R <csv_path>")
}

csv_path <- args[1]

# Detect separator
first_line <- readLines(csv_path, n = 1)
separators <- c(",", ";", "\t", "|")
counts <- sapply(separators, function(s) {
  res <- gregexpr(s, first_line, fixed = TRUE)[[1]]
  if (identical(as.vector(res), -1L)) 0 else length(res)
})
detected_sep <- separators[which.max(counts)]
if (all(counts == 0)) detected_sep <- ","

message(paste("📂 Detected separator:", if(detected_sep == "\t") "\\t" else detected_sep))
data <- read.csv(csv_path, sep = detected_sep)

# Calculate stats
summary_stats <- list(
  rowCount = nrow(data),
  colCount = ncol(data),
  columns = names(data),
  types = sapply(data, class),
  summary = lapply(data, function(x) {
    if (is.numeric(x)) {
      list(
        min = min(x, na.rm = TRUE),
        max = max(x, na.rm = TRUE),
        mean = mean(x, na.rm = TRUE),
        missing = sum(is.na(x))
      )
    } else {
      list(
        unique_count = length(unique(x)),
        missing = sum(is.na(x))
      )
    }
  })
)

cat(toJSON(summary_stats, auto_unbox = TRUE))
