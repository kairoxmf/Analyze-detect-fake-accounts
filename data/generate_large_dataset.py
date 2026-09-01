#!/usr/bin/env python3
"""
Generate a large synthetic dataset for Fake Account Lab (Sentinel).
Usage: python generate_large_dataset.py [--rows 20000]
Output: data/synthetic_accounts_large.csv
"""
from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

# Same columns as existing synthetic_accounts.csv
HEADER = [
    "user_id", "username", "followers", "following", "posts", "account_age_days",
    "bio", "has_profile_pic", "likes_per_day", "comments_per_day",
    "label", "source_id", "target_id",
]

REAL_BIOS = [
    "UI/UX designer | Tehran", "Street & travel photography", "Recipes | home cooking",
    "Frontend dev | React & Vue", "Travel | remote work", "Daily tech & startup news",
    "Poems & short writings", "Online coach | workouts", "Minimal life & design",
    "Backend dev | Django", "Digital art & sketches", "Product & growth hacking",
    "Easy home recipes", "Car reviews & tests", "PC & console gaming clips",
    "Makeup & skincare tips", "Iran startup & VC news", "Cybersecurity researcher",
    "Space lover | photography | STEM", "UI designer. Coffee fan.", "ML engineer | AI research",
    "City vibes + street shots.", "Breaking tech news.", "Writer | minimal.",
    "Coach | habits | growth.", "Traveler | explorer.", "Backend dev | Flask.",
    "Digital art & illustration.", "Product | growth | AI.", "Food recipes | kitchen.",
    "History researcher.", "Tech reviewer.", "Teacher | learning.",
    "Designer | coffee", "Product manager", "Photographer", "AI engineer | research",
    "Data scientist", "Cybersecurity analyst", "Writer | minimal",
]

FAKE_BIOS = [
    "Earn fast", "DM for investment.", "Giveaway bots", "Click link",
    "Free followers now", "Promo drops", "Buy crypto now", "Free followers DM now",
    "Giveaway & like bots", "Click link for gifts", "Earn daily money DM",
    "Auto comment system", "iPhone giveaway follow all", "Promo only",
    "Fast profit signals", "Earn fast | DM", "Fast profit signals",
]

def gen_username(uid: str, is_fake: bool) -> str:
    base = uid.replace("U", "user_") if uid.startswith("U") else uid.lower()
    if is_fake:
        return random.choice(("bot_", "spam_", "fake_", "promo_")) + base
    return base

def main():
    p = argparse.ArgumentParser(description="Generate large synthetic dataset")
    p.add_argument("--rows", type=int, default=20_000, help="Number of accounts")
    p.add_argument("--out", type=str, default=None, help="Output CSV path")
    args = p.parse_args()
    n = max(1000, min(args.rows, 100_000))
    out_path = Path(args.out) if args.out else Path(__file__).resolve().parent / "synthetic_accounts_large.csv"

    random.seed(42)
    ids = [f"U{i:06d}" for i in range(1, n + 1)]
    # ~25% fake
    labels = [1 if random.random() < 0.25 else 0 for _ in ids]

    rows = []
    for i, (uid, label) in enumerate(zip(ids, labels)):
        is_fake = label == 1
        if is_fake:
            followers = random.randint(5, 120)
            following = random.randint(800, 3500)
            posts = random.randint(2000, 10000)
            age_days = random.randint(20, 150)
            has_pic = 0
            likes_day = random.randint(200, 500)
            comments_day = random.randint(60, 140)
            bio = random.choice(FAKE_BIOS)
        else:
            followers = random.randint(200, 25000)
            following = random.randint(100, 1200)
            posts = random.randint(100, 3500)
            age_days = random.randint(300, 2500)
            has_pic = 1
            likes_day = random.randint(10, 350)
            comments_day = random.randint(1, 35)
            bio = random.choice(REAL_BIOS)

        username = gen_username(uid, is_fake)
        source_id = uid
        target_id = random.choice(ids)
        if target_id == source_id:
            target_id = ids[(i + 1) % len(ids)]

        rows.append({
            "user_id": uid,
            "username": username,
            "followers": followers,
            "following": following,
            "posts": posts,
            "account_age_days": age_days,
            "bio": bio,
            "has_profile_pic": has_pic,
            "likes_per_day": likes_day,
            "comments_per_day": comments_day,
            "label": label,
            "source_id": source_id,
            "target_id": target_id,
        })

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows to {out_path}")

if __name__ == "__main__":
    main()
