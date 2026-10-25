"""Package this local working tree, including untracked source, without secrets/builds."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / "submission-local"
output.mkdir(exist_ok=True)
names = subprocess.check_output(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=root
).decode("utf-8").split("\0")
secrets = []
local_config = root / ".discovery-local.json"
if local_config.exists():
    secrets.extend(str(v).encode() for v in json.loads(local_config.read_text()).values())
env = root / ".env.local"
if env.exists():
    for line in env.read_text().splitlines():
        name, separator, value = line.partition("=")
        if separator and any(word in name.upper() for word in ("KEY", "TOKEN", "SECRET", "PASSWORD")):
            value = value.strip().strip("\"'")
            if len(value) >= 12:
                secrets.append(value.encode())

files = sorted(set(name for name in names if name and (root / name).is_file()))
manifest = []
for name in files:
    path = Path(name)
    if path.is_absolute() or ".." in path.parts or path.parts[0] in (".git", "node_modules", ".next", ".next-demo", "submission-local", "qloo-dumps", ".supabase"):
        raise SystemExit(f"Refusing forbidden archive path: {name}")
    if (path.name.startswith(".env") and not path.name.endswith(".example")) or path.name == ".discovery-local.json":
        raise SystemExit(f"Refusing private configuration: {name}")
    data = (root / name).read_bytes()
    if any(secret and secret in data for secret in secrets):
        raise SystemExit(f"Credential detected; no archive created: {name}")
    manifest.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})

archive = output / "Sila-discovery-source.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
    for entry in manifest:
        bundle.write(root / entry["path"], arcname=f"Sila/{entry['path']}")
record = {
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "scope": "Local working tree, including uncommitted/untracked source; no Git history, secrets, dependencies or build output",
    "baseCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
    "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "files": manifest,
}
(output / "manifest.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(f"Local source archive ready: {archive} ({len(manifest)} files, {archive.stat().st_size:,} bytes)")
print("Credential scan passed. No files were uploaded, committed or pushed.")
