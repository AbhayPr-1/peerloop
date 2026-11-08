// frontend/js/contract.js

const marketplaceAddress = "0x2F9dd22a3431Dcad05dd9E9fb6b2927e8ed905F5";
const marketplaceDeploymentBlock = 12082533;


// // --- CONTRACT INITIALIZATION ---

// readOnlyContract: always uses the public Sepolia RPC, independent of
// which network MetaMask is currently connected to. Never gets replaced.
let readOnlyContract = null;

// marketplaceContract: connected to the user's MetaMask signer after login; used for
// write transactions. Falls back to readOnlyContract when the user is not logged in.
let marketplaceContract = null;

let signer = null;
let walletProvider = null;
let readOnlyProviderReady = Promise.resolve();
let readOnlyRpcUrls = [];
const readOnlyContractsByUrl = new Map();

// Public RPCs keep marketplace reads available if a configured endpoint fails.
const FALLBACK_RPC_URLS = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://sepolia.gateway.tenderly.co"
];

function withTimeout(promise, timeoutMs, message) {
    let timeout;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
        })
    ]).finally(() => clearTimeout(timeout));
}

// Validate the chain and marketplace deployment before selecting a read-only RPC.
async function initializeReadOnlyProvider() {
    const rpcUrls = [];
    const configAbortController = new AbortController();
    const configTimeout = setTimeout(() => configAbortController.abort(), 3000);
    try {
        const data = await window.PeerLoopApi.config.getRpcUrl(configAbortController.signal);
        if (data.rpcUrl) rpcUrls.push(data.rpcUrl);
    } catch (e) {
        console.warn("Could not fetch RPC URL from backend; trying public Sepolia RPCs:", e.message);
    } finally {
        clearTimeout(configTimeout);
    }

    readOnlyRpcUrls = [...new Set([...FALLBACK_RPC_URLS, ...rpcUrls])];
    for (const rpcUrl of readOnlyRpcUrls) {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      provider.pollingInterval = 2000;
      try {
        const network = await withTimeout(
            provider.getNetwork(),
            5000,
            `${new URL(rpcUrl).hostname} did not respond during network detection.`
        );
        if (Number(network.chainId) !== 11155111) {
            throw new Error(`RPC endpoint returned unexpected chain ID ${network.chainId}.`);
        }
        const code = await withTimeout(
            provider.getCode(marketplaceAddress),
            5000,
            `${new URL(rpcUrl).hostname} did not respond during contract verification.`
        );
        if (!code || code === '0x') {
            throw new Error('Marketplace contract is not deployed on this RPC endpoint.');
        }

        readOnlyContract = new ethers.Contract(marketplaceAddress, marketplaceABI, provider);
        readOnlyContractsByUrl.set(rpcUrl, readOnlyContract);
        // Also initialise marketplaceContract so reads work before the user logs in
        marketplaceContract = readOnlyContract;
        console.log(`Contract read-only instance created using ${new URL(rpcUrl).hostname}.`);
        return;
      } catch (error) {
        console.warn(`Could not initialize contract RPC ${new URL(rpcUrl).hostname}:`, error.message);
      }
    }

    readOnlyContract = null;
    marketplaceContract = null;
    console.error("Fatal: No available Sepolia RPC could connect to the marketplace contract.");
}

function getReadOnlyContract(rpcUrl) {
    if (!readOnlyContractsByUrl.has(rpcUrl)) {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl, { chainId: 11155111, name: 'sepolia' });
        readOnlyContractsByUrl.set(rpcUrl, new ethers.Contract(marketplaceAddress, marketplaceABI, provider));
    }
    return readOnlyContractsByUrl.get(rpcUrl);
}

function withReadTimeout(promise, rpcUrl) {
    return withTimeout(
        promise,
        7000,
        `${new URL(rpcUrl).hostname} did not respond in time.`
    );
}

async function readMarketplaceProducts() {
    await readOnlyProviderReady;
    if (!readOnlyContract) throw new Error('The marketplace contract is not connected.');

    const rpcUrls = readOnlyRpcUrls.length ? readOnlyRpcUrls : [FALLBACK_RPC_URLS[0]];
    try {
        const result = await Promise.any(rpcUrls.map(async (rpcUrl) => {
            const contract = getReadOnlyContract(rpcUrl);
            const products = await withReadTimeout(contract.getAllForSaleProducts(), rpcUrl);
            return { contract, products };
        }));
        readOnlyContract = result.contract;
        if (!signer) marketplaceContract = result.contract;
        return result.products;
    } catch (error) {
        const failures = error.errors || [];
        const details = failures
            .map((failure) => failure.message)
            .filter(Boolean)
            .join('; ');
        throw new Error(
            details
                ? `Marketplace RPCs are temporarily unavailable. ${details}`
                : 'Marketplace RPCs are temporarily unavailable. Please try again.'
        );
    }
}

async function getMarketplaceBlockNumber() {
    await readOnlyProviderReady;
    const rpcUrls = readOnlyRpcUrls.length ? readOnlyRpcUrls : FALLBACK_RPC_URLS;
    try {
        return await Promise.any(rpcUrls.map(async (rpcUrl) => {
            const provider = getReadOnlyContract(rpcUrl).provider;
            return withReadTimeout(provider.getBlockNumber(), rpcUrl);
        }));
    } catch (error) {
        const details = (error.errors || [])
            .map((failure) => failure.message)
            .filter(Boolean)
            .join('; ');
        throw new Error(details
            ? `Could not determine the latest Sepolia block. ${details}`
            : 'Could not determine the latest Sepolia block.');
    }
}

async function getMarketplaceBlockTimestamp(blockNumber) {
    await readOnlyProviderReady;
    const rpcUrls = readOnlyRpcUrls.length ? readOnlyRpcUrls : FALLBACK_RPC_URLS;
    try {
        return await Promise.any(rpcUrls.map(async (rpcUrl) => {
            const provider = getReadOnlyContract(rpcUrl).provider;
            const block = await withReadTimeout(provider.getBlock(Number(blockNumber)), rpcUrl);
            if (!block || !Number.isFinite(Number(block.timestamp))) {
                throw new Error(`Block ${blockNumber} did not include a valid timestamp.`);
            }
            return Number(block.timestamp);
        }));
    } catch (error) {
        const details = (error.errors || [])
            .map((failure) => failure.message)
            .filter(Boolean)
            .join('; ');
        throw new Error(details
            ? `Could not read the timestamp for block ${blockNumber}. ${details}`
            : `Could not read the timestamp for block ${blockNumber}.`);
    }
}

async function readMarketplaceLogs(fromBlock, toBlock, topics) {
    await readOnlyProviderReady;
    const rpcUrls = readOnlyRpcUrls.length ? readOnlyRpcUrls : FALLBACK_RPC_URLS;
    try {
        return await Promise.any(rpcUrls.map(async (rpcUrl) => {
            const provider = getReadOnlyContract(rpcUrl).provider;
            return withReadTimeout(provider.getLogs({
                address: marketplaceAddress,
                fromBlock,
                toBlock,
                topics
            }), rpcUrl);
        }));
    } catch (error) {
        const details = (error.errors || [])
            .map((failure) => failure.message)
            .filter(Boolean)
            .join('; ');
        throw new Error(details
            ? `Marketplace transaction history RPCs are temporarily unavailable. ${details}`
            : 'Marketplace transaction history RPCs are temporarily unavailable.');
    }
}

// Upgrades marketplaceContract to a write-capable instance connected to the user's signer.
// readOnlyContract is intentionally NEVER replaced — it always uses the public Sepolia RPC
// so that view calls work regardless of which network MetaMask is on.
async function connectContractToSigner(loggedInSigner) {
    if (!loggedInSigner) {
        console.error("Signer is missing, contract cannot be connected.");
        return;
    }
    walletProvider = loggedInSigner.provider && loggedInSigner.provider.provider;
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
    const injectedProvider = walletProvider || window.ethereum;
    if (!injectedProvider) return;
    walletProvider = injectedProvider;
    const web3Provider = new ethers.providers.Web3Provider(injectedProvider, "any");
    signer = web3Provider.getSigner();
    if (readOnlyContract) {
        marketplaceContract = readOnlyContract.connect(signer);
    }
}

async function ensureSepoliaNetwork(injectedProvider = walletProvider || window.ethereum) {
    if (!injectedProvider) throw new Error("Connect your wallet before listing an item.");
    walletProvider = injectedProvider;
    const currentChainId = await injectedProvider.request({ method: "eth_chainId" });
    if (parseInt(currentChainId, 16) !== 11155111) {
        try {
            await injectedProvider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await injectedProvider.request({
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            chainId: SEPOLIA_HEX_CHAIN_ID,
                            chainName: "Sepolia Testnet",
                            nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
                            rpcUrls: [FALLBACK_RPC_URLS[0]],
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
                        },
                    ],
                });
            } else {
                throw new Error("Please switch your wallet network to Sepolia Testnet.");
            }
        }
    }
    const activeChainId = await injectedProvider.request({ method: "eth_chainId" });
    if (parseInt(activeChainId, 16) !== 11155111) {
        throw new Error("Please switch your wallet to the Sepolia Testnet to list an item.");
    }
    await refreshSigner();
}

if (typeof window.ethereum !== "undefined") {
    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}
