const fetch = require('node-fetch');

async function test(query) {
    console.log(`\nTesting Query: "${query}"`);
    const response = await fetch(`http://localhost:3000/chat?message=${encodeURIComponent(query)}`);
    
    return new Promise((resolve) => {
        let fullText = "";
        response.body.on('data', (chunk) => {
            const chunkStr = chunk.toString();
            const lines = chunkStr.split('\n');
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.replace('data: ', ''));
                        if (data.text) {
                            fullText += data.text;
                        }
                        if (data.done) {
                            // Finished
                        }
                    } catch (e) {}
                }
            });
        });
        response.body.on('end', () => {
            console.log(`Response: ${fullText}`);
            resolve();
        });
    });
}

async function run() {
    await test("Which products have the most bills?");
    await test("Write a short poem about SAP.");
    await test("Who is the president of the United States?");
}

console.log("Waiting for graph to load (15 seconds)...");
setTimeout(run, 15000); 
