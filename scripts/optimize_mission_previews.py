#!/usr/bin/env python3
"""Optimize local Missions-hub card images without changing their URLs.

Read-only report by default; use --apply to replace files with smaller copies.
Pillow is already in requirements.txt. Run from any working directory:

    python scripts/optimize_mission_previews.py
    python scripts/optimize_mission_previews.py --apply
    python scripts/optimize_mission_previews.py --mission cassini gaia
    python scripts/optimize_mission_previews.py --include-uploads --apply

Only MISSIONS[].img defaults are selected, plus data/missions/* when requested.
Unreferenced preview.jpg files used by detail-page heroes are left alone.
Originals and repeat-run hashes live under data/mission-preview-optimization/.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile

from PIL import Image, ImageCms, ImageOps


ROOT = Path(__file__).resolve().parents[1]
FORMATS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def inside(path, directory):
    resolved = path.resolve()
    resolved.relative_to(directory.resolve())
    return resolved


def discover(root, missions, include_uploads):
    """Read the flat, literal registry; do not execute JavaScript or fetch URLs."""
    public = root / "my-app/public"
    registry = (root / "my-app/src/lib/missions.js").read_text(encoding="utf-8")
    entries = re.findall(r'\bkey:\s*"([a-z0-9_-]+)"([^}]+)', registry)
    known = {key for key, _ in entries}
    if missions - known:
        raise ValueError("Unknown mission(s): " + ", ".join(sorted(missions - known)))
    targets, missing = set(), []
    for key, body in entries:
        if missions and key not in missions:
            continue
        match = re.search(r'\bimg:\s*"(/[^"?]+)"', body)
        if match:
            path = inside(public / match[1].lstrip("/"), public)
            if path.is_file():
                targets.add(path)
            else:
                missing.append(path.relative_to(root).as_posix())
    if include_uploads:
        uploads = root / "data/missions"
        for path in sorted(uploads.glob("*")):
            if path.suffix.lower() in FORMATS and path.stem in known and (not missions or path.stem in missions):
                targets.add(inside(path, uploads))
    return sorted(targets), missing


def encode(raw, suffix, max_size, quality):
    with Image.open(io.BytesIO(raw)) as source:
        if getattr(source, "n_frames", 1) != 1:
            raise ValueError("Animated images are not supported")
        image = ImageOps.exif_transpose(source)
        old_size = image.size
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        # Keep colour management; discard camera EXIF, GPS and other metadata.
        icc = image.info.get("icc_profile")
        if icc and image.mode not in ("RGB", "RGBA", "P", "PA"):
            srgb = ImageCms.createProfile("sRGB")
            image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(icc)), srgb, outputMode="RGB")
            icc = ImageCms.ImageCmsProfile(srgb).tobytes()
        image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        image.info.clear()
        output = io.BytesIO()
        fmt = FORMATS[suffix.lower()]
        options = {"icc_profile": icc} if icc else {}
        if fmt == "JPEG":
            if image.mode == "RGBA":
                background = Image.new("RGB", image.size, "white")
                background.paste(image, mask=image.getchannel("A"))
                image = background
            options.update(quality=quality, optimize=True, progressive=True)
        elif fmt == "PNG":
            options.update(optimize=True, compress_level=9)
        else:
            options.update(quality=quality, method=6)
        image.save(output, format=fmt, **options)
        result = output.getvalue()
        with Image.open(io.BytesIO(result)) as check:
            check.load()
        return result, old_size, image.size


def atomic_write(path, raw, mode=None):
    """Keep the destination intact if encoding/writing fails."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".optimize-", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
        if mode is not None:
            temporary.chmod(mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def run(root, missions, include_uploads, max_size, quality, apply):
    root = root.resolve()
    targets, missing = discover(root, missions, include_uploads)
    state_dir = root / "data/mission-preview-optimization"
    state_path = state_dir / "manifest.json"
    # Refuse symlinks escaping the checkout, including for backup/state writes.
    inside(state_path, root)
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    settings = {"max_size": max_size, "quality": quality, "encoder": 1}
    before = after = changed = skipped = errors = 0
    print(f"{'APPLY' if apply else 'DRY RUN'}: max {max_size}px, quality {quality}; {len(targets)} image(s)")
    for path in targets:
        key = path.relative_to(root).as_posix()
        try:
            if path.suffix.lower() not in FORMATS:
                raise ValueError("Unsupported extension")
            current = path.read_bytes()
            current_hash = digest(current)
            record = state.get(key, {})
            before += len(current)
            if record.get("output_sha256") == current_hash and record.get("settings") == settings:
                after += len(current)
                skipped += 1
                print(f"SKIP {key}: already optimized")
                continue
            original = current
            if record.get("output_sha256") == current_hash:
                # Parameter changes start from the original, avoiding generation loss.
                backup = inside(root / record["original"], state_dir)
                original = backup.read_bytes()
                if digest(original) != record["original_sha256"]:
                    raise ValueError("Original backup checksum mismatch")
            optimized, old_size, new_size = encode(original, path.suffix, max_size, quality)
            if len(optimized) >= len(current):
                after += len(current)
                skipped += 1
                print(f"SKIP {key}: replacement would not be smaller")
                continue
            if apply:
                original_hash = digest(original)
                backup = inside(state_dir / "originals" / original_hash / Path(key), state_dir)
                backup.parent.mkdir(parents=True, exist_ok=True)
                # An immutable, content-addressed backup is saved before replacing.
                if backup.exists():
                    if digest(backup.read_bytes()) != original_hash:
                        raise ValueError("Existing backup checksum mismatch")
                else:
                    with backup.open("xb") as stream:
                        stream.write(original)
                state[key] = {"original": backup.relative_to(root).as_posix(),
                              "original_sha256": original_hash,
                              "output_sha256": digest(optimized), "settings": settings}
                # Write state first: an interrupted replacement can safely be retried.
                atomic_write(state_path, (json.dumps(state, indent=2) + "\n").encode("utf-8"))
                atomic_write(path, optimized, stat.S_IMODE(path.stat().st_mode))
            after += len(optimized)
            changed += 1
            reduction = (1 - len(optimized) / len(current)) * 100
            print(f"{'SAVED' if apply else 'WOULD SAVE'} {key}: {old_size[0]}x{old_size[1]} -> "
                  f"{new_size[0]}x{new_size[1]}, {len(current)/1024:.1f} -> {len(optimized)/1024:.1f} KiB (-{reduction:.1f}%)")
        except (OSError, ValueError, Image.DecompressionBombError, ImageCms.PyCMSError) as exc:
            errors += 1
            print(f"ERROR {key}: {exc}", file=sys.stderr)
    for key in missing:
        print(f"MISSING {key} (no local download; skipped)")
    saved = max(0, before - after) if not errors else None
    print(f"Changed: {changed}; skipped: {skipped}; missing: {len(missing)}; errors: {errors}")
    if saved is not None:
        print(f"Total: {before/1024/1024:.2f} -> {after/1024/1024:.2f} MiB; "
              f"saved {saved/1024/1024:.2f} MiB ({saved/before*100 if before else 0:.1f}%)")
    if apply and changed:
        print(f"Originals and manifest: {state_dir}")
    return 1 if errors else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=ROOT, help="Checkout root (default: inferred from this script)")
    parser.add_argument("--apply", action="store_true", help="Replace smaller images; default is read-only")
    parser.add_argument("--mission", nargs="+", default=[], help="Only these mission keys")
    parser.add_argument("--include-uploads", action="store_true", help="Also optimize existing data/missions images")
    parser.add_argument("--max-size", type=int, default=960, help="Maximum long edge in pixels (default: 960; no upscaling)")
    parser.add_argument("--quality", type=int, default=82, help="JPEG/WebP quality, 1-95 (default: 82)")
    args = parser.parse_args(argv)
    if args.max_size < 1 or not 1 <= args.quality <= 95:
        parser.error("--max-size must be positive and --quality must be between 1 and 95")
    try:
        return run(args.root, set(args.mission), args.include_uploads, args.max_size, args.quality, args.apply)
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, f"ERROR: {exc}\n")


if __name__ == "__main__":
    sys.exit(main())
