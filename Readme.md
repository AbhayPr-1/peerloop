# ⚡ PeerLoop – A Decentralized P2P Marketplace

**PeerLoop** is a full-stack decentralized peer-to-peer marketplace with a cyberpunk neon aesthetic, enabling users to buy and sell directly via the **Ethereum Virtual Machine (EVM)**, with no central intermediary.

The application is built using a **hybrid architecture: a Node.js/Express.js backend** for authentication/storage, and a **Hardhat/Solidity smart contract** for core marketplace logic (listing, buying, deleting). Real-time updates are handled by **Socket.IO and an Ethers.js Contract Listener**.

---

## 🎯 Project Philosophy – *Web3-Native Commerce*

PeerLoop transitions the core business logic—the transfer of assets (ETH) for goods (Products)—to an on-chain smart contract, ensuring **true peer-to-peer, trustless commerce**. The Node.js backend serves as a secure data layer (users, image hosting) and the real-time nervous system connecting clients to the blockchain's events. The cyberpunk aesthetic reinforces the theme of user autonomy and decentralized financial systems.

---

## ✨ Features

### 🔐 Web3 Authentication
- Login with MetaMask wallet address  
- Backend creates JWT session for secure API usage

### 💸 On-Chain Marketplace Logic
Handled fully via Solidity:
- `listProduct`
- `buyProduct`
- `deleteProduct`
- Fetch products from `getAllForSaleProducts`

### ⚡ Real-Time Synchronization
- Backend runs a **polling-based Ethers.js listener**
- Listens for:
  - `ProductListed`
  - `ProductSold`
  - `ProductDeleted`
- Emits live updates via Socket.IO  
- Frontend re-fetches products with a **1000ms delay** for blockchain confirmation

### 🖼️ IPFS Image Hosting
- Product images stored on Pinata/IPFS  
- Backend handles upload + returns public URL

### 🛒 Dynamic Marketplace UI
- Fully client-side SPA (Vanilla JS + Tailwind CSS)
- LocalStorage-based cart system
- Product state directly read from blockchain

---

## 🧠 Application Architecture (Hybrid Model)

| Component | Technology | Role |
|----------|------------|------|
| ⛓️ **Blockchain Layer** | Solidity, Hardhat | Core logic for trustless exchange (ETH ↔ Product) |
| 🧩 **Backend/API** | Node.js, Express, MongoDB, Ethers.js | Authentication, user metadata, image upload, contract listener |
| 💻 **Frontend (SPA)** | Vanilla JS, Tailwind, Ethers.js, Socket.IO | Executes transactions, real-time UI updates, renders marketplace |
| 🗄️ **Storage** | MongoDB + Pinata/IPFS | User data + image hosting |

---

# ⚙️ Getting Started

## 📋 Prerequisites
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)
- [MetaMask Extension](https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en) or other.
- Hardhat (auto-installed via npm)
- [Alchemy](https://www.alchemy.com/)/Infura RPC URL and [Pinata](https://pinata.cloud/) JWT are required for **.env files**.

---

# 1️⃣ Smart Contract Setup & Deployment

### Navigate to the contract folder:
```bash
cd PEERLOOP/smart-contract
```

### Install dependencies:
```bash
npm install
```

### Create `.env`:
```
SEPOLIA_RPC_URL=your_sepolia_rpc_url
PRIVATE_KEY=your_private_key
```

### Deploy contract:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

✔ Automatically updates  
- `backend/.env → CONTRACT_ADDRESS`  
- `frontend/js/contract.js → contractAddress`  

---

# 2️⃣ Backend Setup

### Navigate:
```bash
cd PEERLOOP/backend
```

### Install dependencies:
```bash
npm install
```

### Create `.env`:
```
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PINATA_JWT=your_pinata_jwt
SEPOLIA_RPC_URL=your_sepolia_rpc_url
CONTRACT_ADDRESS=0x... (auto-filled)
PORT=5000
```

### Run the backend(inside backend folder):
```bash
npx nodemon server.js
```

➡ Runs at: **http://localhost:5000**  
Starts:
- Express API  
- Contract Polling Listener  
- Socket.IO server  

---

# 3️⃣ Frontend Setup

### Navigate:
```bash
cd PEERLOOP/frontend
```

### Serve the UI:
```bash
npm install -g serve
serve
```

➡ Runs at: **http://localhost:3000/**

---

# 🔗 API Reference

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| **POST** | `/api/auth/metamask` | Login/Register user using wallet address | ❌ |
| **POST** | `/api/upload` | Upload product image to Pinata/IPFS | ✅ |
| **GET** | `/api/products` | (Deprecated) Product list moved on-chain | ❌ |
| **GET** | `/api/users/cart` | Fetch user cart | ✅ |
| **POST** | `/api/users/cart/:prodId` | Add product to cart | ✅ |
| **DELETE** | `/api/users/cart/:prodId` | Remove product from cart | ✅ |

---

# 🧪 Tech Stack

- **Smart Contract:** Solidity, Hardhat  
- **Backend:** Node.js, Express.js, MongoDB, Socket.IO  
- **Frontend:** Vanilla JS, TailwindCSS, Ethers.js  
- **Decentralized Storage:** Pinata + IPFS  
- **Blockchain Network:** Ethereum Sepolia Testnet  

---

# 🚀 Future Improvements
- Add escrow-based settlement  
- Improve decentralized storage fallback (multiple pinning providers)  
- Notifications via wallet signatures  
- Migrate to Layer 2 (Base / Arbitrum) for cheaper gas

---

# 🧾 Notes
- The backend's contract listener currently uses polling; consider switching to WebSocket providers (Alchemy/Infura) for more efficient event handling.  
- Frontend uses `fetchProducts(true)` with a 1000ms delay after events/tx to reduce UI race conditions with finality.
