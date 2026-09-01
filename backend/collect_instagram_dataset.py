from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Dict, List

import pandas as pd
from instagrapi import Client

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_PATH = DATA_DIR / "instagram_crawl.csv"


def get_client() -> Client:
    client = Client()
    session_path = Path(__file__).resolve().parent / "instagram_session.json"
    if session_path.exists():
        settings = session_path.read_text(encoding="utf-8")
        client.load_settings(settings)
        try:
            client.get_timeline_feed()
            return client
        except Exception:
            pass
    username = os.getenv("IG_USERNAME", "")
    password = os.getenv("IG_PASSWORD", "")
    if not username or not password:
        raise RuntimeError("IG_USERNAME / IG_PASSWORD not set")
    client.login(username, password)
    try:
        session_path.write_text(client.get_settings(), encoding="utf-8")
    except Exception:
        pass
    return client


def label_account(user: Dict) -> int:
    followers = int(user.get("followers", 0) or 0)
    following = int(user.get("following", 0) or 0)
    posts = int(user.get("posts", 0) or 0)
    has_pic = int(user.get("has_profile_pic", 0) or 0)
    ratio = followers / max(following, 1)
    if followers < 30 and following > 1500:
        return 1
    if followers < 100 and following > 2000:
        return 1
    if followers < 200 and posts > 2000:
        return 1
    if followers > 3000 and ratio < 0.1:
        return 1
    if not has_pic and followers < 200:
        return 1
    return 0


def enrich_with_label(df: pd.DataFrame) -> pd.DataFrame:
    if "label" in df.columns:
        return df
    records: List[Dict] = []
    for _, row in df.iterrows():
        rec = dict(row)
        rec["label"] = label_account(rec)
        records.append(rec)
    return pd.DataFrame(records)


def crawl_usernames(client: Client, usernames: List[str]) -> List[Dict]:
    rows: List[Dict] = []
    for name in usernames:
        username = str(name).strip().lstrip("@")
        if not username:
            continue
        try:
            info = client.user_info_by_username(username)
        except Exception:
            continue
        followers = int(getattr(info, "follower_count", 0) or 0)
        following = int(getattr(info, "following_count", 0) or 1)
        posts = int(getattr(info, "media_count", 0) or 0)
        bio = str(getattr(info, "biography", "") or "")
        has_pic = 1 if getattr(info, "profile_pic_url", None) else 0
        created_at = getattr(info, "date_joined", None)
        if created_at is not None and hasattr(created_at, "days"):
            age_days = max(created_at.days, 1)
        else:
            age_days = 365
        rows.append(
            {
                "username": username,
                "followers": followers,
                "following": following,
                "posts": posts,
                "account_age_days": age_days,
                "bio": bio,
                "has_profile_pic": has_pic,
                "likes_per_day": 0,
                "comments_per_day": 0,
            }
        )
    return rows


def crawl_from_seed_lists(client: Client) -> pd.DataFrame:
    seeds_fake = [
        "freefollowers",
        "getfreefollowers",
        "follow4follow",
        "buyfollowers",
        "free_like_panel",
        "crypto_signal_vip",
        "forex_signal_vip",
    ]
    seeds_real = [
        "instagram",
        "natgeo",
        "nasa",
        "nike",
        "github",
        "google",
        "microsoft",
    ]
    all_rows: List[Dict] = []
    all_rows.extend(crawl_usernames(client, seeds_fake))
    all_rows.extend(crawl_usernames(client, seeds_real))
    return pd.DataFrame(all_rows)


def export_to_csv(df: pd.DataFrame, path: Path) -> None:
    if not df.shape[0]:
        return
    columns = [
        "username",
        "followers",
        "following",
        "posts",
        "account_age_days",
        "bio",
        "has_profile_pic",
        "likes_per_day",
        "comments_per_day",
        "label",
    ]
    df.to_csv(path, index=False, quoting=csv.QUOTE_MINIMAL, columns=columns)


def main() -> None:
    client = get_client()
    df_seed = crawl_from_seed_lists(client)
    df_labeled = enrich_with_label(df_seed)
    export_to_csv(df_labeled, OUTPUT_PATH)


if __name__ == "__main__":
    main()

