# 📊 SAP O2C Graph Intelligence System

[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Groq AI](https://img.shields.io/badge/AI-Llama--3.3--70B-f34f29?logo=meta&logoColor=white)](https://groq.com/)
[![Cytoscape](https://img.shields.io/badge/Visualization-Cytoscape.js-FF6F00?logo=cytoscape&logoColor=white)](https://js.cytoscape.org/)

A high-performance, real-time Order-to-Cash (O2C) analytical dashboard. This system constructs a complex business flow graph from SAP data stored in MongoDB Atlas and allows for natural language exploration using a strictly-guarded AI analytical brain.

---
## 🌐 Live Demo

🔗 [View Live Project](https://graph-base-datamodeling-1.onrender.com/)

## 🚀 Key Features

### 🔍 Conversational Business Intelligence
Explore your SAP data using natural language. The AI translates business questions into complex graph traversals and MongoDB queries in real-time.
- **Answer-First Policy**: All AI reports begin with a direct answer to the user's specific business question.
- **Professional Persona**: Descriptive, understandable business narratives (120-180 words) tailored for executive decision-making.

### ⚡ Real-Time SSE Streaming
The analysis is streamed directly to the frontend using **Server-Sent Events (SSE)**, providing a responsive "typing" effect rather than waiting for full JSON payloads.

### 🛡️ Double-Lock Domain Firewall
Strict security guardrails ensure the system only answers questions related to the O2C dataset.
- **Instant Rejection**: General knowledge, creative writing, or unrelated news inquiries are blocked with a professional domain-restriction message.

### 📈 Dynamic Graph Highlighting
The system features an **ID-to-Element resolution engine** that automatically highlights relevant nodes (Orders, Invoices, Delivery items) in the graph as the AI provides its analysis.

---

## 🏗️ Architecture

- **Backend**: Node.js & Express.
- **In-Memory Graph**: A headless **Cytoscape.js** instance on the server maintains a live-synced business flow graph of over **1,100 edges**.
- **Database**: **MongoDB Atlas** for persistent document storage and metadata enrichment.
- **AI Brain**: **Groq (Llama-3.3-70B-Versatile)** for translating natural language into high-quality graph analytical reports.

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas Account
- Groq Cloud API Key

### 2. Configuration
Create a `.env` file in the `Backend/` directory:
```env
MONGODB_URI=your_mongodb_atlas_uri
MONGODB_DB_NAME=o2c_database
GROQ_API_KEY=your_groq_api_key
PORT=3000
```

### 3. Installation
```bash
# Clone the repository
cd Backend
npm install

# Start the server
node server.js
```

### 4. Accessing the Dashboard
Open your resident browser and navigate to:
**`http://localhost:3000`**

---

## 💡 Example Queries

- **Flow Tracing**: *"Trace billing document 91150083 and show its full flow."*
- **Volume Analysis**: *"Which products are associated with the highest number of billing documents?"*
- **Bottleneck Detection**: *"Identify sales orders that are delivered but not yet billed."*
- **Partner Search**: *"Show me all orders placed by the customer 'Domestic Customer India'."*

---

## 🎨 Design Aesthetics
The frontend features a **"Tokyo Night" Glassmorphic Design**:
- Semi-transparent sidebar panels.
- Deep blue radial gradients for the viewport.
- High-contrast entity coloring (O2C Color Scheme: Green for Orders, Red for Invoices, Blue for Deliveries).

---

## ⚖️ License
Internal SAP O2C Analytical Tool. Unauthorized distribution is prohibited.
