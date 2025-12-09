# System Symlinks Documentation

This document tracks symlinks created to offload large application data to the external Samsung T5 drive.

> **Important:** The Samsung T5 external drive must be mounted for these applications to work properly.

## Active Symlinks

| Application | Symlink Location | Target on Samsung T5 | Created |
|-------------|------------------|----------------------|---------|
| AdsPower (Data) | `/Users/harry/Library/Application Support/adspower_global` | `/Volumes/Samsung T5/adspower_global` | 2024-12-09 |
| AdsPower (Cache) | `/Users/harry/Library/Caches/adspower_global` | `/Volumes/Samsung T5/adspower_global_cache` | 2024-12-09 |

## Purpose

These symlinks redirect application data from the internal Mac drive to the external Samsung T5 SSD to:
- Free up space on the internal drive
- Keep large browser profile data on faster external storage
- Allow AdsPower to run with profiles stored externally

## Verification Commands

```bash
# Check if symlinks are working (run in Terminal)
ls -la "/Users/harry/Library/Application Support/adspower_global"
ls -la "/Users/harry/Library/Caches/adspower_global"

# Test accessibility
ls "/Users/harry/Library/Application Support/adspower_global" && echo "✅ Working" || echo "❌ Broken"
```

## How to Recreate (if needed)

If you need to recreate these symlinks (e.g., after a system restore):

```bash
# 1. Make sure Samsung T5 is mounted
# 2. Remove any existing folders (backup first if needed!)
# 3. Create symlinks:

ln -s "/Volumes/Samsung T5/adspower_global" "/Users/harry/Library/Application Support/adspower_global"
ln -s "/Volumes/Samsung T5/adspower_global_cache" "/Users/harry/Library/Caches/adspower_global"
```

## Troubleshooting

**"Symlink broken" error:**
1. Check if Samsung T5 is mounted: `ls /Volumes/Samsung\ T5/`
2. If not mounted, connect the drive and wait for it to mount
3. Verify target folder exists: `ls "/Volumes/Samsung T5/adspower_global"`

**AdsPower not working:**
1. Quit AdsPower completely
2. Verify symlinks with commands above
3. Restart AdsPower

---

*Last updated: 2024-12-09*
