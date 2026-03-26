const express = require('express');
const router = express.Router();
const db = require('./db');
const ai = require('./ai');

// 1. Manual Init Endpoint
router.post('/api/init', async (req, res) => {
    try {
        await db.initDb();
        res.json({ message: "In-Memory Graph Constructed Seamlessly!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Core Graph Querying for Visualization
router.get('/graph', (req, res) => {
    try {
        const data = db.getInitialGraph();
        res.json(data);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/graph/expand/:id', (req, res) => {
    try {
        const data = db.expandNode(req.params.id);
        res.json(data);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Conversational AI endpoint (STREAMING)
router.get('/chat', async (req, res) => {
    const { message } = req.query;
    if (!message) return res.status(400).json({ error: "Message is required." });

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    try {
        await ai.handleChatStream(message, (chunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });
        res.end();
    } catch(err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

module.exports = router;
