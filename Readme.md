
# ⚡ PeerLoop – A Decentralized P2P Marketplace

**PeerLoop** is a full-stack decentralized peer-to-peer marketplace with a **cyberpunk neon aesthetic**, enabling users to **buy and sell directly** — no intermediaries, no middlemen.

Built with **Node.js**, **Express.js**, **MongoDB**, **Socket.IO**, and a **Vanilla JS frontend**, PeerLoop delivers real-time updates, Web3 integration, and a sleek user experience.

---

## ✨ Key Features

### 🔐 Complete User Authentication
- Standard registration (name, email, password)
- Login via email/username + password
- Web3 login via **MetaMask** wallet
- Persistent sessions secured with **JWT**

### 🛒 Dynamic Marketplace
- Real-time product grid view
- Instant **search**, **filter**, and **sort**
- Category filters (Electronics, Wearables, etc.)
- Live updates with Socket.IO

### 💸 Seamless Selling
- “Sell Your Gear” form for logged-in users
- Upload item details, image, and price (in ETH)
- Instantly listed in marketplace

### 🧺 Integrated Shopping Cart
- Add / remove items easily
- Auto-updating total price
- Checkout multiple items at once

---

## 🧠 Application Architecture

PeerLoop follows a **client-server architecture** enhanced with a **real-time communication layer**.

| Component | Description |
|------------|-------------|
| 🧩 **Backend (Brain)** | Node.js + Express.js API managing business logic, authentication, and database ops |
| 💻 **Frontend (Face)** | Lightweight SPA built with Vanilla JS and Tailwind CSS |
| 🗄️ **Database (Memory)** | MongoDB + Mongoose to persist users, products, and cart data |
| ⚡ **Real-Time Layer (Nervous System)** | Socket.IO for live, two-way updates between clients and server |

---

## 🧱 Technology Stack

### 🔙 Backend
- **Node.js** – Non-blocking, event-driven architecture
- **Express.js** – RESTful API framework
- **MongoDB + Mongoose** – NoSQL data modeling
- **JWT** – Stateless user authentication
- **bcrypt.js** – Password hashing
- **Socket.IO** – Real-time event updates

### 🎨 Frontend
- **Vanilla JS (ES6+)** – Lightweight, modular frontend
- **Tailwind CSS (CDN)** – Rapid UI styling
- **Custom CSS** – Neon cyberpunk theme
- **Ethers.js (CDN)** – Web3 + MetaMask integration
- **Socket.IO Client** – Live updates

---

## ⚙️ Getting Started

### 📋 Prerequisites
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)

---

### 🖥️ Backend Setup
```bash
cd path/to/PEERLOOP/backend
npm install
```

Create a `.env` file in `/backend`:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_strong_random_secret_key
PORT=5000
```

Start the backend server:
```bash
npm run dev
```
Server runs at 👉 `http://localhost:5000`

---

### 🌐 Frontend Setup
Install a static server:
```bash
npm install -g serve
```
Serve the frontend:
```bash
cd path/to/PEERLOOP/frontend
serve
```
Frontend runs at 👉 `http://localhost:3000`

---

## 🗂️ Project Structure
```
PEERLOOP/
├── backend/
│   ├── .env
│   ├── server.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── Product.js
│   │   └── User.js
│   └── routes/
│       ├── auth.js
│       ├── products.js
│       └── users.js
└── frontend/
    ├── index.html
    ├── css/
    └── js/
```

---

## 🔗 API Reference
| Method | Path | Description | Auth |
|--------|------|--------------|------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| POST | `/api/auth/metamask` | Login/Register via MetaMask | ❌ |
| GET | `/api/products` | Fetch all products | ❌ |
| POST | `/api/products` | Create product listing | ✅ |
| POST | `/api/products/:id/buy` | Purchase product | ✅ |
| DELETE | `/api/products/:id` | Delete own product | ✅ |
| GET | `/api/users/cart` | Get user cart | ✅ |
| POST | `/api/users/cart/:prodId` | Add product to cart | ✅ |
| DELETE | `/api/users/cart/:prodId` | Remove from cart | ✅ |

---

# Full Architecture Documentation

## Part 1: High-Level Architecture

The application follows a **classic client-server architecture** enhanced with a **real-time communication layer**.

### Backend (The Brain)
A **Node.js/Express.js server** acts as the central authority.  
It serves a **RESTful API** for all primary data operations (creating users, listing products, etc.).  
It connects to the database and is responsible for **all business logic, validation, and authentication**.

### Frontend (The Face)
A static **Single-Page Application (SPA)** built with **vanilla HTML, CSS, and JavaScript** that runs in the user's browser.  
It has no initial data and is purely a **visual shell**.  
It becomes functional by making **API requests** to the backend to fetch and send data, and then rendering that data dynamically on the page.

### Database (The Memory)
A **MongoDB** database stores all persistent data, primarily in two collections: `users` and `products`.  
It holds everything from **user credentials and cart contents** to **product details and sales history**.

### Real-Time Layer (The Nervous System)
**Socket.IO** provides a persistent, **two-way communication channel** between the server and all connected clients.  
When a critical event happens (like a product being sold), the server **instantly pushes updates** to all clients, ensuring everyone’s view is synchronized **without needing to manually refresh**.

---

## Part 2: The Backend (Server-Side)

The backend is responsible for **data integrity, security, and business logic**.

### Server Setup (`server.js`)
**Main Entry Point** for the backend.

**Initialization:** Initializes an Express.js app.

**Real-Time Integration:** Creates an HTTP server and integrates Socket.IO.

**Middleware:**
- `cors` — Allows the frontend (on a different port) to make requests.
- `express.json()` — Parses incoming JSON requests.

**Database Connection:**  
Uses **Mongoose** to connect to MongoDB via the `.env` connection string.

**API Routing:**  
Defines API base paths (like `/api/auth`, `/api/products`) and directs requests to route files.  
Routes that need real-time events attach the `io` instance to the request object (`req.io`).

---

### Data Modeling (`models/`)

#### `User.js`
Defines `UserSchema` with fields:
- `name`: Required, unique String.
- `email`: Required, unique String.
- `password`: Required String (stored as hash).
- `walletAddress`: Optional, unique String (for MetaMask users).
- `cart`: Array of ObjectIds referencing `Product` documents.

#### `Product.js`
Defines `ProductSchema` with fields:
- `name`, `description`, `price`, `category`, `imageUrl`: Basic details.
- `seller`: ObjectId referencing `User`.
- `status`: Enum, `'for-sale'` (default) or `'sold'`.
- `buyer`: Optional ObjectId referencing `User`.

---

### Middleware (`middleware/authMiddleware.js`)
Acts as a **security gatekeeper** for protected routes.

**Steps:**
1. Extracts token from `x-auth-token` header.
2. Verifies it using `jwt.verify()` with `JWT_SECRET`.
3. Attaches decoded payload (`req.user`) to the request.
4. If invalid/missing → `401 Unauthorized`.

---

### API Routes & Endpoints (`routes/`)

#### **Authentication (`/api/auth`)**

**POST /register**
- Validates fields.
- Checks for duplicates.
- Hashes password with bcrypt.
- Saves user, generates JWT, and responds.

**POST /login**
- Finds user by name/email.
- Compares password hash.
- Returns JWT on success.

**POST /metamask**
- Logs in or registers via wallet address.
- Creates new user if not found, returns JWT.

---

#### **Products (`/api/products`)**

**GET /** — Fetch all `for-sale` products.  
Uses `.populate('seller', 'name')`.

**POST /** — Protected. Create new product.
- Verifies token.
- Sets `seller` to `req.user.id`.
- Emits `product_added` event via Socket.IO.

**POST /:id/buy** — Protected. Mark as sold.
- Prevents self-purchase.
- Updates `status` and `buyer`.
- Removes from all user carts.
- Emits `product_sold` event.

**DELETE /:id** — Protected. Delete product.
- Only seller can delete.
- Removes product and cleans up references.
- Emits `product_deleted` event.

---

#### **Users (`/api/users`)**

**GET /cart** — Protected.
- Returns populated user cart (`.populate('cart')`).

**POST /cart/:productId** — Protected.
- Adds product to user’s cart and returns updated cart.

**DELETE /cart/:productId** — Protected.
- Removes product from cart and returns updated cart.

---

## Part 3: The Frontend (Client-Side)

Responsible for **rendering UI**, handling **user interaction**, and **communicating** with backend APIs.

### Core JavaScript Logic (`js/`)

#### `main.js` (The Orchestrator)
Executed on `DOMContentLoaded`:
- Connects to Socket.IO and listens for `product_added`, `product_sold`, etc.
- Calls `checkAuthState()`.
- Calls `fetchProducts()` for initial data.
- Attaches global UI and modal event listeners.

#### `marketplace.js` (The View)
Handles **product rendering and interaction**.

- `createProductCard(product)`: Returns a complete HTML card for a product with internal event listeners for “Buy Now”, “Add to Cart”, etc.
- `renderProducts(list)`: Clears grid and re-renders products.
- `filterAndSortProducts()`: Filters/sorts `allProducts` then re-renders.
- `buyNow(productId)` / `deleteProduct(productId, button)`: Call backend APIs, update local state, and trigger re-render.

#### `ui.js` (The Stage Manager)
Controls what is visible on screen.
- `showSection(sectionId)`: SPA navigation core.
- `showConfirmationModal(message, callback)`: Displays a confirmation pop-up. Executes callback only on user confirmation.

#### `auth.js` & `cart.js`
Dedicated services for:
- **auth.js:** Handles registration, login, MetaMask auth, and JWT storage.
- **cart.js:** Handles add/remove/view cart operations and syncs with API responses.

---

## Summary
This architecture provides:
- **Scalable separation of concerns**
- **Real-time interactivity**
- **Secure, token-based authentication**
- **Reusable frontend components**
- **Instant synchronization across clients**