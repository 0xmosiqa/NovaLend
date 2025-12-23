import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { NOVALEND_ADDRESS, NOVALEND_ABI, CUSDT_ADDRESS, CUSDT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { formatFixed, shortHex } from '../utils/units';

type DecryptedPosition = {
  collateralMicroEth: bigint;
  debtMicroUsdt: bigint;
  balanceMicroUsdt: bigint;
};

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

export function PositionCard() {
  const { address, isConnected } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const contractsReady = !isZeroAddress(NOVALEND_ADDRESS) && !isZeroAddress(CUSDT_ADDRESS);

  const { data: encryptedCollateral } = useReadContract({
    address: NOVALEND_ADDRESS as `0x${string}`,
    abi: NOVALEND_ABI,
    functionName: 'encryptedCollateralOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractsReady,
    },
  });

  const { data: encryptedDebt } = useReadContract({
    address: NOVALEND_ADDRESS as `0x${string}`,
    abi: NOVALEND_ABI,
    functionName: 'encryptedDebtOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractsReady,
    },
  });

  const { data: encryptedBalance } = useReadContract({
    address: CUSDT_ADDRESS as `0x${string}`,
    abi: CUSDT_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractsReady,
    },
  });

  const [decrypted, setDecrypted] = useState<DecryptedPosition | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [status, setStatus] = useState<string>('');

  const derived = useMemo(() => {
    if (!decrypted) return null;

    const eth = decrypted.collateralMicroEth;
    const debt = decrypted.debtMicroUsdt;

    const priceMicroUsdtPerMicroEth = 2000n;
    const maxLtvBps = 5000n;
    const bps = 10_000n;

    const collateralValueMicroUsdt = eth * priceMicroUsdtPerMicroEth;
    const maxBorrowMicroUsdt = (collateralValueMicroUsdt * maxLtvBps) / bps;
    const availableMicroUsdt = maxBorrowMicroUsdt > debt ? maxBorrowMicroUsdt - debt : 0n;

    return { collateralValueMicroUsdt, maxBorrowMicroUsdt, availableMicroUsdt };
  }, [decrypted]);

  const decrypt = async () => {
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
    if (!encryptedCollateral || !encryptedDebt || !encryptedBalance) {
      setStatus('Encrypted values are not available yet.');
      return;
    }
    if (!signerPromise) {
      setStatus('Wallet signer is not available.');
      return;
    }

    setIsDecrypting(true);
    setStatus('');
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        { handle: encryptedCollateral, contractAddress: NOVALEND_ADDRESS },
        { handle: encryptedDebt, contractAddress: NOVALEND_ADDRESS },
        { handle: encryptedBalance, contractAddress: CUSDT_ADDRESS },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [NOVALEND_ADDRESS, CUSDT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const collateralMicroEth = BigInt(result[encryptedCollateral as string] ?? '0');
      const debtMicroUsdt = BigInt(result[encryptedDebt as string] ?? '0');
      const balanceMicroUsdt = BigInt(result[encryptedBalance as string] ?? '0');

      setDecrypted({ collateralMicroEth, debtMicroUsdt, balanceMicroUsdt });
      setStatus('Decryption successful.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Decryption failed: ${message}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Position</h2>
      <p className="card-subtitle">Encrypted on-chain, decrypted locally with Zama Relayer.</p>

      {!contractsReady && (
        <div className="alert">
          Contract addresses are not configured yet. Deploy to Sepolia and update `app/src/config/contracts.ts`.
        </div>
      )}

      {zamaError && <div className="alert">{zamaError}</div>}

      <div className="kv">
        <div className="kv-key">Collateral (handle)</div>
        <div className="kv-value mono">{encryptedCollateral ? shortHex(encryptedCollateral as string) : '-'}</div>

        <div className="kv-key">Debt (handle)</div>
        <div className="kv-value mono">{encryptedDebt ? shortHex(encryptedDebt as string) : '-'}</div>

        <div className="kv-key">cUSDT (handle)</div>
        <div className="kv-value mono">{encryptedBalance ? shortHex(encryptedBalance as string) : '-'}</div>
      </div>

      <div className="row" style={{ marginTop: '1rem' }}>
        <button className="button button-secondary" onClick={decrypt} disabled={!isConnected || isDecrypting}>
          {isDecrypting ? 'Decrypting…' : 'Decrypt'}
        </button>
      </div>

      {decrypted && (
        <div className="kv" style={{ marginTop: '1rem' }}>
          <div className="kv-key">Collateral</div>
          <div className="kv-value">{formatFixed(decrypted.collateralMicroEth, 6)} ETH</div>

          <div className="kv-key">Debt</div>
          <div className="kv-value">{formatFixed(decrypted.debtMicroUsdt, 6)} USDT</div>

          <div className="kv-key">cUSDT Balance</div>
          <div className="kv-value">{formatFixed(decrypted.balanceMicroUsdt, 6)} USDT</div>

          <div className="kv-key">Max Borrow (50% LTV)</div>
          <div className="kv-value">
            {derived ? `${formatFixed(derived.maxBorrowMicroUsdt, 6)} USDT` : '-'}
          </div>

          <div className="kv-key">Available</div>
          <div className="kv-value">
            {derived ? `${formatFixed(derived.availableMicroUsdt, 6)} USDT` : '-'}
          </div>
        </div>
      )}

      {status && <div className="status">{status}</div>}
    </section>
  );
}

