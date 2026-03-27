const path = require('path');
// External .env no longer required - using direct paths for keys
const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');
const db = require('./src/db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

app.use('/', routes);

// Initialize Headless Database automatically
db.initDb().then(() => {
    app.listen(3000, () => {
         console.log("Modular Headless Cytoscape System Active: http://graph-base-datamodeling.onrender.com");
    });
}).catch(err => {
    console.error("Failed to initialize Graph:", err);
});
