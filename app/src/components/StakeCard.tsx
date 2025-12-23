import { useState } from 'react';
import { Contract, parseEther } from 'ethers';
import { useAccount } from 'wagmi';
import { NOVALEND_ADDRESS, NOVALEND_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

export function StakeCard() {
  const { isConnected } = useAccount();
  const signerPromise = useEthersSigner();

  const [amountEth, setAmountEth] = useState('0.1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const contractsReady = !isZeroAddress(NOVALEND_ADDRESS);

  const stake = async () => {
    if (!isConnected) {
      setStatus('Connect your wallet first.');
      return;
    }
    if (!contractsReady) {
      setStatus('Contract address is not configured.');
      return;
    }
    if (!signerPromise) {
      setStatus('Wallet signer is not available.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const value = parseEther(amountEth);
      const contract = new Contract(NOVALEND_ADDRESS, NOVALEND_ABI, signer);
      const tx = await contract.stake({ value });
      setStatus(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      setStatus('Stake confirmed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Stake failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Stake ETH</h2>
      <p className="card-subtitle">Your stake is tracked as encrypted collateral (micro-ETH units).</p>

      <div className="field">
        <label className="label" htmlFor="stake-eth">
          Amount (ETH)
        </label>
        <input
          id="stake-eth"
          className="input"
          value={amountEth}
          onChange={(e) => setAmountEth(e.target.value)}
          inputMode="decimal"
          placeholder="0.1"
        />
      </div>

      <div className="row">
        <button className="button button-primary" onClick={stake} disabled={!isConnected || isSubmitting}>
          {isSubmitting ? 'Staking…' : 'Stake'}
        </button>
      </div>

      {status && <div className="status">{status}</div>}
    </section>
  );
}

