// frontend/js/contract.js

// This address will be AUTO-UPDATED by your deploy script.
const marketplaceAddress = "0x8693297bD80A12b91d7d890A7d469FCb02E2574D";

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

// // --- CONTRACT INITIALIZATION ---

// readOnlyContract: always uses the Alchemy RPC, safe for view calls regardless of
// which network MetaMask is currently connected to. Never gets replaced.
let readOnlyContract = null;

// marketplaceContract: connected to the user's MetaMask signer after login; used for
// write transactions. Falls back to readOnlyContract when the user is not logged in.
let marketplaceContract = null;

let signer = null;

// Fallback RPC URL used if the backend is unreachable
const FALLBACK_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/alch_yHvcE0Qup3Q0iqqT1C3FZ";

// Fetches the RPC URL from the backend and initializes the read-only contract.
// Falls back to the bundled RPC URL if the backend is unavailable.
async function initializeReadOnlyProvider() {
    let rpcUrl = FALLBACK_RPC_URL;
    try {
        const response = await fetch(`${API_URL}/api/config/rpc-url`);
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }
        const data = await response.json();
        if (data.rpcUrl) rpcUrl = data.rpcUrl;
    } catch (e) {
        console.warn("Could not fetch RPC URL from backend, using fallback:", e.message);
    }

    try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        readOnlyContract = new ethers.Contract(marketplaceAddress, marketplaceABI, provider);
        // Also initialise marketplaceContract so reads work before the user logs in
        marketplaceContract = readOnlyContract;
        console.log("Contract read-only instance created successfully.");
    } catch (e) {
        console.error("Fatal: Could not initialize contract instance:", e);
    }
}

// Upgrades marketplaceContract to a write-capable instance connected to the user's signer.
// readOnlyContract is intentionally NEVER replaced — it always uses the stable Alchemy RPC
// so that view calls work regardless of which network MetaMask is on.
async function connectContractToSigner(loggedInSigner) {
    if (!loggedInSigner) {
        console.error("Signer is missing, contract cannot be connected.");
        return;
    }
    signer = loggedInSigner;

    if (readOnlyContract) {
        // Connect a NEW instance to the signer; leave readOnlyContract untouched
        marketplaceContract = readOnlyContract.connect(signer);
    } else {
        // Fallback: read-only init failed, use signer's provider for everything
        marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceABI, signer);
        readOnlyContract = marketplaceContract;
        console.warn("readOnlyContract was null; using signer provider as fallback.");
    }
    console.log("Contract connected to user's signer.");
}

const SEPOLIA_HEX_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

async function refreshSigner() {
    if (typeof window.ethereum === "undefined") return;
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    signer = web3Provider.getSigner();
    if (readOnlyContract) {
        marketplaceContract = readOnlyContract.connect(signer);
    }
}

async function ensureSepoliaNetwork() {
    if (typeof window.ethereum === "undefined") return;
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (parseInt(currentChainId, 16) !== 11155111) {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            chainId: SEPOLIA_HEX_CHAIN_ID,
                            chainName: "Sepolia Testnet",
                            nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
                            rpcUrls: ["https://rpc.sepolia.org", "https://eth-sepolia.g.alchemy.com/v2/alch_yHvcE0Qup3Q0iqqT1C3FZ"],
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
                        },
                    ],
                });
            } else {
                throw new Error("Please switch your MetaMask network to Sepolia Testnet.");
            }
        }
    }
    await refreshSigner();
}

if (typeof window.ethereum !== "undefined") {
    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}
