"""Restore referenced upload files from identical bundled assets, without reseeding.

Use: python -m backend.app.db.restore_uploads --assets-source frontend/static/assets
Only files whose content digest matches the 32-character upload name are copied.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from PIL import Image
from backend.app.db.database import get_db_connection

UPLOAD_URL = re.compile(r'/uploads/(avatars|articles)/([a-f0-9]{32}\.(?:jpg|png|webp))')


def referenced_images():
    urls = set()
    with get_db_connection(read_only=True) as db:
        available = {(row['table_name'], row['column_name']) for row in db.execute(
            'SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema()').fetchall()}
        # Only public image columns and article/profile content are inspected.
        for table, columns in (
            ('article', ('thumbnail_url', 'content')),
            ('department', ('cover_image_url', 'gallery', 'extra_sections', 'overview')),
            ('users', ('avatar_url',)), ('doctor_profile', ('avatar_url', 'introduction')),
        ):
            for column in columns:
                if (table, column) not in available:
                    continue
                for row in db.execute(f'SELECT {column} AS value FROM {table}').fetchall():
                    urls.update((match[1], match[2]) for match in UPLOAD_URL.finditer(str(row['value'] or '')))
    return urls


def restore(source, destination, *, dry_run=False):
    required = referenced_images()
    pending = {(folder, filename) for folder, filename in required if not (destination / folder / filename).is_file()}
    targets = {Path(filename).stem for _, filename in pending}
    originals = {}
    for path in source.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp', '.avif'):
            continue
        data = path.read_bytes()
        for algorithm in ('md5', 'sha1', 'sha256'):
            digest = hashlib.new(algorithm, data).hexdigest()[:32]
            if digest in targets:
                originals[digest] = path
    copied, unresolved = [], []
    for folder, filename in sorted(pending):
        original = originals.get(Path(filename).stem)
        if original is None:
            unresolved.append(f'/uploads/{folder}/{filename}')
            continue
        with Image.open(original) as picture:
            expected = {'jpg': 'JPEG', 'png': 'PNG', 'webp': 'WEBP'}[Path(filename).suffix[1:]]
            if picture.format != expected:
                unresolved.append(f'/uploads/{folder}/{filename}')
                continue
            picture.verify()
        if not dry_run:
            target = destination / folder / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as handle:
                handle.write(original.read_bytes())
        copied.append(f'/uploads/{folder}/{filename}')
    return {'referenced': len(required), 'restored': 0 if dry_run else len(copied), 'can_restore': len(copied),
            'already_present': len(required) - len(pending), 'unresolved': unresolved}


def main():
    import os
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets-source', type=Path, required=True)
    parser.add_argument('--dry-run', action='store_true', help='Check matching originals without copying files')
    args = parser.parse_args()
    if not args.assets_source.is_dir():
        parser.error('Asset source directory does not exist')
    destination = Path(os.environ.get('UPLOAD_DIR', str(Path(__file__).resolve().parents[2] / 'uploads')))
    report = restore(args.assets_source, destination, dry_run=args.dry_run)
    print(json.dumps(report, ensure_ascii=False))
    return 1 if report['unresolved'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
