"""Capture public sources for tests; this is NOT a CRE simulation."""
import datetime
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence"
OUT.mkdir(exist_ok=True)
def request(url, body=None, capture_name=None):
    headers = {"User-Agent": "RegLedger/0.1 public legal research prototype", "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(body).encode()
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=30) as r:
        data = r.read()
        status = r.status
    if capture_name:
        (OUT / capture_name).write_bytes(data)
    return json.loads(data), {"url": url, "observed_at_utc": start, "http_status": status,
                              "body_sha256": hashlib.sha256(data).hexdigest()}

query = urllib.parse.urlencode({"conditions[term]": "stablecoin", "order": "newest", "per_page": 3})
api_url = "https://www.federalregister.gov/api/v1/documents.json?" + query
report = {"execution_mode": "direct-public-source-capture-not-cre", "sources": {}}
try:
    data, metadata = request(api_url, capture_name="federal-register-http-body.json")
    (OUT / "federal-register-raw.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    report["sources"]["federal_register"] = metadata
    print("Federal Register", data.get("count"), "results", len(data.get("results", [])))
except Exception as e:
    report["sources"]["federal_register"] = {"error": str(e), "url": api_url}
    print("Federal Register failed", str(e))

rpc = "https://ethereum-rpc.publicnode.com"
def rpc_call(method, params, ident):
    data, metadata = request(rpc, {"jsonrpc": "2.0", "id": ident, "method": method, "params": params}, f"rpc-{ident}-http-body.json")
    if "error" in data:
        raise RuntimeError(json.dumps(data["error"]))
    return data["result"], metadata

try:
    chain_id, _ = rpc_call("eth_chainId", [], 1)
    if chain_id != "0x1":
        raise RuntimeError("Unexpected chain ID")
    header, metadata = rpc_call("eth_getBlockByNumber", ["finalized", False], 2)
    paused, paused_metadata = rpc_call("eth_call", [{"to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "data": "0x5c975abb"}, header["number"]], 3)
    chain = {"chain_id": "1", "contract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
             "header": header, "paused_return_data": paused}
    (OUT / "ethereum-raw.json").write_text(json.dumps(chain, indent=2), encoding="utf-8")
    report["sources"]["ethereum"] = metadata
    report["sources"]["ethereum_paused"] = paused_metadata
    print("Ethereum", int(header["number"], 16), header["hash"], "paused", int(paused, 16))
except Exception as e:
    report["sources"]["ethereum"] = {"error": str(e), "url": rpc}
    print("Ethereum failed", str(e))
(OUT / "source-capture-status.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
