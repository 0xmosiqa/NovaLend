import { useState } from 'react';
import { Contract } from 'ethers';
import { useAccount } from 'wagmi';
import { NOVALEND_ADDRESS, NOVALEND_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { parseFixed } from '../utils/units';

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

export function BorrowCard() {
  const { address, isConnected } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [amountUsdt, setAmountUsdt] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const contractsReady = !isZeroAddress(NOVALEND_ADDRESS);

  const borrow = async () => {
    if (!isConnected || !address) {
      setStatus('Connect your wallet first.');
      return;
    }
    if (!contractsReady) {
      setStatus('Contract address is not configured.');
      return;
    }
    if (!instance || zamaLoading) {
      setStatus('Encryption service is not ready yet.');
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

      const amountMicroUsdt = parseFixed(amountUsdt, 6);
      if (amountMicroUsdt <= 0n) throw new Error('Amount must be > 0');

      const input = instance.createEncryptedInput(NOVALEND_ADDRESS, address);
      input.add64(amountMicroUsdt);
      const encryptedInput = await input.encrypt();

      const contract = new Contract(NOVALEND_ADDRESS, NOVALEND_ABI, signer);
      const tx = await contract.borrow(encryptedInput.handles[0], encryptedInput.inputProof);
      setStatus(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      setStatus('Borrow confirmed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Borrow failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Borrow cUSDT</h2>
      <p className="card-subtitle">Borrow amount is encrypted before it is sent on-chain.</p>

      {zamaError && <div className="alert">{zamaError}</div>}

      <div className="field">
        <label className="label" htmlFor="borrow-usdt">
          Amount (USDT)
        </label>
        <input
          id="borrow-usdt"
          className="input"
          value={amountUsdt}
          onChange={(e) => setAmountUsdt(e.target.value)}
          inputMode="decimal"
          placeholder="100"
        />
      </div>

      <div className="row">
        <button className="button button-primary" onClick={borrow} disabled={!isConnected || isSubmitting || zamaLoading}>
          {isSubmitting ? 'Borrowing…' : zamaLoading ? 'Loading…' : 'Borrow'}
        </button>
      </div>

      {status && <div className="status">{status}</div>}
    </section>
  );
}

