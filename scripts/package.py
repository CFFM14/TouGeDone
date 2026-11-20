"""Build only the distributable extension, never the whole working directory."""
from pathlib import Path
import base64
import hashlib
import json
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'manifest.json', 'background.js', 'bootstrap.js', 'context-utils.js',
    'solution-policy.js', 'source-session.js', 'choice-batch.js', 'panel-ui.js',
    'network-bridge.js', 'editor-bridge.js', 'page-controls.js', 'program-runner.js',
    'helper.js', 'ai-service.js', 'update-service.js', 'options.html', 'options.js',
    'update-options.js', 'directory-update.js', 'README.md', '使用说明.md', '版本更新记录.md',
]

def build():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8-sig'))
    metadata = json.loads((ROOT / 'package.json').read_text(encoding='utf-8-sig'))
    version = manifest['version']
    if metadata['version'] != version:
        raise ValueError('package.json 与 manifest.json 版本不一致')
    files = FILES + [p.relative_to(ROOT).as_posix() for p in (ROOT / 'icons').glob('*.png')]
    required = {p for entry in manifest['content_scripts'] for p in entry['js']} | set(manifest['icons'].values())
    if not required.issubset(files):
        raise ValueError('安装包缺少运行依赖')
    destination = ROOT / 'dist'
    destination.mkdir(exist_ok=True)
    package = destination / f'TouGeDone-v{version}.zip'
    with ZipFile(package, 'w', ZIP_DEFLATED) as archive:
        for name in sorted(files):
            archive.write(ROOT / name, name)
    digest = hashlib.sha256(package.read_bytes()).hexdigest()
    checksum = package.with_suffix('.zip.sha256')
    checksum.write_text(f'{digest}  {package.name}\n', encoding='ascii')
    bundle = destination / f'TouGeDone-v{version}.bundle.json'
    bundle.write_text(json.dumps({'format': 1, 'version': version, 'files': [
        {'path': name, 'data': base64.b64encode((ROOT / name).read_bytes()).decode('ascii'),
         'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in sorted(files)
    ]}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return version, package, checksum

if __name__ == '__main__':
    version, package, checksum = build()
    print(f'已打包 v{version}: {package.name}，已生成 SHA-256 校验文件。')
