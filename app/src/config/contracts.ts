export const NOVALEND_ADDRESS = '0xc901a433c652fC86aeBD0A528D4D0d80cb847450';
export const CUSDT_ADDRESS = '0xf68145A87D072750C5649A54e51B1Be767f94e8c';

export const NOVALEND_ABI = [
  {
    type: 'function',
    name: 'stake',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'borrow',
    inputs: [
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repay',
    inputs: [
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawAll',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'encryptedCollateralOf',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'encryptedDebtOf',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
] as const;

export const CUSDT_ABI = [
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isOperator',
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setOperator',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'until', type: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;
