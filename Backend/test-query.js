const db = require('./src/db');

async function test() {
    await db.initDb();
    const cy = db.cy;

    console.log("--- Comprehensive Label Audit ---");
    const allNodes = cy.nodes();
    const labelCounts = {};
    allNodes.forEach(n => {
        const lbl = n.data('label') || 'NO_LABEL';
        labelCounts[lbl] = (labelCounts[lbl] || 0) + 1;
    });
    console.log("Label Counts:", labelCounts);

    if (labelCounts['Product']) {
        const sampleProduct = cy.nodes('[label = "Product"]').first();
        console.log("Sample Product Data:", JSON.stringify(sampleProduct.data(), null, 2));
    } else {
        console.log("CRITICAL: No Product nodes found!");
    }

    if (labelCounts['BillingItem']) {
        const sampleBI = cy.nodes('[label = "BillingItem"]').first();
        console.log("Sample BillingItem Data:", JSON.stringify(sampleBI.data(), null, 2));
    }
}

test();
