import { useAccount, useChainId } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { Header } from './Header';
import { PositionCard } from './PositionCard';
import { StakeCard } from './StakeCard';
import { BorrowCard } from './BorrowCard';
import { RepayCard } from './RepayCard';
import { WithdrawCard } from './WithdrawCard';
import '../styles/NovaLendApp.css';

export function NovaLendApp() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  const isSepolia = chainId === sepolia.id;

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <div className="app-container">
          {isConnected && !isSepolia && (
            <div className="alert">
              Switch your wallet network to Sepolia to use NovaLend.
            </div>
          )}

          <div className="grid">
            <PositionCard />
            <StakeCard />
            <BorrowCard />
            <RepayCard />
            <WithdrawCard />
          </div>
        </div>
      </main>
    </div>
  );
}

