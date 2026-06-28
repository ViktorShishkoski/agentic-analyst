import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

/**
 * 📤 DATA EXPORTER
 * Standardizes MongoDB data for Python/Pandas compatibility.
 */
export async function exportData(collectionName = "metrics_v1", outputPath = "output/analysis_data.csv") {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || "analyst_db");
        const collection = db.collection(collectionName);

        // Fetch all data sorted by timestamp
        const data = await collection.find({}).sort({ timestamp: 1 }).toArray();

        if (data.length === 0) {
            console.log("⚠️ No data found in collection to export.");
            return null;
        }

        // Standardize headers and data types
        // category: factor (string in CSV), value: numeric (float in CSV)
        const headers = ["category", "value", "timestamp", "processed_at"];
        const csvRows = [headers.join(",")];

        data.forEach(doc => {
            const row = [
                `"${doc.category}"`, // Quote strings for R factors
                doc.value,           // Numeric
                `"${doc.timestamp}"`,
                `"${doc.processed_at.toISOString()}"`
            ];
            csvRows.push(row.join(","));
        });

        const csvContent = csvRows.join("\n");

        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, csvContent);
        console.log(`✅ Exported ${data.length} records to ${outputPath} for R visualization.`);
        
        return outputPath;
    } catch (error) {
        console.error("❌ Export failed:", error);
        throw error;
    } finally {
        await client.close();
    }
}

/**
 * 📄 PDF DASHBOARD EXPORTER
 * Ingests Plotly dashboard configurations and renders high-quality A4 PDF report via Puppeteer.
 */
export async function exportDashboardToPDF(title, cards) {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || "Agentic Analyst Dashboard"}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.plot.ly/plotly-2.24.1.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Mono&display=swap');
    body {
      font-family: 'Outfit', sans-serif;
      background-color: #0c0d12;
      color: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .font-mono {
      font-family: 'Space Mono', monospace;
    }
    .card-border {
      border: 1px solid rgba(212, 168, 83, 0.15);
      background: linear-gradient(135deg, rgba(22, 25, 34, 0.9) 0%, rgba(15, 17, 23, 0.95) 100%);
    }
    .text-glow {
      text-shadow: 0 0 8px rgba(212, 168, 83, 0.4);
    }
  </style>
</head>
<body class="p-8">
  <div class="max-w-5xl mx-auto">
    <header class="border-b border-amber-500/20 pb-4 mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-extrabold tracking-wider text-[var(--accent-gold)] uppercase text-glow" style="color: #D4A853;">
          ${title || "Agentic Analyst Dashboard"}
        </h1>
        <p class="text-[9px] text-gray-400 uppercase tracking-widest font-mono mt-1">
          Agentic Analyst Report &bull; Compiled on ${new Date().toLocaleDateString()}
        </p>
      </div>
      <div class="text-right">
        <span class="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-lg font-mono uppercase tracking-wider font-semibold">
          SYSTEM REPORT
        </span>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${cards.map((card, idx) => `
        <div class="card-border rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div class="flex items-center gap-2 border-b border-amber-500/10 pb-3 mb-3">
              <span class="flex items-center justify-center w-5 h-5 rounded bg-amber-500/10 border border-amber-500/30 text-[#D4A853] text-[10px] font-bold font-mono">
                ${idx + 1}
              </span>
              <span class="text-xs font-semibold text-gray-200 uppercase tracking-wider truncate">
                ${card.title || `Visualization ${idx + 1}`}
              </span>
            </div>
            
            <div class="bg-black/20 text-[9px] font-mono text-[#5B8A8A] px-2 py-1 rounded border border-gray-800/40 mb-3 truncate">
              <span class="text-gray-500 font-bold uppercase mr-1">Query:</span> ${card.query || "N/A"}
            </div>

            <div id="chart-${idx}" class="w-full h-64 bg-black/10 rounded mb-3"></div>
          </div>

          <div class="p-3 bg-black/30 rounded border border-gray-800/40 mt-1 min-h-[60px]">
            <div class="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1 font-mono">
              Synthesis Intelligence
            </div>
            <p class="text-[10px] text-gray-300 leading-relaxed italic">
              "${card.insight || card.caption || 'No summary generated.'}"
            </p>
          </div>
        </div>
      `).join('')}
    </div>
    
    <footer class="mt-8 border-t border-amber-500/10 pt-4 flex justify-between items-center text-[8px] font-mono text-gray-500 uppercase tracking-widest">
      <span>Agentic Analyst Platform</span>
      <span>Confidential &bull; Security Grade: A</span>
    </footer>
  </div>

  <script>
    const cards = ${JSON.stringify(cards)};
    cards.forEach((card, idx) => {
      const divId = 'chart-' + idx;
      if (card.plotlySpec && card.plotlySpec.data) {
        const spec = JSON.parse(JSON.stringify(card.plotlySpec));
        spec.layout = spec.layout || {};
        spec.layout.paper_bgcolor = 'rgba(0,0,0,0)';
        spec.layout.plot_bgcolor = 'rgba(0,0,0,0)';
        spec.layout.title = null; // Title displayed in card header
        spec.layout.margin = spec.layout.margin || { t: 20, b: 35, l: 35, r: 15 };
        
        // Match dark mode theme for text
        spec.layout.font = { color: "#c5c0b8", family: "Outfit, sans-serif" };
        if (spec.layout.xaxis) {
          spec.layout.xaxis.gridcolor = "#1f222e";
          spec.layout.xaxis.zerolinecolor = "#1f222e";
          spec.layout.xaxis.tickfont = { size: 8, color: "#918D86" };
        }
        if (spec.layout.yaxis) {
          spec.layout.yaxis.gridcolor = "#1f222e";
          spec.layout.yaxis.zerolinecolor = "#1f222e";
          spec.layout.yaxis.tickfont = { size: 8, color: "#918D86" };
        }
        
        Plotly.newPlot(divId, spec.data, spec.layout, { responsive: true, displayModeBar: false });
      }
    });
  </script>
</body>
</html>
    `;

    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });

    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        // Let Plotly render charts
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
        });
        return pdfBuffer;
    } finally {
        await browser.close();
    }
}
