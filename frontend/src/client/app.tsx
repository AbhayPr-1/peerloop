import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Header } from './shared/Header';
import { ModalLayers } from './shared/ModalLayers';
import { LandingPage } from './features/landing/LandingPage';
import { Marketplace } from './features/marketplace/Marketplace';
import { SellListing } from './features/listings/SellListing';
import { Cart } from './features/cart/Cart';
import { AccountPages } from './features/account/AccountPages';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The PeerLoop React root element is missing.');
}

flushSync(() => {
  createRoot(rootElement).render(
    <>
      <Header />
      <LandingPage />
      <Marketplace />
      <SellListing />
      <Cart />
      <AccountPages />
      <ModalLayers />
    </>
  );
});
