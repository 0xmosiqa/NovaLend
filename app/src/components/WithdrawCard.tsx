import { useState } from 'react';
import { Contract } from 'ethers';
import { useAccount } from 'wagmi';
import { NOVALEND_ADDRESS, NOVALEND_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

export function WithdrawCard() {
  const { isConnected } = useAccount();
  const signerPromise = useEthersSigner();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const contractsReady = !isZeroAddress(NOVALEND_ADDRESS);

  const withdrawAll = async () => {
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

      const contract = new Contract(NOVALEND_ADDRESS, NOVALEND_ABI, signer);
      const tx = await contract.withdrawAll();
      setStatus(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      setStatus('Withdraw confirmed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Withdraw failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Withdraw ETH</h2>
      <p className="card-subtitle">Withdraws all staked ETH from the protocol.</p>

      <div className="row">
        <button className="button button-danger" onClick={withdrawAll} disabled={!isConnected || isSubmitting}>
          {isSubmitting ? 'Withdrawing…' : 'Withdraw All'}
        </button>
      </div>

      {status && <div className="status">{status}</div>}
    </section>
  );
}

