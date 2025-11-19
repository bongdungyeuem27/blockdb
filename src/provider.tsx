import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { WagmiProvider, createConfig, http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { PRIVATE_KEY } from './contracts/key';

const queryClient = new QueryClient();

export const TestNet = {
  id: 1328,
  name: 'SEI Testnet',
  nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://evm-rpc-testnet.sei-apis.com'],
    },
    public: {
      http: ['https://evm-rpc-testnet.sei-apis.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Seitrace', url: 'https://testnet.seitrace.com' },
  },
  testnet: true,
} as const satisfies Chain;

export const account = privateKeyToAccount(PRIVATE_KEY);

export const config = createConfig({
  chains: [TestNet],
  transports: {
    [TestNet.id]: http(),
  },
});

const Provider = ({ children }: PropsWithChildren) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
};

export default Provider;
