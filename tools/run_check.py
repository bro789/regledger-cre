"""Bounded owned-process checks; logs are public-code outputs, never credentials."""
import hashlib
import json
import os
import pathlib
import subprocess
import shutil
import signal
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parents[1]
local_bun = ROOT / "tools/bun/bun-windows-x64/bun.exe"
BUN = local_bun if local_bun.exists() else pathlib.Path(shutil.which("bun") or "bun")
local_cre = ROOT / "tools/cre/cre_v1.36.0_windows_amd64.exe"
CRE = local_cre if local_cre.exists() else pathlib.Path(shutil.which("cre") or "cre")
WORKFLOW = ROOT / "notice-workflow"
LOGS = ROOT / "evidence/checks"
LOGS.mkdir(parents=True, exist_ok=True)
if len(sys.argv) != 2:
    raise SystemExit("Usage: python tools/run_check.py test|typecheck|compile|simulation|--preflight")
name = sys.argv[1]
if name == "--preflight":
    print(json.dumps({"project_root": str(ROOT), "bun_found": BUN.is_file(),
                      "cre_found": CRE.is_file(), "project_config_exists": (ROOT / "project.yaml").is_file(),
                      "workflow_config_exists": (WORKFLOW / "workflow.yaml").is_file(),
                      "bun_source": "project-local" if local_bun.exists() else "official-install-on-PATH",
                      "cre_source": "project-local" if local_cre.exists() else "official-install-on-PATH"}))
    raise SystemExit(0 if BUN.is_file() and CRE.is_file() else 1)
commands = {
    "test": ([str(BUN), "test", "core.test.ts"], WORKFLOW, 120),
    "typecheck": ([str(BUN), "run", "typecheck"], WORKFLOW, 180),
    "compile": ([str(BUN), "run", "compile"], WORKFLOW, 300),
    "simulation": ([str(CRE), "workflow", "simulate", "notice-workflow", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0"], ROOT, 180),
}
command, cwd, timeout = commands[name]
environment = os.environ.copy()
environment["PATH"] = str(BUN.parent) + os.pathsep + environment.get("PATH", "")
start = time.monotonic()
try:
    owned = subprocess.Popen(command, cwd=cwd, env=environment, start_new_session=os.name != "nt",
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        captured, _ = owned.communicate(timeout=timeout)
        code = owned.returncode
    except subprocess.TimeoutExpired:
        # This PID is this script's child. Terminate only its process tree.
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(owned.pid), "/T", "/F"], capture_output=True)
        else:
            os.killpg(owned.pid, signal.SIGKILL)
        captured, _ = owned.communicate(timeout=20)
        captured += b"\nOwned command exceeded timeout.\n"
        code = 124
    output = captured.decode("utf-8", errors="replace")
except subprocess.TimeoutExpired as e:
    output = (e.stdout or b"").decode("utf-8", errors="replace") + "\nOwned command exceeded timeout.\n"
    code = 124
(LOGS / (name + ".txt")).write_text(output, encoding="utf-8")
summary = {"check": name, "exit_code": code, "elapsed_seconds": round(time.monotonic()-start, 3),
           "output_file": str(LOGS / (name + ".txt")), "output_sha256": hashlib.sha256(output.encode()).hexdigest()}
if name == "compile" and code == 0 and (WORKFLOW / "regledger.wasm").exists():
    data = (WORKFLOW / "regledger.wasm").read_bytes()
    summary["artifact"] = {"path": str(WORKFLOW / "regledger.wasm"), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "wasm_magic_valid": data[:4] == b"\0asm"}
(LOGS / (name + ".json")).write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(output)
print(json.dumps(summary))
sys.exit(code)
