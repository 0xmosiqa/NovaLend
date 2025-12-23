import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { NOVALEND_ADDRESS, NOVALEND_ABI, CUSDT_ADDRESS, CUSDT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { parseFixed } from '../utils/units';

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

export function RepayCard() {
  const { address, isConnected } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [amountUsdt, setAmountUsdt] = useState('25');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const contractsReady = !isZeroAddress(NOVALEND_ADDRESS) && !isZeroAddress(CUSDT_ADDRESS);

  const { data: isOperator } = useReadContract({
    address: CUSDT_ADDRESS as `0x${string}`,
    abi: CUSDT_ABI,
    functionName: 'isOperator',
    args: address ? [address, NOVALEND_ADDRESS] : undefined,
    query: {
      enabled: !!address && contractsReady,
    },
  });

  const operatorLabel = useMemo(() => {
    if (!isConnected) return 'Wallet not connected';
    if (!contractsReady) return 'Contracts not configured';
    if (isOperator === undefined) return 'Checking operator…';
    return isOperator ? 'Enabled' : 'Not enabled';
  }, [contractsReady, isConnected, isOperator]);

  const enableOperator = async () => {
    if (!isConnected || !address) {
      setStatus('Connect your wallet first.');
      return;
    }
    if (!contractsReady) {
      setStatus('Contract addresses are not configured.');
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

      const now = Math.floor(Date.now() / 1000);
      const until = now + 30 * 24 * 60 * 60;

      const token = new Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await token.setOperator(NOVALEND_ADDRESS, until);
      setStatus(`Operator tx sent: ${tx.hash}`);
      await tx.wait();
      setStatus('Operator enabled.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Enable operator failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const repay = async () => {
    if (!isConnected || !address) {
      setStatus('Connect your wallet first.');
      return;
    }
    if (!contractsReady) {
      setStatus('Contract addresses are not configured.');
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

      // The encrypted input must be created for the token contract, and imported by NovaLend
      // because NovaLend calls cUSDT.confidentialTransferFrom internally.
      const input = instance.createEncryptedInput(CUSDT_ADDRESS, NOVALEND_ADDRESS);
      input.add64(amountMicroUsdt);
      const encryptedInput = await input.encrypt();

      const contract = new Contract(NOVALEND_ADDRESS, NOVALEND_ABI, signer);
      const tx = await contract.repay(encryptedInput.handles[0], encryptedInput.inputProof);
      setStatus(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      setStatus('Repay confirmed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Repay failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Repay cUSDT</h2>
      <p className="card-subtitle">Repayments transfer cUSDT from your wallet to the protocol and burn it.</p>

      {zamaError && <div className="alert">{zamaError}</div>}

      <div className="kv" style={{ marginBottom: '1rem' }}>
        <div className="kv-key">Operator</div>
        <div className="kv-value">{operatorLabel}</div>
      </div>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button
          className="button button-secondary"
          onClick={enableOperator}
          disabled={!isConnected || isSubmitting || isOperator === true}
        >
          {isOperator ? 'Operator Enabled' : 'Enable Operator (30d)'}
        </button>
      </div>

      <div className="field">
        <label className="label" htmlFor="repay-usdt">
          Amount (USDT)
        </label>
        <input
          id="repay-usdt"
          className="input"
          value={amountUsdt}
          onChange={(e) => setAmountUsdt(e.target.value)}
          inputMode="decimal"
          placeholder="25"
        />
      </div>

      <div className="row">
        <button className="button button-primary" onClick={repay} disabled={!isConnected || isSubmitting || zamaLoading}>
          {isSubmitting ? 'Repaying…' : zamaLoading ? 'Loading…' : 'Repay'}
        </button>
      </div>

      {status && <div className="status">{status}</div>}
    </section>
  );
}

