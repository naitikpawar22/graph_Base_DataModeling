const db = require('./Backend/src/db');
db.initDb().then(() => {
    console.log("Init OK");
    const graph = db.getInitialGraph();
    console.log("Nodes:", graph.nodes.length);
    process.exit(0);
}).catch(err => {
    console.error("Init Failed:", err);
    process.exit(1);
});
