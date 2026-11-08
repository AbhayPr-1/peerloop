interface PeerLoopApiUser {
  id: string;
  name: string;
  walletAddress: string;
}

interface PeerLoopApiClient {
  readonly baseUrl: string;
  auth: {
    createChallenge(walletAddress: string): Promise<{ message: string }>;
    signIn(walletAddress: string, signature: string): Promise<{ user: PeerLoopApiUser }>;
    getSession(): Promise<{ user?: PeerLoopApiUser } | null>;
    logout(): Promise<void>;
  };
  uploads: {
    uploadImage(file: File): Promise<{ imageUrl: string; ipfsHash: string }>;
  };
  listingMetadata: {
    getAll(timeoutMs?: number): Promise<Record<string, string>>;
    saveCategory(productId: string, category: string, fallbackMessage?: string): Promise<{ productId: string; category: string }>;
  };
  config: {
    getRpcUrl(signal?: AbortSignal): Promise<{ rpcUrl?: string }>;
  };
}

interface PeerLoopApiTransport {
  create(baseUrl: string, fetcher: typeof fetch, createFormData: () => FormData): PeerLoopApiClient;
}

interface Window {
  PEERLOOP_API_URL?: string;
  PeerLoopMoney: {
    toWei(value: string | number): bigint;
    fromWei(value: bigint, decimals?: number): string;
    formatEth(value: string | number, decimals?: number): string;
    sumEth(values: Array<string | number>): bigint;
    compareEth(left: string | number, right: string | number): number;
  };
  PeerLoopCheckout: {
    processItems(
      items: Array<{ _id: string; name: string }>,
      purchaseItem: (item: { _id: string; name: string }) => Promise<{ transactionHash?: string }>
    ): Promise<Array<{
      item: { _id: string; name: string };
      status: 'success' | 'failed';
      transactionHash?: string;
      error?: string;
    }>>;
  };
  clearUserCart(): void;
  PeerLoopApi: PeerLoopApiClient;
  PeerLoopApiTransport: PeerLoopApiTransport;
  ethereum?: any;
  WalletDetection: {
    detectWalletProvider(): Promise<{ info: { name: string; uuid: string } | null; provider: any } | null>;
    getNoWalletMessage(): Promise<string>;
    getDetectedWalletNames(): Promise<string[]>;
    DETECTION_TIMEOUT_MS: number;
  };
  PeerLoopAccount?: {
    renderDashboard(): void;
    setView(view: string): void;
    showEscrowDashboard(purchase?: any): void;
    refreshEscrowState(productId: string, escrowId: string, state: number): void;
    refreshClaimableBalance?(): void;
    updateListings(products: any[]): void;
    removeListing(productId: string): void;
    getActivityRecords(
      history: { purchased: any[]; sold: any[] },
      view: string
    ): any[];
    shouldAutoOpenDisputeEscrow(
      hasSellerDispute: boolean,
      selectedView: string,
      manuallySelected: boolean
    ): boolean;
    getDisputeVoteView(
      votes: number,
      isBuyer: boolean
    ): { myVote: 'release' | 'refund' | null; otherVote: 'release' | 'refund' | null; choices: Array<'release' | 'refund'> };
    invalidateHistory(): void;
    shouldRefreshProfileHistory(hasCachedHistory: boolean, lastUpdatedAt: number, now?: number): boolean;
  };
  getWalletTransactionHistory(
    walletAddress: string,
    onProgress?: (history: { purchased: any[]; sold: any[] }) => void
  ): Promise<{ purchased: any[]; sold: any[] }>;
  getCachedWalletTransactionHistory(walletAddress: string): { purchased: any[]; sold: any[] } | null;
  clearWalletTransactionHistoryCache(walletAddress: string): void;
  enrichWalletTransactionHistory(
    walletAddress: string,
    history: { purchased: any[]; sold: any[] }
  ): Promise<{ purchased: any[]; sold: any[] }>;
  invalidateWalletTransactionHistory(): void;
  recordConfirmedEscrowPurchase(purchase: any): any;
  updateConfirmedEscrowState(productId: string, escrowId: string, state: number, walletAddress?: string): void;
}

interface HTMLElementTagNameMap {
  'peerloop-app': HTMLElement;
}

interface PeerLoopElementMap {
  'cart-count': HTMLElement;
  'search-input': HTMLInputElement;
  'price-filter': HTMLInputElement;
  'available-only': HTMLInputElement;
  'image-uploader': HTMLElement;
  'product-photo': HTMLInputElement;
  'create-listing-form': HTMLFormElement;
  'product-name': HTMLInputElement;
  'product-desc': HTMLInputElement;
  'product-price': HTMLInputElement;
  'price-filter-max-label': HTMLElement;
  'price-filter-value': HTMLElement;
}

interface Document {
  getElementById<K extends keyof PeerLoopElementMap>(elementId: K): PeerLoopElementMap[K] | null;
}

declare const ethers: any;
declare const io: any;
declare const WalletDetection: Window['WalletDetection'];
declare const getWalletTransactionHistory: Window['getWalletTransactionHistory'];
declare const getCachedWalletTransactionHistory: Window['getCachedWalletTransactionHistory'];
declare const enrichWalletTransactionHistory: Window['enrichWalletTransactionHistory'];
declare const invalidateWalletTransactionHistory: Window['invalidateWalletTransactionHistory'];
declare const recordConfirmedEscrowPurchase: Window['recordConfirmedEscrowPurchase'];
declare const updateConfirmedEscrowState: Window['updateConfirmedEscrowState'];
