const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/db');

async function run() {
    await db.initDb();
    const cy = db.cy;
    let output = '';

    output += "===== Q1: Which products have the most billing docs? =====\n";
    const products = [];
    cy.nodes('[label="Product"]').forEach(p => {
        let invoices = new Set();
        p.incomers('edge[label="OF_PRODUCT"]').sources().forEach(item => {
            item.incomers('edge[label="HAS_ITEM"]').sources().forEach(order => {
                order.outgoers('node[label="Delivery"]').forEach(deliv => {
                    deliv.outgoers('node[label="Invoice"]').forEach(inv => {
                        invoices.add(inv.id());
                    });
                });
            });
        });
        if (invoices.size > 0) {
            products.push({ product: p.data('product'), invoiceCount: invoices.size });
        }
    });
    const topProducts = products.sort((a,b) => b.invoiceCount - a.invoiceCount).slice(0, 15);
    topProducts.forEach((p,i) => {
        output += `  ${i+1}. Product: ${p.product} => ${p.invoiceCount} billing docs\n`;
    });

    output += "\n===== Q2: Orders delivered but NOT billed =====\n";
    const broken = [];
    cy.nodes('[label="Order"]').forEach(order => {
        const deliveries = order.outgoers('node[label="Delivery"]');
        if (deliveries.length > 0) {
            const invoices = deliveries.outgoers('node[label="Invoice"]');
            if (invoices.length === 0) {
                broken.push({ 
                    orderId: order.data('salesOrder'),
                    amount: parseFloat(order.data('totalNetAmount')) || 0,
                });
            }
        }
    });
    const topBroken = broken.sort((a,b) => b.amount - a.amount);
    topBroken.forEach((b,i) => {
        output += `  ${i+1}. Order: ${b.orderId} | Amount: ${b.amount}\n`;
    });
    output += `Total broken orders: ${broken.length}\n`;

    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, 'query_results.txt'), output);
    console.log("DONE. Results written to query_results.txt");
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
