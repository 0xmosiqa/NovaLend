import { createConfig, createStorage, http, noopStorage } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: http(),
  },
  storage: createStorage({
    storage: noopStorage,
  }),
  ssr: false,
});
