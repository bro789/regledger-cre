import { describe, test, expect } from 'bun:test';
import { canonicalJson, createDossier, normalizeRegister, validateConfig, hashJson, type Config, type ChainObservation } from './core';

const config: Config = {schedule:'0 0 * * * *', chainSelectorName:'ethereum-mainnet', tokenAddress:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', registerUrl:'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=stablecoin&per_page=3', maxDocuments:3};
const row = {document_number:'2026-20371', title:'Synthetic proposed rule for tests', type:'Proposed Rule', publication_date:'2026-10-05', html_url:'https://www.federalregister.gov/documents/2026/10/05/2026-20371/example', pdf_url:'https://www.govinfo.gov/content/pkg/FR-2026-10-05/pdf/2026-20371.pdf'};
const chain: ChainObservation = {chainId:'1', chainSelector:'5009297550715157269', contractAddress:config.tokenAddress, blockNumber:'26123831', blockHash:'0x'+'a'.repeat(64), blockTimeUtc:'2026-10-05T04:50:00Z', finality:'finalized', paused:false};
const build = (changes: Partial<ChainObservation> = {}) => createDossier(config, normalizeRegister({results:[row]},3), {...chain,...changes},'2026-10-05T05:00:00Z','b'.repeat(64));

describe('source provenance and legal meaning', () => {
  test('preserves Proposed Rule and requires review rather than declaring compliance', () => {
    const dossier=build();
    expect(dossier.payload.register.documents[0]!.type).toBe('Proposed Rule');
    expect(dossier.payload.review.legalQueue[0]!.status).toBe('requires-applicability-review');
    expect(dossier.payload.sourceScope).toContain('informational rendition');
    expect(dossier.payload.review.priority).toBe('regulatory-source-review');
  });
  test('paused token only raises operational priority', () => {
    expect(build({paused:true}).payload.review.priority).toBe('urgent-operational-review');
    expect(build({paused:true}).payload.review.legalQueue[0]!.status).toBe('requires-applicability-review');
  });
  test('rejects spoofed federalregister domain', () => expect(()=>normalizeRegister({results:[{...row,html_url:'https://www.federalregister.gov.evil.test/a'}]},3)).toThrow());
  test('rejects nonofficial PDF source', () => expect(()=>normalizeRegister({results:[{...row,pdf_url:'https://example.com/rule.pdf'}]},3)).toThrow());
  test('rejects duplicate document IDs', () => expect(()=>normalizeRegister({results:[row,row]},3)).toThrow());
  test('rejects unknown type and invalid date', () => {
    expect(()=>normalizeRegister({results:[{...row,type:'Binding Approval'}]},3)).toThrow();
    expect(()=>normalizeRegister({results:[{...row,publication_date:'2026-02-30'}]},3)).toThrow();
  });
  test('bounds response count', () => expect(()=>normalizeRegister({results:[row,row,row,row]},3)).toThrow('bound'));
});
describe('chain provenance and artifact integrity', () => {
  test('rejects wrong chain and contract', () => {
    expect(()=>build({chainId:'11155111'})).toThrow();
    expect(()=>build({contractAddress:'0x'+'0'.repeat(40)})).toThrow();
    expect(()=>validateConfig({...config,tokenAddress:'0x'+'0'.repeat(40)})).toThrow();
  });
  test('rejects stale and future block timestamps', () => {
    expect(()=>build({blockTimeUtc:'2026-10-04T04:50:00Z'})).toThrow();
    expect(()=>build({blockTimeUtc:'2026-10-05T05:01:00Z'})).toThrow();
  });
  test('canonical hash is key order independent and changes on tamper', () => {
    expect(hashJson({a:1,b:2})).toBe(hashJson({b:2,a:1}));
    expect(build().payloadSha256).not.toBe(build({paused:true}).payloadSha256);
    expect(hashJson(build().payload)).toBe(build().payloadSha256);
  });
  test('rejects undefined and nonfinite values', () => {
    expect(()=>canonicalJson({a:undefined})).toThrow();
    expect(()=>canonicalJson({a:NaN})).toThrow();
  });
});
