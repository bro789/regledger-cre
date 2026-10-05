import {
  CronCapability, EVMClient, HTTPClient, Runner, handler, getNetwork,
  consensusIdenticalAggregation, LAST_FINALIZED_BLOCK_NUMBER, blockNumber,
  protoBigIntToBigint, encodeCallMsg, bytesToHex,
  type Runtime, type HTTPSendRequester,
} from '@chainlink/cre-sdk';
import { parseAbi, encodeFunctionData, decodeFunctionResult, zeroAddress, type Address } from 'viem';
import { canonicalJson, createDossier, normalizeRegister, validateConfig, hashText, type Config } from './core';

const ABI = parseAbi(['function paused() view returns (bool)']);

const fetchRegister = (requester: HTTPSendRequester, config: Config): string => {
  const response = requester.sendRequest({
    url: config.registerUrl, method: 'GET', timeout: '10s',
    headers: {Accept: 'application/json'},
  }).result();
  if (response.statusCode !== 200) throw new Error(`Register API returned HTTP ${response.statusCode}`);
  if (response.body.length > 65536) throw new Error('Register response exceeds 64 KiB bound');
  const raw = new TextDecoder().decode(response.body);
  return canonicalJson({documents: normalizeRegister(JSON.parse(raw), config.maxDocuments), responseSha256: hashText(raw)});
};

export const onCron = (runtime: Runtime<Config>): string => {
  const config = validateConfig(runtime.config);
  const register = JSON.parse(new HTTPClient().sendRequest(runtime, fetchRegister, consensusIdenticalAggregation<string>())(config).result());
  const network = getNetwork({chainFamily: 'evm', chainSelectorName: config.chainSelectorName});
  if (!network) throw new Error('Ethereum network unavailable in SDK');
  const evm = new EVMClient(network.chainSelector.selector);
  const header = evm.headerByNumber(runtime, {blockNumber: LAST_FINALIZED_BLOCK_NUMBER}).result().header;
  if (!header?.blockNumber || header.hash.length !== 32) throw new Error('Finalized header lacks block identity');
  const height = protoBigIntToBigint(header.blockNumber);
  const call = evm.callContract(runtime, {
    call: encodeCallMsg({from: zeroAddress, to: config.tokenAddress as Address, data: encodeFunctionData({abi: ABI, functionName: 'paused'})}),
    blockNumber: blockNumber(height),
  }).result();
  const callData = bytesToHex(call.data);
  if (!/^0x0{63}[01]$/.test(callData)) throw new Error('Invalid ABI bool returned from USDC paused()');
  const paused = decodeFunctionResult({abi: ABI, functionName: 'paused', data: callData});
  const recheck = evm.headerByNumber(runtime, {blockNumber: blockNumber(height)}).result().header;
  if (!recheck || bytesToHex(recheck.hash) !== bytesToHex(header.hash)) throw new Error('Block changed between observations');
  const dossier = createDossier(config, register.documents, {
    chainId: '1', chainSelector: network.chainSelector.selector.toString(), contractAddress: config.tokenAddress,
    blockNumber: height.toString(), blockHash: bytesToHex(header.hash),
    blockTimeUtc: new Date(Number(header.timestamp) * 1000).toISOString(), finality: 'finalized', paused,
  }, runtime.now().toISOString(), register.responseSha256);
  runtime.log('REGLEDGER_DOSSIER=' + canonicalJson({executionMode: 'cre-workflow', ...dossier}));
  return dossier.payloadSha256;
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(config => [handler(new CronCapability().trigger({schedule: config.schedule}), onCron)]);
}
