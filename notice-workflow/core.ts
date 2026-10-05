import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export type RegisterDocument = {
  document_number: string; title: string; type: string; publication_date: string;
  html_url: string; pdf_url: string; citation?: string; effective_on?: string | null;
};
export type ChainObservation = {
  chainId: string; chainSelector: string; contractAddress: string;
  blockNumber: string; blockHash: string; blockTimeUtc: string; finality: 'finalized'; paused: boolean;
};
export type Config = {
  schedule: string; chainSelectorName: string; tokenAddress: string;
  registerUrl: string; maxDocuments: number;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  throw new Error('Evidence contains an unsupported JSON value');
}
export function hashJson(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalJson(value))));
}
export function hashText(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}
function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 4000) throw new Error(`Invalid ${name}`);
  return value;
}
function publicUrl(value: unknown, domain: string, name: string): string {
  const text = requiredString(value, name);
  // URL is deliberately avoided: QuickJS does not implement all browser globals.
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(text);
  const host = match?.[1]?.toLowerCase();
  if (!host || host.includes('@') || host.includes(':') || !(host === domain || host.endsWith('.' + domain))) throw new Error(`Invalid ${name} host`);
  return text;
}
function isoDate(value: unknown, name: string): string {
  const text = requiredString(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || new Date(text + 'T00:00:00Z').toISOString().slice(0, 10) !== text) throw new Error(`Invalid ${name}`);
  return text;
}
export function validateConfig(config: Config): Config {
  if (config.chainSelectorName !== 'ethereum-mainnet') throw new Error('This prototype supports Ethereum mainnet only');
  if (config.tokenAddress.toLowerCase() !== '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') throw new Error('Unapproved contract: expected Circle-listed Ethereum USDC');
  if (!Number.isInteger(config.maxDocuments) || config.maxDocuments < 1 || config.maxDocuments > 3) throw new Error('maxDocuments must be 1..3');
  publicUrl(config.registerUrl, 'federalregister.gov', 'registerUrl');
  if (!config.registerUrl.startsWith('https://www.federalregister.gov/api/v1/documents.json?')) throw new Error('Unsupported register API');
  return config;
}
export function normalizeRegister(raw: unknown, maxDocuments: number): RegisterDocument[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as {results?:unknown}).results)) throw new Error('Register API returned no results array');
  const results = (raw as {results: unknown[]}).results;
  if (results.length > maxDocuments) throw new Error('Register API exceeded document bound');
  const seen = new Set<string>();
  return results.map(row => {
    if (!row || typeof row !== 'object') throw new Error('Invalid register document');
    const doc = row as Record<string, unknown>;
    const id = requiredString(doc.document_number, 'document_number');
    if (!/^\d{4}-\d{4,6}$/.test(id) || seen.has(id)) throw new Error('Invalid or duplicate document ID');
    seen.add(id);
    const type = requiredString(doc.type, 'document type');
    if (!['Rule', 'Proposed Rule', 'Notice', 'Presidential Document'].includes(type)) throw new Error('Unknown document type');
    const output: RegisterDocument = {
      document_number: id, title: requiredString(doc.title, 'title'), type,
      publication_date: isoDate(doc.publication_date, 'publication_date'),
      html_url: publicUrl(doc.html_url, 'federalregister.gov', 'html_url'),
      pdf_url: publicUrl(doc.pdf_url, 'govinfo.gov', 'pdf_url'),
    };
    if (doc.citation !== undefined && doc.citation !== null) output.citation = requiredString(doc.citation, 'citation');
    if (doc.effective_on !== undefined) output.effective_on = doc.effective_on === null ? null : isoDate(doc.effective_on, 'effective_on');
    return output;
  }).sort((a, b) => a.document_number < b.document_number ? -1 : a.document_number > b.document_number ? 1 : 0);
}
export function createDossier(config: Config, register: RegisterDocument[], chain: ChainObservation, observedAtUtc: string, registerResponseSha256: string) {
  validateConfig(config);
  const observed = Date.parse(observedAtUtc);
  const blockTime = Date.parse(chain.blockTimeUtc);
  if (!Number.isFinite(observed) || !Number.isFinite(blockTime) || blockTime > observed || observed - blockTime > 7200_000) throw new Error('Invalid or stale finalized block time');
  if (chain.chainId !== '1' || chain.contractAddress.toLowerCase() !== config.tokenAddress.toLowerCase() || chain.finality !== 'finalized') throw new Error('Chain identity mismatch');
  if (!/^\d+$/.test(chain.blockNumber) || !/^0x[0-9a-fA-F]{64}$/.test(chain.blockHash)) throw new Error('Invalid chain block identity');
  if (typeof chain.paused !== 'boolean') throw new Error('paused must be a decoded ABI bool');
  if (!/^[0-9a-f]{64}$/.test(registerResponseSha256)) throw new Error('Invalid register response hash');
  const payload = {
    schema: 'regledger-dossier/1', observedAtUtc,
    sourceScope: 'FederalRegister.gov API metadata is an informational rendition. Verify the linked govinfo.gov PDF for an official legal edition.',
    applicability: 'No legal applicability determination. Document types are preserved; a notice or proposed rule is not treated as a binding final rule.',
    register: {queryUrl: config.registerUrl, responseSha256: registerResponseSha256, documents: register},
    chain,
    review: {
      priority: chain.paused ? 'urgent-operational-review' : 'regulatory-source-review',
      contractObservation: chain.paused ? 'USDC paused() returned true at the recorded finalized block.' : 'USDC paused() returned false at the recorded finalized block.',
      legalQueue: register.map(doc => ({documentNumber: doc.document_number, type: doc.type, status: 'requires-applicability-review'})),
      connection: 'A stablecoin integration review needs both the public regulatory publication context and the exact token operational state. This dossier binds their observations without inferring that one caused, authorized, or certified the other.',
    },
    assurance: 'SHA-256 detects altered dossier content. A local capture or CRE simulation is not a DON attestation, legal certification, or blockchain consensus proof.',
  };
  return {payload, payloadSha256: hashJson(payload)};
}
