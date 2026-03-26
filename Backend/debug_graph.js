const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/db');

async function run() {
    await db.initDb();
    const cy = db.cy;
    const fs = require('fs');
    let out = '';

    // Count all edge labels
    out += "=== ALL edge label counts ===\n";
    const edgeCounts = {};
    cy.edges().forEach(e => {
        const lbl = e.data('label');
        edgeCounts[lbl] = (edgeCounts[lbl] || 0) + 1;
    });
    out += JSON.stringify(edgeCounts, null, 2) + "\n\n";

    // Count all node labels
    out += "=== ALL node label counts ===\n";
    const nodeCounts = {};
    cy.nodes().forEach(n => {
        const lbl = n.data('label');
        nodeCounts[lbl] = (nodeCounts[lbl] || 0) + 1;
    });
    out += JSON.stringify(nodeCounts, null, 2) + "\n\n";

    // Check if any product nodes have incomers with OF_PRODUCT
    out += "=== Product node incoming edge check ===\n";
    cy.nodes('[label="Product"]').slice(0, 3).forEach(p => {
        const allEdges = p.connectedEdges();
        out += `Product ${p.id()}: ${allEdges.length} edges\n`;
        allEdges.forEach(e => out += `  edge: ${e.data('label')} (${e.data('source')}->${e.data('target')})\n`);
    });

    // Try the product billing query
    out += "\n=== Product billing query ===\n";
    const products = [];
    cy.nodes('[label="Product"]').forEach(p => {
        const genEdges = p.connectedEdges('[label="GENERATES"]');
        if (genEdges.length > 0) {
            products.push({ product: p.data('product'), billingDocsCount: genEdges.length });
        }
    });
    const topProducts = products.sort((a,b) => b.billingDocsCount - a.billingDocsCount).slice(0, 15);
    topProducts.forEach((p,i) => {
        out += `  ${i+1}. Product: ${p.product} => ${p.billingDocsCount} billing docs\n`;
    });

    fs.writeFileSync(path.join(__dirname, 'debug_edges3.txt'), out);
    console.log("DONE -> debug_edges3.txt");
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
