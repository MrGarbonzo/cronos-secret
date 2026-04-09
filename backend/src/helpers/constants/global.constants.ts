import dotenv from 'dotenv';

dotenv.config();

export const IS_PROD_ENV: boolean = process.env.NODE_ENV === 'production';
export const IS_DEV_ENV: boolean = process.env.NODE_ENV === 'development';

export const PORT: number = parseInt(process.env.PORT || '3000');

export const DEVELOPER_PLATFORM_PROVIDER_URL: string =
  process.env.DEVELOPER_PLATFORM_PROVIDER_URL || 'https://evm-t3.cronos.org/';

export const DASHBOARD_API_KEY: string = process.env.DASHBOARD_API_KEY!;
export const EXPLORER_API_KEY: string = process.env.EXPLORER_API_KEY!;

export const SECRET_AI_API_KEY: string = process.env.SECRET_AI_API_KEY!;
export const SECRET_AI_URL: string =
  process.env.SECRET_AI_URL || 'https://secretai-rytn.scrtlabs.com:21434';

// TDX attestation endpoint for the SecretVM that hosts the SecretAI LLM.
// Same pattern as the local attestation agent (port 29343) but exposed on
// the SecretAI VM itself. Lets us prove BOTH ends of the inference call
// are running inside attested hardware.
export const SECRETAI_ATTESTATION_URL: string =
  process.env.SECRETAI_ATTESTATION_URL ||
  'https://secretai-rytn.scrtlabs.com:29343/cpu';

export const CHAIN_ID: number = parseInt(process.env.CHAIN_ID || '338');
