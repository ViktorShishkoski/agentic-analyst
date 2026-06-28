# Chart Type Reference Guide

Selecting the appropriate visualization type is critical to making data analysis clear, transparent, and actionable.

## 1. Bar Chart (`bar`)
- **Use Case**: Comparing discrete categories or groups.
- **Data Requirements**: One categorical variable (X-axis) and one numeric value (Y-axis).
- **Orientation**:
  - Use **vertical** orientation if there are few categories (< 7) or categories have short labels.
  - Use **horizontal** orientation if labels are long or if there are many categories (> 7) to prevent overlap.
- **Best Practices**:
  - Always start the value axis at 0 to avoid distorting proportions.
  - Sort bars in descending or ascending order unless the categories have a natural sequence (e.g., age groups, months).

## 2. Line Chart (`line`)
- **Use Case**: Visualizing trends over a continuous range, typically time.
- **Data Requirements**: One sequential/temporal variable (X-axis) and one numeric variable (Y-axis).
- **Best Practices**:
  - Keep time on the horizontal axis moving left to right.
  - Limit the number of lines to 3-4 on a single chart to avoid clutter ("spaghetti chart").
  - Fill the area under the line slightly (area chart) to emphasize volume.

## 3. Scatter Plot (`scatter`)
- **Use Case**: Exposing relationships, correlations, and distributions between two numeric variables.
- **Data Requirements**: Two numeric variables (X and Y axis).
- **Best Practices**:
  - Add a regression trendline to make positive or negative correlations immediately apparent.
  - Use transparency (opacity) or color grouping to deal with overlapping points.

## 4. Pie Chart (`pie`)
- **Use Case**: Comparing parts of a whole (composition).
- **Data Requirements**: One categorical variable and one positive numeric variable summing to 100%.
- **Best Practices**:
  - Use only when there are fewer than 5-6 categories.
  - Arrange slices from largest to smallest, starting at 12 o'clock and moving clockwise.
  - Avoid 3D pie charts, which distort visual perception.

## 5. Histogram (`histogram`)
- **Use Case**: Displaying the distribution of a single continuous numeric variable.
- **Data Requirements**: One numeric variable.
- **Best Practices**:
  - Choose bin sizes carefully; too many bins look noisy, too few obscure the shape of the data.
  - Add a Kernel Density Estimate (KDE) line to show the smoothed probability distribution.

## 6. Heatmap (`heatmap`)
- **Use Case**: Visualizing correlation matrices or value intensity across two dimensions.
- **Data Requirements**: Two categorical variables (or matrix indexes) and one numeric value.
- **Best Practices**:
  - Use a clear color scale moving from dark (low values) to light (high values) or a diverging scale.
  - Keep color palettes consistent with the dashboard's design.

## 7. Box Plot (`box`)
- **Use Case**: Showing the distribution, quartiles, median, and outliers of numeric data.
- **Data Requirements**: One categorical grouping variable (optional) and one continuous numeric variable.
- **Best Practices**:
  - Highlight outliers clearly.
  - Use to compare distributions across multiple categories.
