require('dotenv').config({ path: './Backend/.env' });
const db = require('./Backend/src/db');

async function verify() {
    console.log("Starting Graph Verification...");
    await db.initDb();
    const cy = db.cy;

    const nodesCount = cy.nodes().length;
    const edgesCount = cy.edges().length;
    console.log(`Graph statistics: ${nodesCount} nodes, ${edgesCount} edges.`);

    if (nodesCount === 0 || edgesCount === 0) {
        console.error("Error: Graph is empty!");
        process.exit(1);
    }

    // Check for specific cross-entity links
    const deliveredAs = cy.edges('edge[label="DELIVERED_AS"]');
    console.log(`Found ${deliveredAs.length} DELIVERED_AS edges.`);

    const billedAs = cy.edges('edge[label="BILLED_AS"]');
    console.log(`Found ${billedAs.length} BILLED_AS edges.`);

    const postedAs = cy.edges('edge[label="POSTED_AS"]');
    console.log(`Found ${postedAs.length} POSTED_AS edges.`);

    const clearedBy = cy.edges('edge[label="CLEARED_BY"]');
    console.log(`Found ${clearedBy.length} CLEARED_BY edges.`);

    const generates = cy.edges('edge[label="GENERATES"]');
    console.log(`Found ${generates.length} GENERATES edges.`);

    // Test a full traversal for a known order if possible
    // Let's pick an order that has delivery items
    if (deliveredAs.length > 0) {
        const firstEdge = deliveredAs[0];
        const oi = firstEdge.source();
        const di = firstEdge.target();
        console.log(`Verification: Link exists between ${oi.id()} and ${di.id()}`);
    }

    console.log("Verification complete!");
}

verify().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
