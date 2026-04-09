import { isAddress } from 'ethers';
import { InputError } from '../lib/errors/service.errors.js';
import { FunctionArgs } from '../services/agent/agent.interfaces.js';

export function maskPrivateKey(privateKey: string): string {
  return `${privateKey.slice(0, 4)}...${privateKey.slice(-4)}`;
}

export function maskMnemonic(mnemonic: string): string {
  const words = mnemonic.split(' ');
  return `${words.slice(0, 2).join(' ')} ... ${words.slice(-2).join(' ')}`;
}

export function validateFunctionArgs(functionArgs: FunctionArgs) {
  if (functionArgs.address) {
    if (!isAddress(functionArgs.address)) {
      throw new InputError(`Address '${functionArgs.address}' is not a valid address.`);
    }
    functionArgs.address = checkAndAdd0xPrefix(functionArgs.address);
  }

  if (functionArgs.txHash && !validateTxHash(functionArgs.txHash)) {
    throw new InputError(`'${functionArgs.txHash}' is not a valid transaction hash`);
  }
}

export function validateTxHash(txHash: string): boolean {
  return /^0x([A-Fa-f0-9]{64})$/.test(txHash);
}

export function checkAndAdd0xPrefix(address: string): string {
  const Saddress = String(address);
  if (!address.startsWith('0x')) {
    return '0x' + Saddress;
  }
  return address;
}
