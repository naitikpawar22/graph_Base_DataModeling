const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/db');

async function run() {
    await db.initDb();
    const cy = db.cy;

    console.log("Searching for a complete O2C flow...");
    let found = false;
    
    // Find an Invoice that has a JournalEntry AND a Payment AND a Delivery AND an Order
    cy.nodes('[label="Invoice"]').forEach(inv => {
        if (found) return;
        
        const journals = inv.outgoers('node[label="JournalEntry"]');
        if (journals.length === 0) return;
        
        const payments = journals.outgoers('node[label="Payment"]');
        if (payments.length === 0) return;
        
        const deliveries = inv.incomers('node[label="Delivery"]');
        if (deliveries.length === 0) return;
        
        const orders = deliveries.incomers('node[label="Order"]');
        if (orders.length === 0) return;
        
        console.log("\nFOUND PERFECT FLOW!");
        console.log("Invoice ID:", inv.id());
        console.log("Journal Entry ID:", journals[0].id());
        console.log("Payment ID:", payments[0].id());
        console.log("Delivery ID:", deliveries[0].id());
        console.log("Order ID:", orders[0].id());
        found = true;
    });

    if (!found) {
        console.log("No complete flow (Order -> Delivery -> Invoice -> JournalEntry -> Payment) found.");
        // Try Invoice -> JournalEntry -> Payment
        cy.nodes('[label="Invoice"]').forEach(inv => {
            if (found) return;
            const js = inv.outgoers('node[label="JournalEntry"]');
            const ps = js.outgoers('node[label="Payment"]');
            if (ps.length > 0) {
                console.log("Found partial flow (Invoice -> Payment):", inv.id());
                found = true;
            }
        });
    }

    process.exit(0);
}

run().catch(console.error);
