// tests/load-test.js
import autocannon from "autocannon";
import app from "../src/app.js";
import { logger } from "../src/utils/logger.js";

const PORT = 3002;

const server = app.listen(PORT, async () => {
    logger.info(`Temp load-test server started on port ${PORT}`);
    logger.info("Running concurrent request load test using autocannon...");

    try {
        const result = await autocannon({
            url: `http://localhost:${PORT}`,
            connections: 5, // 5 concurrent connections
            duration: 3,    // 3 seconds duration
        });

        logger.info("Load test completed successfully.");
        console.log(`\n================= LOAD TEST REPORT =================`);
        console.log(`Target Address:    http://localhost:${PORT}`);
        console.log(`Test Duration:     3 seconds`);
        console.log(`Connections:       5 concurrent clients`);
        console.log(`Total Requests:    ${result.requests.sent}`);
        console.log(`Requests / Sec:    ${result.requests.average}`);
        console.log(`Connection Errors: ${result.errors}`);
        console.log(`\nResponse Code Breakdown:`);
        console.log(`- 2xx (Allowed):   ${result["2xx"]} requests`);
        console.log(`- 4xx (Blocked):   ${result["4xx"]} requests`);
        console.log(`===================================================\n`);

    } catch (err) {
        logger.error(`Load test error: ${err.message}`);
    } finally {
        server.close(() => {
            logger.info("Temp load-test server shutdown complete.");
            process.exit(0);
        });
    }
});
