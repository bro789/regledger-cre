/** Replay real public captures with the same core; never labels this a CRE simulation. */
import { createDossier, normalizeRegister, canonicalJson, type Config } from './core';
const config = await Bun.file('config.staging.json').json() as Config;
const register = await Bun.file('../evidence/federal-register-raw.json').json();
const rawChain = await Bun.file('../evidence/ethereum-raw.json').json();
const capture = await Bun.file('../evidence/source-capture-status.json').json();
if (!/^0x0{63}[01]$/.test(rawChain.paused_return_data)) throw new Error('Invalid bool');
const dossier = createDossier(config, normalizeRegister(register, config.maxDocuments), {
  chainId: rawChain.chain_id, chainSelector: '5009297550715157269', contractAddress: rawChain.contract,
  blockNumber: BigInt(rawChain.header.number).toString(), blockHash: rawChain.header.hash,
  blockTimeUtc: new Date(Number(BigInt(rawChain.header.timestamp)) * 1000).toISOString(),
  finality: 'finalized', paused: rawChain.paused_return_data.endsWith('1'),
}, capture.sources.ethereum_paused.observed_at_utc, capture.sources.federal_register.body_sha256);
const output = {executionMode: 'captured-public-data-replay-not-cre-simulation', ...dossier};
await Bun.write('../evidence/dossier-replay.json', canonicalJson(output) + '\n');
console.log(JSON.stringify({executionMode: output.executionMode, documents: dossier.payload.register.documents.map(d=>({id:d.document_number,type:d.type})), blockNumber:dossier.payload.chain.blockNumber, paused:dossier.payload.chain.paused, payloadSha256:dossier.payloadSha256}));
