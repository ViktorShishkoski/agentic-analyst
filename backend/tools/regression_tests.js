import { analystNode } from "../services/analyst.js";
import { runSchemaProfiling } from "../services/discoveryNode.js";
import dotenv from "dotenv";

dotenv.config();

// 35 messy real-world prompts with expected collections, intents, and fields
const TEST_SUITE = [
    {
        query: "compare counts of items in columns and rows",
        expectedCollection: "sales_data",
        expectedIntent: "count_by_two_fields_pivot"
    },
    {
        query: "comapre items in colum and row",
        expectedCollection: "sales_data",
        expectedIntent: "count_by_two_fields_pivot"
    },
    {
        query: "show sales for each region",
        expectedCollection: "sales_data",
        expectedIntent: "count_by_field"
    },
    {
        query: "show total sales by prdct",
        expectedCollection: "sales_data",
        expectedIntent: "count_by_field",
        expectedFields: ["product"]
    },
    {
        query: "laptops vs printers sales comparison",
        expectedCollection: "sales_data",
        expectedIntent: "compare_specific_values"
    },
    {
        query: "is Skopje sales higher than Bitola",
        expectedCollection: "sales_data",
        expectedIntent: "compare_specific_values",
        expectedFields: ["region"]
    },
    {
        query: "sales trend over months",
        expectedCollection: "sales_data",
        expectedIntent: "trend_over_time",
        expectedFields: ["date"]
    },
    {
        query: "monthly sales amount",
        expectedCollection: "sales_data",
        expectedIntent: "trend_over_time",
        expectedFields: ["date", "amount"]
    },
    {
        query: "top 3 products by sales",
        expectedCollection: "sales_data",
        expectedIntent: "top_n",
        expectedFields: ["product"]
    },
    {
        query: "best performing region",
        expectedCollection: "sales_data",
        expectedIntent: "top_n",
        expectedFields: ["region"]
    },
    {
        query: "distribution of amount",
        expectedCollection: "sales_data",
        expectedIntent: "distribution",
        expectedFields: ["amount"]
    },
    {
        query: "amount spread",
        expectedCollection: "sales_data",
        expectedIntent: "distribution",
        expectedFields: ["amount"]
    },
    {
        query: "ended vs running tv shows",
        expectedCollection: "tv_shows",
        expectedIntent: "compare_specific_values",
        expectedFields: ["status"]
    },
    {
        query: "count of shows by type",
        expectedCollection: "tv_shows",
        expectedIntent: "count_by_field",
        expectedFields: ["type"]
    },
    {
        query: "language counts of show",
        expectedCollection: "tv_shows",
        expectedIntent: "count_by_field",
        expectedFields: ["language"]
    },
    {
        query: "runtime distribution for scripted",
        expectedCollection: "tv_shows",
        expectedIntent: "distribution",
        expectedFields: ["runtime"]
    },
    {
        query: "top 5 weight tv shows",
        expectedCollection: "tv_shows",
        expectedIntent: "top_n",
        expectedFields: ["weight"]
    },
    {
        query: "compare status counts of tv shows in rows and columns",
        expectedCollection: "tv_shows",
        expectedIntent: "count_by_two_fields_pivot"
    },
    {
        query: "show sales in Skopje and Bitola regions",
        expectedCollection: "sales_data",
        expectedIntent: "compare_specific_values",
        expectedFields: ["region"]
    },
    {
        query: "sales performance by status",
        expectedCollection: "sales_data",
        expectedIntent: "count_by_field",
        expectedFields: ["status"]
    },
    {
        query: "distribution of runtime for shows",
        expectedCollection: "tv_shows",
        expectedIntent: "distribution",
        expectedFields: ["runtime"]
    },
    {
        query: "tv shows sorted by ID limit 10",
        expectedCollection: "tv_shows",
        expectedIntent: "top_n",
        expectedFields: ["id"]
    },
    {
        query: "compare regions and products by count",
        expectedCollection: "sales_data",
        expectedIntent: "count_by_two_fields_pivot"
    },
    {
        query: "show product sales trend",
        expectedCollection: "sales_data",
        expectedIntent: "trend_over_time",
        expectedFields: ["date"]
    },
    {
        query: "what is the average amount for laptops",
        expectedCollection: "sales_data",
        expectedIntent: "compare_specific_values",
        expectedFields: ["product", "amount"]
    },
    {
        query: "how many completed sales did we get",
        expectedCollection: "sales_data",
        expectedIntent: "compare_specific_values",
        expectedFields: ["status"]
    },
    {
        query: "list tv shows by genre count",
        expectedCollection: "tv_shows",
        expectedIntent: "count_by_field",
        expectedFields: ["genres"]
    },
    {
        query: "is English more popular than Japanese in shows",
        expectedCollection: "tv_shows",
        expectedIntent: "compare_specific_values",
        expectedFields: ["language"]
    },
    {
        query: "trend of show premieres over years",
        expectedCollection: "tv_shows",
        expectedIntent: "trend_over_time",
        expectedFields: ["premiered"]
    },
    {
        query: "weight distribution of show characters",
        expectedCollection: "tv_shows",
        expectedIntent: "distribution",
        expectedFields: ["weight"]
    },
    {
        query: "highest weight tv show names",
        expectedCollection: "tv_shows",
        expectedIntent: "top_n",
        expectedFields: ["weight"]
    },
    {
        query: "top performing products in Skopje",
        expectedCollection: "sales_data",
        expectedIntent: "top_n",
        expectedFields: ["product"]
    },
    {
        query: "compare counts of tv status and languages",
        expectedCollection: "tv_shows",
        expectedIntent: "count_by_two_fields_pivot"
    },
    {
        query: "which products had completed status",
        expectedCollection: "sales_data",
        expectedIntent: "compare_specific_values",
        expectedFields: ["status"]
    },
    {
        query: "daily sales summary",
        expectedCollection: "sales_data",
        expectedIntent: "trend_over_time",
        expectedFields: ["date"]
    }
];

async function runTests() {
    console.log("📡 Retreiving Schema context from database...");
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || "agentic_db";
    const profile = await runSchemaProfiling(dbName, uri);

    console.log("\n🧪 STARTING DECOMPOSED ANALYST REGRESSION TEST SUITE...");
    console.log(`Loaded ${TEST_SUITE.length} test prompts.\n`);

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < TEST_SUITE.length; i++) {
        const testCase = TEST_SUITE[i];
        console.log(`[Test ${i+1}/${TEST_SUITE.length}] Prompt: "${testCase.query}"`);

        try {
            // Invoke the analystNode
            const result = await analystNode({
                dataContext: {
                    conceptualQuery: testCase.query,
                    schema: profile.schema,
                    schemaObject: profile.schemaObject
                }
            });

            const dataContext = result.dataContext;

            // Assertions
            if (dataContext.mongoError) {
                console.log(`  ❌ Failed: MongoDB Error - ${dataContext.mongoError}`);
                failed++;
                continue;
            }

            const actualCollection = dataContext.lastCollection;
            const actualManifest = dataContext.visualManifest;

            if (actualCollection !== testCase.expectedCollection) {
                console.log(`  ❌ Failed: Collection mismatch. Expected "${testCase.expectedCollection}", got "${actualCollection}"`);
                failed++;
                continue;
            }

            // Extract intent from visual title or parameters if logged
            // Since our titles are formatted like `${intent.toUpperCase()}: ${collection}`
            const actualIntent = actualManifest?.title ? actualManifest.title.split(":")[0].toLowerCase().replace(/ /g, "_") : "";

            if (testCase.expectedIntent && actualIntent !== testCase.expectedIntent) {
                console.log(`  ❌ Failed: Intent mismatch. Expected "${testCase.expectedIntent}", got "${actualIntent}"`);
                failed++;
                continue;
            }

            console.log(`  ✅ Passed: Collection = ${actualCollection}, Intent = ${actualIntent}`);
            passed++;

        } catch (err) {
            console.log(`  ❌ Failed with Exception: ${err.message}`);
            failed++;
        }

        // Add a small delay between runs to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const accuracy = (passed / TEST_SUITE.length) * 100;
    console.log("\n=============================================");
    console.log("🧪 REGRESSION TEST RESULTS:");
    console.log(`Passed: ${passed}/${TEST_SUITE.length}`);
    console.log(`Failed: ${failed}/${TEST_SUITE.length}`);
    console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
    console.log("=============================================\n");

    if (failed > 5) {
        console.error("❌ Regression CI failed: Accuracy dropped below 85%.");
        process.exit(1);
    } else {
        console.log("✅ Regression CI passed successfully!");
        process.exit(0);
    }
}

runTests();
