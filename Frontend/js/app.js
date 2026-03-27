const COLORS = {
    'Customer': '#ff9e64', 'Order': '#9ece6a', 'OrderItem': '#7aa2f7',
    'Product': '#bb9af7', 'Delivery': '#e0af68', 'Invoice': '#f7768e',
    'JournalEntry': '#ff757f', 'Payment': '#4fd6be', 'Address': '#00b5e2',
    'Reference': '#808080', 'Default': '#cfc9c2'
};

const loader = document.getElementById('loader');
let cy;
let graphInitialized = false;
const expandedNodes = new Set();
const expansionLevels = new Map();

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function initCytoscape(data) {
    loader.style.display = 'none';
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: [...data.nodes, ...data.edges],
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(id)', 'font-size': '10px', 'color': '#c0caf5',
                    'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -5,
                    'background-color': e => COLORS[e.data('label')] || COLORS['Default'],
                    'width': e => Math.min(35, 15 + e.degree() * 1.5),
                    'height': e => Math.min(35, 15 + e.degree() * 1.5),
                    'border-width': 2, 'border-color': 'rgba(255,255,255,0.1)',
                }
            },
            {
                selector: 'edge',
                style: {
                    'label': 'data(label)', 'font-size': '7px', 'color': '#7aa2f7',
                    'curve-style': 'bezier', 'target-arrow-shape': 'triangle',
                    'width': 1, 'line-color': '#292e42', 'target-arrow-color': '#292e42',
                    'text-rotation': 'autorotate', 'text-margin-y': -5, 'opacity': 0.6
                }
            },
            {
                selector: 'node.highlight',
                style: {
                    'border-color': '#fff', 'border-width': 4, 'border-opacity': 1,
                    'width': 45, 'height': 45, 'z-index': 999
                }
            },
            {
                selector: 'node.primary',
                style: {
                    'border-color': '#7aa2f7', 'border-width': 5, 'border-opacity': 1,
                    'width': 50, 'height': 50, 'z-index': 1000,
                    'shadow-blur': 15, 'shadow-color': '#7aa2f7', 'shadow-opacity': 0.6
                }
            },
            {
                selector: 'node.level-1',
                style: {
                    'border-color': '#9ece6a', 'border-width': 3, 'border-opacity': 0.8,
                    'background-color': e => {
                        const base = COLORS[e.data('label')] || COLORS['Default'];
                        return hexToRgba(base, 0.9);
                    }
                }
            },
            {
                selector: 'node.level-2',
                style: {
                    'border-color': '#7aa2f7', 'border-width': 2, 'border-opacity': 0.6,
                    'background-color': e => {
                        const base = COLORS[e.data('label')] || COLORS['Default'];
                        return hexToRgba(base, 0.7);
                    }
                }
            },
            {
                selector: 'edge.expanded-edge',
                style: {
                    'width': 2.5, 'line-color': '#9ece6a', 'target-arrow-color': '#9ece6a', 'opacity': 0.9
                }
            },
            { selector: 'edge.highlight', style: { 'width': 3, 'line-color': '#7aa2f7', 'target-arrow-color': '#7aa2f7', 'opacity': 1 } },
            { selector: 'node.dim', style: { 'opacity': 0.15 } },
            { selector: 'edge.dim', style: { 'opacity': 0.05 } }
        ],
        layout: { name: 'cose', animate: false, nodeRepulsion: 400000, idealEdgeLength: 100, padding: 30, randomize: false, fit: true },
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
    });
    graphInitialized = true;

    let tappedBefore;
    let tappedTimeout;

    cy.on('tap', 'node', function (e) {
        const n = e.target;
        const nodeId = n.id();
        const currentLevel = expansionLevels.get(nodeId) || 0;

        if (tappedTimeout && tappedBefore === n) {
            clearTimeout(tappedTimeout);
            tappedTimeout = null;
            showInspector(n);
        } else {
            tappedTimeout = setTimeout(function () {
                tappedTimeout = null;
                if (expandedNodes.has(nodeId) && currentLevel >= 2) {
                    highlightNeighborhood(n);
                    return;
                }
                if (expandedNodes.has(nodeId) && currentLevel === 1) {
                    expandToLevel2(n);
                    return;
                }
                expandedNodes.add(nodeId);
                expansionLevels.set(nodeId, 1);
                loader.style.display = 'block';
                loader.innerText = 'Expanding level 1...';
                fetch(`http://graph-base-datamodeling.onrender.com/graph/expand/${encodeURIComponent(nodeId)}`)
                    .then(r => r.json())
                    .then(newData => {
                        loader.style.display = 'none';
                        const existingIds = new Set(cy.elements().map(e => e.id()));
                        const newNodes = newData.nodes.filter(el => !existingIds.has(el.data.id));
                        const newEdges = newData.edges.filter(el => !existingIds.has(el.data.id));
                        if (newNodes.length > 0 || newEdges.length > 0) {
                            cy.add([...newNodes, ...newEdges]);
                            const pos = n.position();
                            const addedNodes = cy.nodes().filter(nn => newNodes.some(x => x.data.id === nn.id()));
                            const count = addedNodes.length;
                            addedNodes.forEach((nn, i) => {
                                expansionLevels.set(nn.id(), 1);
                                const angle = (2 * Math.PI * i) / count;
                                const radius = 120;
                                nn.position({
                                    x: pos.x + radius * Math.cos(angle),
                                    y: pos.y + radius * Math.sin(angle)
                                });
                            });
                        }
                        highlightNeighborhoodWithLevels(n, 1);
                    })
                    .catch(err => {
                        loader.innerText = 'Error expanding';
                        setTimeout(() => loader.style.display = 'none', 1500);
                    });
            }, 250);
            tappedBefore = n;
        }
    });

    cy.on('tap', e => {
        if (e.target === cy) {
            cy.elements().removeClass('highlight dim primary level-1 level-2 expanded-edge');
        }
    });
}

function expandToLevel2(node) {
    const nodeId = node.id();
    const currentNeighbors = node.neighborhood();
    loader.style.display = 'block';
    loader.innerText = 'Expanding level 2...';
    const level2Promises = currentNeighbors.nodes().map(neighbor =>
        fetch(`http://graph-base-datamodeling.onrender.com/graph/expand/${encodeURIComponent(neighbor.id())}`)
            .then(r => r.json())
            .catch(() => ({ nodes: [], edges: [] }))
    );
    Promise.all(level2Promises).then(results => {
        loader.style.display = 'none';
        const existingIds = new Set(cy.elements().map(e => e.id()));
        const toAdd = [];
        results.forEach(data => {
            data.nodes.filter(el => !existingIds.has(el.data.id)).forEach(el => {
                toAdd.push(el);
                expansionLevels.set(el.data.id, 2);
            });
            data.edges.filter(el => !existingIds.has(el.data.id)).forEach(el => {
                toAdd.push(el);
            });
        });
        if (toAdd.length > 0) cy.add(toAdd);
        expansionLevels.set(nodeId, 2);
        highlightNeighborhoodWithLevels(node, 2);
    });
}

function highlightNeighborhoodWithLevels(node, level) {
    cy.elements().removeClass('highlight dim primary level-1 level-2 expanded-edge');
    const nodeId = node.id();
    const level1Set = node.neighborhood().add(node);
    level1Set.addClass('level-1');
    level1Set.edges().addClass('expanded-edge');
    if (level >= 2) {
        level1Set.nodes().forEach(n1 => {
            if (n1.id() !== nodeId) {
                const level2Nodes = n1.neighborhood().nodes().filter(n => !level1Set.contains(n));
                level2Nodes.forEach(n2 => {
                    n2.addClass('level-2');
                    n2.connectedEdges().addClass('expanded-edge');
                });
            }
        });
    }
    cy.elements().difference(level1Set).addClass('dim');
    level1Set.filter('node').removeClass('dim');
    cy.elements().filter(e => e.hasClass('level-2')).removeClass('dim');
    node.addClass('primary');
    cy.animate({ fit: { eles: level1Set.union(cy.elements().filter('.level-2')), padding: 80 }, duration: 600 });
}

function highlightNeighborhood(node) {
    cy.elements().removeClass('highlight dim primary level-1 level-2 expanded-edge');
    const nb = node.neighborhood().add(node);
    cy.elements().difference(nb).addClass('dim');
    nb.addClass('highlight');
    node.addClass('primary');
    cy.animate({ fit: { eles: nb, padding: 80 }, duration: 600 });
}

function showInspector(n) {
    const data = n.data();
    const level = expansionLevels.get(n.id());
    const levelBadge = level ? `<span class="level-badge">L${level}</span>` : '';
    const expandedBadge = expandedNodes.has(n.id()) ? `<span class="expanded-badge">EXPANDED ${levelBadge}</span>` : '';
    let html = `<div style="margin-bottom: 12px; padding-bottom: 2px;"><div style="font-size: 1.15rem; color: #fff; font-weight: 700; display: flex; align-items: center; gap: 8px;">${data.label} ${expandedBadge}</div></div>`;
    let propertiesHtml = '';
    let count = 0;
    const maxProps = 12;
    for (const k of Object.keys(data)) {
        if (['id', 'label', '_source'].includes(k)) continue;
        if (count >= maxProps) {
            propertiesHtml += `<div style="font-size: 0.8rem; color: #888; font-style: italic; margin-top: 10px;">Additional fields hidden for readability</div>`;
            break;
        }
        const val = data[k] !== null ? data[k] : '';
        if (val === '') continue;
        propertiesHtml += `<div style="margin-bottom: 6px; font-size: 0.9rem; line-height: 1.4;"><span style="color: var(--text-secondary); font-weight: 500;">${k}:</span> <span style="color: #fff; word-break: break-all;">${val}</span></div>`;
        count++;
    }
    html += `<div style="display: flex; flex-direction: column;"><div style="margin-bottom: 6px; font-size: 0.9rem; line-height: 1.4;"><span style="color: var(--text-secondary); font-weight: 500;">Entity:</span> <span style="color: #fff; word-break: break-all;">${data.label}</span></div>${propertiesHtml}</div>`;
    html += `<div style="margin-top: 10px; font-size: 0.9rem; margin-bottom: 10px;"><span style="color: var(--text-secondary); font-weight: 500;">Connections:</span> <span style="color: #fff;">${n.degree()}</span></div>`;
    document.getElementById('node-details').innerHTML = html;
}

function runLayout() {
    if (cy) {
        cy.layout({ name: 'cose', animate: false, nodeRepulsion: 400000, idealEdgeLength: 100, padding: 30, randomize: false, fit: true }).run();
    }
}

function loadGraphNow() {
    if (graphInitialized) return;
    loader.style.display = 'block';
    loader.innerText = 'Loading Graph (may take 5-10 seconds)...';
    fetch('http://graph-base-datamodeling.onrender.com/graph')
        .then(res => res.json())
        .then(data => {
            initCytoscape(data);
            document.getElementById('btn-layout').style.display = 'inline-block';
            document.getElementById('btn-reset').style.display = 'inline-block';
        })
        .catch(err => {
            loader.innerHTML = "Error loading. Check server logs.";
            loader.style.color = "#FF4136";
        });
}

document.getElementById('btn-layout').onclick = () => runLayout();
document.getElementById('btn-reset').onclick = () => {
    expandedNodes.clear();
    expansionLevels.clear();
    loader.style.display = 'block';
    loader.innerText = 'Reloading...';
    fetch('http://graph-base-datamodeling.onrender.com/graph')
        .then(res => res.json())
        .then(data => {
            if (cy) cy.destroy();
            graphInitialized = false;
            initCytoscape(data);
        });
};

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const messagesDiv = document.getElementById('chat-messages');

function appendMsg(content, sender) {
    const el = document.createElement('div');
    el.className = `msg ${sender}`;
    if (typeof content === 'string') {
        el.innerHTML = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    } else {
        el.innerHTML = `<div class="intent-tag">${content.intent || 'Analysis'}</div><div>${content.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</div>`;
    }
    messagesDiv.appendChild(el);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return el;
}

chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendMsg(msg, 'user');
    chatInput.value = '';
    const btn = document.getElementById('chat-submit');
    const originalBtnText = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '...';
    document.getElementById('chat-panel').classList.add('active');

    const aiMsgEl = appendMsg('', 'ai');
    let fullText = "";

    try {
        const response = await fetch(`http://graph-base-datamodeling.onrender.com/chat?message=${encodeURIComponent(msg)}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.replace('data: ', ''));
                        
                        if (data.text) {
                            fullText += data.text;
                            aiMsgEl.innerHTML = fullText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
                            messagesDiv.scrollTop = messagesDiv.scrollHeight;
                        }

                        if (data.done && data.elements && data.elements.length > 0) {
                            if (cy) {
                                const existingIds = new Set(cy.elements().map(e => e.id()));
                                const toAdd = data.elements.filter(e => !existingIds.has(e.data.id));
                                if (toAdd.length > 0) cy.add(toAdd);

                                cy.elements().removeClass('highlight dim primary level-1 level-2 expanded-edge');
                                const idsToHighlight = data.elements.map(e => e.data.id);
                                const collection = cy.elements().filter(e => idsToHighlight.includes(e.id()));

                                if (collection.length > 0) {
                                    cy.elements().difference(collection).addClass('dim');
                                    collection.addClass('highlight');
                                    cy.animate({ fit: { eles: collection, padding: 80 }, duration: 800 });
                                }
                            }
                        }
                        
                        if (data.error) {
                            aiMsgEl.innerHTML = `<div style="color: #f7768e;">Error: ${data.error}</div>`;
                        }
                    } catch (e) {
                        console.error("JSON Parse Error", e);
                    }
                }
            });
        }
    } catch (err) {
        aiMsgEl.innerHTML = `<div style="color: #f7768e;">Error: ${err.message}</div>`;
    } finally {
        btn.disabled = false; btn.innerHTML = originalBtnText;
    }
};

const mobileToggle = document.getElementById('mobile-chat-toggle');
const chatPanel = document.getElementById('chat-panel');
mobileToggle.onclick = () => {
    chatPanel.classList.toggle('active');
    mobileToggle.innerText = chatPanel.classList.contains('active') ? '✕' : '💬';
};

document.getElementById('btn-clear-chat').onclick = () => {
    messagesDiv.innerHTML = `<div class="msg ai"><div class="intent-tag">System</div>Chat cleared. How can I help you next?</div>`;
    if (cy) cy.elements().removeClass('highlight dim primary level-1 level-2 expanded-edge');
};

window.addEventListener('DOMContentLoaded', loadGraphNow);
