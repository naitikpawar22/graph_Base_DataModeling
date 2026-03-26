const { MongoClient } = require('mongodb');
const cytoscape = require('cytoscape');

// Create a headless Cytoscape instance to act as our In-Memory Graph Database
const cy = cytoscape({ headless: true });

async function fetchCollection(database, collectionName, projection = {}) {
    try {
        // Fetch full documents (projection = {}) to allow AI to answer ANY question
        const data = await database.collection(collectionName)
            .find({})
            .project(projection)
            .toArray();
        
        console.log(`- Dataset ${collectionName}: Syncing ${data.length} records into Memory.`);
        return data.map(record => ({ ...record, _source: collectionName }));
    } catch (error) {
        console.error(`Error fetching collection ${collectionName}:`, error);
        return [];
    }
}

const db = {
    cy,
    client: null, // Keep reference to MongoDB client

    async initDb() {
        console.log(">>> [DEFINITIVE LIVE VERSION] Syncing MongoDB Atlas with In-Memory Graph...");
        const uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DB_NAME || 'o2c_database';

        if (!uri) throw new Error("MONGODB_URI is not defined in .env");

        // Re-use existing client if already connected
        if (!this.client) {
            this.client = new MongoClient(uri);
            await this.client.connect();
        }

        try {
            const database = this.client.db(dbName);

            // --- 1. Load COMPLETE Data in Parallel (NO PROJECTIONS for full context) ---
            const [
                customers,
                orders,
                orderItems,
                products,
                billing,
                billingItems,
                payments,
                deliveries,
                deliveryItems,
                addresses,
                journalEntries
            ] = await Promise.all([
                fetchCollection(database, 'business_partners'),
                fetchCollection(database, 'sales_order_headers'),
                fetchCollection(database, 'sales_order_items'),
                fetchCollection(database, 'products'),
                fetchCollection(database, 'billing_document_headers'),
                fetchCollection(database, 'billing_document_items'),
                fetchCollection(database, 'payments_accounts_receivable'),
                fetchCollection(database, 'outbound_delivery_headers'),
                fetchCollection(database, 'outbound_delivery_items'),
                fetchCollection(database, 'business_partner_addresses'),
                fetchCollection(database, 'journal_entry_items_accounts_receivable')
            ]);

            const elements = [];
            const nodeMap = new Map();
            const nodeIds = new Set();

            const addNode = (id, label, fullRecord = {}) => {
                if (!id) return;
                const sid = id.toString();
                if (nodeMap.has(sid)) {
                    const element = nodeMap.get(sid);
                    // Update metadata if record already exists or promote Reference nodes
                    if (element.data.label === 'Reference' || (label !== 'Reference' && element.data.label !== label)) {
                        element.data = { ...element.data, ...fullRecord, id: sid, label };
                    }
                    return;
                }
                const newNode = { data: { ...fullRecord, id: sid, label } };
                elements.push(newNode);
                nodeMap.set(sid, newNode);
                nodeIds.add(sid);
            };

            const addEdge = (source, target, label) => {
                if (!source || !target) return;
                const s = source.toString();
                const t = target.toString();
                if (!nodeIds.has(s)) addNode(s, 'Reference');
                if (!nodeIds.has(t)) addNode(t, 'Reference');
                elements.push({ data: { id: `${s}-${label}-${t}`, source: s, target: t, label } });
            };

            // --- 2. Build Core Workflow ---
            let defaultAddresses = new Map();
            addresses.forEach(a => {
                const addrId = `Addr-${a.businessPartner}-${a.addressID}`;
                addNode(addrId, 'Address', a);
                addEdge(a.businessPartner, addrId, 'HAS_ADDRESS');
                if (!defaultAddresses.has(a.businessPartner)) defaultAddresses.set(a.businessPartner, addrId);
            });

            customers.forEach(c => addNode(c.businessPartner, 'Customer', c));
            products.forEach(p => addNode(p.product, 'Product', p));
            orders.forEach(o => {
                addNode(o.salesOrder, 'Order', o);
                addEdge(o.soldToParty, o.salesOrder, 'PLACES');
            });

            orderItems.forEach(item => {
                const itemId = `OI-${item.salesOrder}-${item.salesOrderItem}`;
                addNode(itemId, 'OrderItem', item);
                addEdge(item.salesOrder, itemId, 'HAS_ITEM');
                if (item.material) {
                    if (!nodeIds.has(item.material.toString())) addNode(item.material, 'Product', { product: item.material });
                    addEdge(itemId, item.material, 'OF_PRODUCT');
                }
            });

            deliveries.forEach(d => {
                addNode(d.deliveryDocument, 'Delivery', d);
                if (d.shipToParty && defaultAddresses.has(d.shipToParty)) {
                    addEdge(d.deliveryDocument, defaultAddresses.get(d.shipToParty), 'SHIPS_TO');
                }
            });

            deliveryItems.forEach(di => {
                if (di.referenceSdDocument && di.deliveryDocument) {
                    addEdge(di.referenceSdDocument, di.deliveryDocument, 'DELIVERED_AS');
                }
            });

            billing.forEach(b => addNode(b.billingDocument, 'Invoice', b));
            billingItems.forEach(bi => {
                if (bi.referenceSdDocument && bi.billingDocument) {
                    if (!nodeIds.has(bi.billingDocument.toString())) addNode(bi.billingDocument, 'Invoice', { billingDocument: bi.billingDocument });
                    addEdge(bi.referenceSdDocument, bi.billingDocument, 'BILLED_AS');
                }
                if (bi.material && bi.billingDocument) {
                    if (!nodeIds.has(bi.material.toString())) addNode(bi.material, 'Product', { product: bi.material });
                    addEdge(bi.material, bi.billingDocument, 'GENERATES');
                }
            });

            payments.forEach(p => addNode(`Pay-${p.accountingDocument}`, 'Payment', p));
            journalEntries.forEach(je => {
                const jeId = `JE-${je.accountingDocument}`;
                addNode(jeId, 'JournalEntry', je);
                if (je.referenceDocument) addEdge(je.referenceDocument, jeId, 'POSTED_AS');
                const pay = payments.find(p => p.clearingAccountingDocument === je.accountingDocument);
                if (pay) addEdge(jeId, `Pay-${pay.accountingDocument}`, 'CLEARED_BY');
            });

            elements.forEach(el => {
                if (el.data.source) return;
                if (el.data.id.startsWith('OI-')) el.data.label = 'OrderItem';
                if (el.data.id.startsWith('JE-')) el.data.label = 'JournalEntry';
                if (el.data.id.startsWith('Pay-')) el.data.label = 'Payment';
                if (el.data.id.startsWith('Addr-')) el.data.label = 'Address';
            });

            cy.elements().remove();
            cy.add(elements);
            console.log(`Graph Reconstructed from MongoDB: ${cy.nodes().length} nodes, ${cy.edges().length} edges.`);
            console.log(">>> MongoDB Connection Active & Synced.");

        } catch (error) {
            console.error("Critical error during DB initialization:", error);
            throw error;
        }
    },

    getInitialGraph() {
        const coreLabels = ['Customer', 'Order', 'OrderItem', 'Product', 'Delivery', 'Invoice', 'JournalEntry', 'Payment', 'Address'];
        const nodes = cy.nodes().filter(n => coreLabels.includes(n.data('label')));
        const edges = nodes.connectedEdges().filter(e => nodes.contains(e.source()) && nodes.contains(e.target()));
        return {
            nodes: nodes.map(n => ({ data: n.data() })),
            edges: edges.map(e => ({ data: e.data() }))
        };
    },

    expandNode(id) {
        const node = cy.getElementById(id);
        if (node.empty()) return { nodes: [], edges: [] };
        const neighborhood = node.neighborhood();
        return {
            nodes: neighborhood.nodes().map(n => ({ data: n.data() })).concat([{ data: node.data() }]),
            edges: neighborhood.edges().map(e => ({ data: e.data() }))
        };
    }
};

module.exports = db;
