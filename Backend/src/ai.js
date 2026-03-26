const { Groq } = require('groq-sdk');
const db = require('./db');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
You are an expert SAP O2C (Order-to-Cash) Data Analyst AI. You specialize in analyzing business flows from Sales Orders through Deliveries, Billing, and Payments. You translate natural language questions into Cytoscape.js query code that runs against a headless in-memory graph database which is SYNCED with a live MongoDB Atlas instance.

Your mission: Provide deep business insights using the COMPLETE MongoDB dataset. You have access to ALL fields in the documents, not just the graph IDs.

══════════════════════════  GRAPH & DATA SCHEMA  ══════════════════════════

NODE LABELS & KEY DATA FIELDS (Full MongoDB documents are available in .data()):
- Customer: {businessPartner, customerName, industry, country, customerFullName, ...all partner fields}
- Address: {addressID, cityName, country, region, streetName, ...all address fields}
- Order: {salesOrder, salesOrderDate, soldToParty, totalNetAmount, transactionCurrency, ...all header fields}
- OrderItem: {salesOrder, salesOrderItem, material, orderQuantity, netAmount, ...all item fields}
- Product: {product, productType, baseUnit, productCategory, ...all product fields}
- Delivery: {deliveryDocument, actualDeliveryRoute, totalNetAmount, actualDeliveryDate, ...all delivery fields}
- Invoice: {billingDocument, billingDocumentDate, totalNetAmount, transactionCurrency, billingDocumentIsCancelled, ...all billing fields}
- JournalEntry: {accountingDocument, fiscalYear, amountInCompanyCodeCurrency, referenceDocument, ...all JE fields}
- Payment: {accountingDocument, clearingAccountingDocument, amountInCompanyCodeCurrency, customer, ...all payment fields}

EDGE RELATIONSHIPS:
  Customer ──PLACES──▶ Order
  Order ──HAS_ITEM──▶ OrderItem
  OrderItem ──OF_PRODUCT──▶ Product
  Order ──DELIVERED_AS──▶ Delivery
  Delivery ──BILLED_AS──▶ Invoice
  Product ──GENERATES──▶ Invoice
  Invoice ──POSTED_AS──▶ JournalEntry
  JournalEntry ──CLEARED_BY──▶ Payment
  Customer ──HAS_ADDRESS──▶ Address
  Delivery ──SHIPS_TO──▶ Address

══════════════════  CRITICAL RULES  ══════════════════
1. Return ONLY valid JavaScript code. NO explanations, NO markdown.
2. The variable 'cy' is available.
3. Access detailed fields via node.data('fieldName').
4. Always wrap complex queries in an IIFE: (() => { ... })()
5. HIGHLIGHTING: To highlight elements, return a Cytoscape collection directly (e.g., return cy.nodes(...)). Do NOT call .jsons() yourself; the system handles serialization.
6. DATA AGGREGATION: For counts/metrics, return a standard JS array of objects. Do NOT use .jsons() on these arrays.
7. TRAVERSAL: Use .connectedEdges(), .outgoers(), and .incomers() to find related business entities.

══════════════════  STRICT DOMAIN GUARDRAILS  ══════════════════
- MISSION: You ONLY analyze SAP Order-to-Cash (O2C) data.
- STRIKE POLICY: If the prompt is UNRELATED to SAP O2C (e.g., "tell me a joke", "who is the president", "write a poem", "general info"), you MUST return EXACTLY:
  return { error: 'OUT_OF_DOMAIN' };
- NO EXCEPTIONS: Do not attempt to be "helpful" or explain yourself for unrelated prompts.

══════════════════  EXAMPLE QUERIES  ══════════════════

Q: "Which products are associated with the highest number of billing documents?"
A: (() => { 
  const products = cy.nodes('[label="Product"]');
  const result = products.map(p => ({
    productCode: p.data('product'),
    productName: p.data('productDescription') || p.id(),
    count: p.outgoers('node[label="Invoice"]').length
  }));
  return result.sort((a,b) => b.count - a.count).slice(0, 10);
})()

Q: "Show the full flow for order 9000001 and highlight it"
A: (() => { const order = cy.nodes('[label="Order"]').filter(n => n.data('salesOrder') == '9000001'); if(order.length === 0) return { error: 'Not found' }; return order.union(order.successors()).union(cy.edges()); })()

Q: "Who is the president of the USA?"
A: return { error: 'OUT_OF_DOMAIN' };

Q: "Write a poem about business."
A: return { error: 'OUT_OF_DOMAIN' };
`;

async function isPromptInDomain(message) {
    const res = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content: 'You are a domain gatekeeper for an SAP O2C (Order-to-Cash) system. If the user question is related to SAP, business orders, customers, deliveries, invoices, or payments, return "VALID". If the prompt is about general knowledge, creative writing, world news, or irrelevant topics (e.g. who is the president, write a poem, tell a joke), return "INVALID". Return ONLY the word VALID or INVALID.'
            },
            { role: 'user', content: message }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0
    });
    const verdict = res.choices[0].message.content.trim().toUpperCase();
    return verdict.includes('VALID') && !verdict.includes('INVALID');
}

async function handleChatStream(message, onChunk) {
    // 0. Domain Guardrail Firewall
    const inDomain = await isPromptInDomain(message);
    if (!inDomain) {
        onChunk({ text: "This system is designed to answer questions related to the provided dataset only.", done: true });
        return;
    }
    // 1. Generate JS Expression
    const res1 = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: message }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0
    });

    let rawOutput = res1.choices[0].message.content.trim();
    let rawCode = '';
    const codeBlockMatch = rawOutput.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/i);
    if (codeBlockMatch) rawCode = codeBlockMatch[1].trim();

    if (!rawCode) {
        const startPatterns = ['(() =>', '( () =>', '(async () =>', 'async () =>', '() => {'];
        let iifeStart = -1;
        for (const p of startPatterns) {
            iifeStart = rawOutput.indexOf(p);
            if (iifeStart !== -1) break;
        }
        if (iifeStart >= 0) {
            let braceDepth = 0;
            let inString = false;
            let stringChar = '';
            let i = iifeStart;
            let foundFirstBrace = false;
            for (; i < rawOutput.length; i++) {
                const ch = rawOutput[i];
                if (inString) {
                    if (ch === stringChar && rawOutput[i - 1] !== '\\') inString = false;
                    continue;
                }
                if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }
                if (ch === '{') { braceDepth++; foundFirstBrace = true; }
                if (ch === '}') braceDepth--;
                if (foundFirstBrace && braceDepth === 0) {
                    const rest = rawOutput.substring(i + 1);
                    const iifeCloseMatch = rest.match(/^\s*\)\s*\(\s*\)/);
                    if (iifeCloseMatch) rawCode = rawOutput.substring(iifeStart, i + 1 + iifeCloseMatch[0].length).trim();
                    else if (rawOutput[iifeStart] === '(') rawCode = rawOutput.substring(iifeStart, i + 1).trim();
                    else rawCode = `(${rawOutput.substring(iifeStart, i + 1)})()`;
                    break;
                }
            }
        }
    }
    if (!rawCode) {
        const lines = rawOutput.split('\n');
        const codeLine = lines.find(l => l.trim().startsWith('cy.'));
        if (codeLine) rawCode = codeLine.trim();
    }
    if (!rawCode) rawCode = rawOutput;
    if (typeof rawCode === 'string') rawCode = rawCode.replace(/;+\s*$/, '').trim();

    console.log("LLM Evaluated Code:", rawCode);

    // --- DOMAIN GUARDRAIL INTERCEPT ---
    if (rawOutput.includes('OUT_OF_DOMAIN') || rawCode.includes('OUT_OF_DOMAIN')) {
        onChunk({ text: "This system is designed to answer questions related to the provided dataset only.", done: true });
        return;
    }

    let dbResult;
    try {
        const cy = db.cy;
        const rawRes = eval('void 0;\n' + rawCode);
        if (rawRes && typeof rawRes.jsons === 'function') dbResult = rawRes.jsons();
        else dbResult = rawRes;
    } catch (e) {
        console.error("Eval Error:", e.message);
        onChunk({ error: "Graph Query Failed: " + e.message });
        return;
    }

    if (dbResult && dbResult.error === 'OUT_OF_DOMAIN') {
        onChunk({ text: "This system is designed to answer questions related to the provided dataset only.", done: true });
        return;
    }

    if (dbResult === undefined || dbResult === null) {
        onChunk({ error: "No data found for this query." });
        return;
    }

    // Highlighting Logic
    let highlightElements = [];
    if (Array.isArray(dbResult)) {
        dbResult.forEach(item => { if (item && item.data && item.data.id) highlightElements.push(item); });
    } else if (dbResult && dbResult.elements) {
        highlightElements = dbResult.elements;
    }

    if (highlightElements.length === 0) {
        const potentialIds = new Set();
        const searchItems = Array.isArray(dbResult) ? dbResult : [dbResult];
        searchItems.forEach(item => {
            if (!item) return;
            const idFields = ['salesOrder', 'billingDocument', 'deliveryDocument', 'accountingDocument', 'product', 'businessPartner', 'orderId', 'invoiceId'];
            idFields.forEach(f => { if (item[f]) potentialIds.add(item[f].toString()); });
            if (typeof item === 'string' || typeof item === 'number') potentialIds.add(item.toString());
        });
        if (potentialIds.size > 0) {
            const foundNodes = db.cy.nodes().filter(n => {
                const data = n.data();
                return potentialIds.has(n.id()) || potentialIds.has(data.salesOrder?.toString()) || potentialIds.has(data.billingDocument?.toString()) || potentialIds.has(data.deliveryDocument?.toString());
            });
            if (foundNodes.length > 0) highlightElements = foundNodes.union(foundNodes.connectedEdges()).jsons();
        }
    }

    // 2. Synthesize with STREAMING
    const synthesisPrompt = `
    You are an expert SAP O2C Business Analyst. 
    
    DOMAIN GUARDRAIL: If the User Question is unrelated to O2C business (e.g., general knowledge, creative writing), you MUST ignore the results and respond ONLY with: "This system is designed to answer questions related to the provided dataset only."

    User Question: "${message}"
    Database Results: ${(JSON.stringify(dbResult) || "[]").substring(0, 4000)}
    
    STRICT RESPONSE RULES:
    1. ANSWER FIRST: Your very first sentence MUST explicitly, directly, and clearly answer the user's specific question.
    2. ### ANALYSIS SUMMARY: Provide a high-quality, professional, and sophisticated business narrative (3-4 sentences). Ensure the tone is proper, well-structured, and easily understandable for an executive user.
    3. ### BUSINESS DATA: List precise metrics with descriptive context. Use professional business labels that explain the data (e.g., "Confirmed Revenue: $500 (Covering 4 transactions)" instead of "Amount: 500").
    4. FORBIDDEN: Do NOT use separate sections or headers for "INSIGHT" or "RECOMMENDATION". Successfully integrate all business value and insights directly into the ANALYSIS SUMMARY for a seamless, proper flow.
    5. QUALITY RULE: Prioritize "Proper and Understandable" language. Avoid raw technical jargon and aim for an expert human consultant's tone.
    6. TOTAL LENGTH: 120-180 words. Ensure the depth of the explanation provides absolute clarity.
    `;

    const stream = await groq.chat.completions.create({
        messages: [{ role: 'user', content: synthesisPrompt }],
        model: 'llama-3.3-70b-versatile',
        stream: true,
        temperature: 0.2
    });

    let fullText = "";
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
            fullText += content;
            onChunk({ text: content });
        }
    }

    // Send final metadata
    const intentMatch = fullText.match(/INTENT:\s*(\w+)/);
    const intent = intentMatch ? intentMatch[1] : "ANALYSIS";

    onChunk({
        done: true,
        intent: intent,
        elements: highlightElements
    });
}

module.exports = { handleChatStream };
