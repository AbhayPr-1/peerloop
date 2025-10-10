===================================================
                PEERLOOP - PROJECT MANUAL
===================================================

This document provides a comprehensive overview of the PeerLoop application,
including its features, technology stack, setup instructions, and detailed application workflows.


-------------------
1. PROJECT OVERVIEW
-------------------

PeerLoop is a full-stack web application designed as a decentralized, direct peer-to-peer marketplace. It features a modern, cyberpunk aesthetic with neon visuals and dynamic animations. The application allows users to register, log in, list items for sale, browse a marketplace, and purchase items from other users.


-------------------
2. FEATURES
-------------------

- User Authentication:
  - Standard registration with name, email, and password.
  - Login using either email/username and password.
  - Web3 login/registration using a MetaMask wallet.
  - Persistent sessions managed by JSON Web Tokens (JWT).

- Marketplace:
  - View all listed products in a grid layout.
  - Search products by name or description.
  - Filter products by category (Electronics, Wearables, etc.).
  - Sort products by date, price, or name.

- Selling:
  - Authenticated users can access a "Sell Your Gear" form.
  - Create new product listings with a name, description, price (in ETH), category, and an image upload.

- Shopping Cart:
  - Add items to a personal shopping cart.
  - View all items in the cart with a running total.
  - Remove items from the cart.
  - "Checkout" function to purchase all items in the cart.


-------------------
3. TECHNOLOGY STACK
-------------------

- Backend:
  - Runtime: Node.js
  - Framework: Express.js
  - Database: MongoDB with Mongoose ODM
  - Authentication: JSON Web Tokens (jsonwebtoken)
  - Password Hashing: bcryptjs

- Frontend:
  - Structure: HTML5, JavaScript (ES6+)
  - Styling: Tailwind CSS (via CDN) and custom CSS
  - Web3: Ethers.js (via CDN) for MetaMask interaction


-------------------
4. SETUP AND INSTALLATION
-------------------

To run this project, you need two terminals: one for the backend and one for the frontend.

--- Backend Setup (Terminal 1) ---

1. Navigate to Directory:
   cd path/to/PEERLOOP/backend

2. Create .env File:
   Create a file named `.env` in the `backend` directory with the following content. Generate your own JWT_SECRET for production.
   
   MONGO_URI=mongo uri(go create here "https://www.mongodb.com")
   JWT_SECRET=generate one
   PORT=5000

3. Install Dependencies:
   npm install

4. Run Server:
   change directory to backend folder first
   npm run dev
  or npm nodemon server.js(change directory to backend folder first)
   The backend will be running on http://localhost:5000.


--- Frontend Setup (Terminal 2) ---

1. Install 'serve' (one-time global install):
   npm install -g serve

2. Navigate to Directory:
   cd path/to/PEERLOOP/frontend

3. Serve Files:
   serve
   The frontend will be accessible at a URL like http://localhost:3000.


-------------------
5. PROJECT STRUCTURE
-------------------

PEERLOOP/
|-- .gitignore
|-- package.json
|-- backend/
|   |-- .env
|   |-- server.js
|   |-- middleware/
|   |   +-- authMiddleware.js
|   |-- models/
|   |   |-- Product.js
|   |   +-- User.js
|   +-- routes/
|       |-- auth.js
|       |-- products.js
|       +-- users.js
|-- frontend/
|   |-- index.html
|   |-- css/
|   |   |-- ... (all stylesheets)
|   +-- js/
|       |-- ... (all client-side scripts)
+-- node_modules/


-------------------
6. API ENDPOINTS
-------------------

Base URL: http://localhost:5000

--- Authentication (/api/auth) ---

- POST /register
- POST /login
- POST /metamask

--- Products (/api/products) ---

- GET /
- POST / (Protected)
- DELETE /:id (Protected)

--- User & Cart (/api/users) ---

- GET /cart (Protected)
- POST /cart/:productId (Protected)
- DELETE /cart/:productId (Protected)


---------------------------------------------
7. DETAILED WORKFLOWS (HOW EVERYTHING WORKS)
---------------------------------------------

This section provides a granular, step-by-step technical explanation of the application's core features.

--- User Authentication Flow ---

1.  **Frontend - Initiation**: A user clicks the "Login" button, which calls the `showAuthModal` function. This displays a modal with the login and signup forms.

2.  **Frontend - Data Submission**: The user fills and submits a form. An event listener in `main.js` prevents the default form submission and calls either `handleLogin` or `handleSignup`. The function then sends a POST request to the corresponding backend endpoint (`/api/auth/login` or `/api/auth/register`) with the user's data in the request body.

3.  **Backend - Processing**:
    - The Node.js server receives the request at the `/api/auth` route.
    - For registration, the server first checks if a user with that email or name already exists using a Mongoose query: `User.findOne({ $or: [{ email }, { name }] })`.
    - It then securely hashes the user's password using `bcrypt.genSalt` and `bcrypt.hash`.
    - A new `User` document is created and saved to the MongoDB database.
    - For login, the server finds the user and compares the provided password with the stored hash using `bcrypt.compare`.

4.  **Backend - Token Generation**:
    - Upon successful authentication, a JWT payload is created containing the user's unique ID: `{ user: { id: user.id } }`.
    - This payload is signed into a JWT using the `JWT_SECRET` from the `.env` file, with an expiration of 24 hours.
    - The server sends a JSON response back to the frontend containing this token and basic user info.

5.  **Frontend - Session Management**:
    - The client-side JavaScript receives the token. It stores the token and username in the browser's `localStorage` for session persistence.
    - The global `currentUser` variable is updated.
    - The `renderUI()` function is called to dynamically update the navigation bar (e.g., changing "Login" to "Logout"). The user's cart is also fetched from the server.

--- Product Listing Flow ---

1.  **Frontend - Form & Image Handling**:
    - A logged-in user navigates to the "Sell" tab.
    - When they select an image, an event listener triggers. The browser's `FileReader` API is used. The `reader.readAsDataURL(file)` method reads the image, and upon completion, the `reader.onload` event fires.
    - Inside `onload`, the result (a base64 data string) is assigned to the `src` of the preview image element, making it visible.

2.  **Frontend - API Request**:
    - On form submission, a single POST request is made to `/api/products`.
    - The request body is a JSON object containing all the form fields, with the base64 string assigned to the `imageUrl` key.
    - Crucially, the user's JWT is retrieved from `localStorage` and included in the request headers as `x-auth-token`.

3.  **Backend - Authorization & Creation**:
    - The `authMiddleware` runs first. It extracts and verifies the token from the header. If valid, it decodes the user's ID and attaches it to the request object as `req.user`.
    - The `/api/products` route handler then executes. It creates a new Mongoose `Product` document, taking the product details from `req.body` and the seller's ID from `req.user.id`.
    - The `product.save()` method persists this new document to the database.

4.  **Frontend - UI Update**:
    - Upon receiving a successful response (containing the newly created product), the frontend uses `allProducts.unshift(newProduct)` to add the new item to the *beginning* of its local product array.
    - `filterAndSortProducts()` is called immediately to re-render the marketplace, so the user sees their new listing instantly without a page reload.

--- Marketplace Filtering and Sorting Flow ---

1.  **Initial Data Fetch**: When the app loads, `fetchProducts()` sends a GET request to `/api/products`. The backend returns the *entire* collection of products. This data is stored client-side in the `allProducts` global array.

2.  **Client-Side Logic**: All subsequent filtering and sorting happens entirely on the client side for speed.
    - An event listener on the search input, category select, or sort select triggers the `filterAndSortProducts` function.
    - Inside this function, a *temporary copy* of the `allProducts` array is created: `let list = [...allProducts]`.
    - A series of JavaScript array methods are chained on this temporary list:
        - `list.filter()` is used to match the search query and category.
        - `list.sort()` is used with a custom comparison function based on the selected sort option (price, name, etc.).
    - The final, filtered, and sorted `list` is then passed to the `renderProducts` function, which clears the old view and builds the new product cards on the DOM.

--- Cart and Purchase Flow ---

1.  **Adding to Cart**:
    - A user clicks "Add to Cart". The `addToCart` function sends a POST request to `/api/users/cart/:productId`, including the auth token.
    - The backend `authMiddleware` identifies the user. The route handler finds the user's document in MongoDB, pushes the `productId` (as a `mongoose.Schema.Types.ObjectId`) into the `cart` array defined in the `UserSchema`, and saves the document.
    - The server responds with the user's fully populated cart (`.populate('cart')` is used to replace the product IDs with the full product objects).
    - The frontend updates its local `userCart` variable with this new data and updates the cart count indicator.

2.  **"Buy Now" (Simulated Purchase)**:
    - A user clicks "Buy Now". The `buyNow` function sends a DELETE request to `/api/products/:id`.
    - The backend `authMiddleware` verifies the user. The route handler finds the product by its ID.
    - A critical check, `product.seller.toString() === req.user.id`, prevents a user from buying their own item. (`.toString()` is needed to compare the Mongoose ObjectId object with the string from the token).
    - If the check passes, `product.deleteOne()` permanently removes the item from the `Products` collection in the database.
    - The frontend receives a success message. It then removes the product from the `allProducts` array and calls `removeFromCart(productId, false)` to ensure the cart is also updated, all without showing extra messages.