import os
import gc
import rembg
from PIL import Image

src_assets = [
    (r"C:\Users\sifaq\.gemini\antigravity-cli\brain\fd197182-94ba-4487-a2e1-11e2f2c15819\veil_alpha_traders_prism_1791268068056.jpg",
     r"D:\Project\wealthypeople\veil\public\assets\generated\alpha-trader-v2.png"),
    (r"C:\Users\sifaq\.gemini\antigravity-cli\brain\fd197182-94ba-4487-a2e1-11e2f2c15819\veil_institutional_vault_sphere_notext_1791268088863.jpg",
     r"D:\Project\wealthypeople\veil\public\assets\generated\institutional-vault-v2.png"),
    (r"C:\Users\sifaq\.gemini\antigravity-cli\brain\fd197182-94ba-4487-a2e1-11e2f2c15819\veil_everyday_defi_shield_v2_1791268084228.jpg",
     r"D:\Project\wealthypeople\veil\public\assets\generated\sovereign-shield-v2.png"),
]

# Use u2net session
session = rembg.new_session("u2net")

for src, dest in src_assets:
    print(f"Reading {src}...")
    if not os.path.exists(src):
        print(f"ERROR: {src} not found")
        continue
    img = Image.open(src)
    # Resize to 768x768 for fast, clean, memory-safe inference
    img_resized = img.resize((768, 768), Image.Resampling.LANCZOS)
    print(f"Removing background from {src}...")
    out = rembg.remove(img_resized, session=session)
    out.save(dest, "PNG")
    print(f"Successfully saved {dest} (size: {os.path.getsize(dest)} bytes)")
    del img
    del img_resized
    del out
    gc.collect()

print("ALL ASSETS PROCESSED SUCCESSFULLY!")
