// frontend/js/contract.js

// This address will be AUTO-UPDATED by your deploy script.
const marketplaceAddress = "0x67499f2102193644022972F56063E60B1F074E64";

// *** PASTE YOUR NEW ABI (from Marketplace.json) HERE ***
const marketplaceABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "seller",
          "type": "address"
        }
      ],
      "name": "ProductDeleted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "price",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "imageUrl",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "seller",
          "type": "address"
        }
      ],
      "name": "ProductListed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "price",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "seller",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "buyer",
          "type": "address"
        }
      ],
      "name": "ProductSold",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_id",
          "type": "uint256"
        }
      ],
      "name": "buyProduct",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_id",
          "type": "uint256"
        }
      ],
      "name": "deleteProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAllForSaleProducts",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "description",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "price",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "imageUrl",
              "type": "string"
            },
            {
              "internalType": "address payable",
              "name": "seller",
              "type": "address"
            },
            {
              "internalType": "address payable",
              "name": "buyer",
              "type": "address"
            },
            {
              "internalType": "bool",
              "name": "isSold",
              "type": "bool"
            }
          ],
          "internalType": "struct Marketplace.Product[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_description",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_priceInWei",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "_imageUrl",
          "type": "string"
        }
      ],
      "name": "listProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "products",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "description",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "price",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "imageUrl",
          "type": "string"
        },
        {
          "internalType": "address payable",
          "name": "seller",
          "type": "address"
        },
        {
          "internalType": "address payable",
          "name": "buyer",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "isSold",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
];

// --- CONTRACT INITIALIZATION ---

let marketplaceContract = null; // Contract instance, initialized asynchronously
let signer = null; // No signer by default

// New function to securely fetch the RPC URL and initialize the contract
async function initializeReadOnlyProvider() {
    try {
        const response = await fetch(`${API_URL}/api/config/rpc-url`);
        if (!response.ok) {
            throw new Error('Failed to fetch RPC URL from backend.');
        }
        const { rpcUrl } = await response.json();

        // Use the dynamically fetched URL to initialize the read-only provider
        const readOnlyProvider = new ethers.providers.JsonRpcProvider(rpcUrl); 
        
        // Initialize the contract with the new provider
        marketplaceContract = new ethers.Contract(
            marketplaceAddress,
            marketplaceABI,
            readOnlyProvider
        );
        console.log("Contract read-only instance created successfully.");
    } catch (e) {
        console.error("Error initializing read-only contract instance:", e);
        // showMessage("Connection error: Could not connect to network provider.", 5000);
    }
}

// This function "upgrades" the contract to a read-write (signer) connection
async function connectContractToSigner(loggedInSigner) {
    if (!loggedInSigner) {
        console.error("Signer is missing, contract cannot be connected.");
        return;
    }
    signer = loggedInSigner;
    
    // We must ensure marketplaceContract exists before connecting the signer
    if (!marketplaceContract) {
        // If contract failed to initialize before, try to use the signer's provider as a fallback
        marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceABI, loggedInSigner.provider);
        console.warn("Using signer's provider as fallback for read-only connection.");
    }

    // Connect the signer to the contract instance (this is a new instance that sends transactions)
    marketplaceContract = marketplaceContract.connect(signer);
    console.log("Contract connected to user's signer.");
}

