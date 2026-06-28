/**
 * 🧱 COMPOSITOR NODE
 * Fan-in/join node to compile multiple parallel charts into a single layout manifest.
 * Determines grid coordinates (x, y, w, h) for responsive display.
 */
export async function compositorNode(state) {
  const io = state.dataContext.io;
  if (io) io.emit("milestone", { node: "Compositor", msg: "🧱 Compositing dashboard layout grid from query results..." });

  // Parallel branch execution outputs will be collected from dataContext
  // We expect dataContext.branches to be populated, or we look at raw outputs.
  // In the dynamic graph design:
  // Planner spawns goals. Each goal node outputs { id, spec, rawData, error }
  // Since we aggregate into state.dataContext.results, let's process the result list:
  const results = state.dataContext.results || [];
  
  if (results.length === 0) {
    if (io) io.emit("milestone", { node: "Compositor", msg: "⚠️ No goal query results received by compositor.", error: true });
    return {
      dataContext: {
        ...state.dataContext,
        layoutManifest: { layout: [] },
        lastStep: "compositor-empty"
      }
    };
  }

  // Layout assignment: 2 columns grid
  // Grid coordinates based on a 12-column layout (react-grid-layout / tailwind standard)
  const columns = 12;
  const cardWidth = 6;  // Two columns (6 + 6)
  const cardHeight = 4; // Arbitrary grid units height

  const layout = results.map((res, index) => {
    const colIndex = index % 2;
    const rowIndex = Math.floor(index / 2);

    return {
      id: res.id,
      x: colIndex * cardWidth,
      y: rowIndex * cardHeight,
      w: cardWidth,
      h: cardHeight
    };
  });

  const layoutManifest = {
    layout: layout
  };

  if (io) io.emit("milestone", { node: "Compositor", msg: `✅ Compiled dashboard grid coordinates for ${results.length} visual cards.` });

  return {
    dataContext: {
      ...state.dataContext,
      layoutManifest: layoutManifest,
      lastStep: "compositor-complete"
    }
  };
}
