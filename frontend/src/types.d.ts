interface Window {
  PEERLOOP_API_URL?: string;
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
    updateListings(products: any[]): void;
    removeListing(productId: string): void;
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
