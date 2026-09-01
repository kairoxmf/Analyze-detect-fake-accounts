import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

OUT_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_accounts_big.csv"
TIME_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_accounts_time.csv"

BIOS_REAL = [
    "AI engineer | research",
    "Designer | coffee",
    "Cybersecurity analyst",
    "Product manager",
    "Data scientist",
    "Teacher | learning",
    "Photographer",
    "Writer | minimal",
]

BIOS_FAKE = [
    "Earn fast",
    "DM for investment",
    "Click link",
    "Free followers",
    "Promo only",
    "Giveaway now",
]

def make_user(i, fake=False):
    user_id = f"U{i:05d}"
    username = f"{'bot' if fake else 'user'}_{i:05d}"
    if fake:
        followers = random.randint(5, 80)
        following = random.randint(1200, 2500)
        posts = random.randint(3000, 9000)
        age = random.randint(20, 120)
        likes = random.randint(200, 600)
        comments = random.randint(60, 180)
        bio = random.choice(BIOS_FAKE)
        pic = 0
        label = 1
    else:
        followers = random.randint(300, 12000)
        following = random.randint(200, 900)
        posts = random.randint(200, 2500)
        age = random.randint(300, 2600)
        likes = random.randint(20, 260)
        comments = random.randint(2, 20)
        bio = random.choice(BIOS_REAL)
        pic = 1
        label = 0
    source_id = user_id
    target_id = f"U{random.randint(1, 5000):05d}"
    return [
        user_id,
        username,
        followers,
        following,
        posts,
        age,
        bio,
        pic,
        likes,
        comments,
        label,
        source_id,
        target_id,
    ]


def make_events(rows, events_per_user=5):
    start = datetime(2025, 12, 1, 0, 0, 0)
    event_rows = []
    for row in rows:
        user_id = row[0]
        username = row[1]
        for _ in range(events_per_user):
            offset_hours = random.randint(0, 120)
            event_time = start + timedelta(hours=offset_hours)
            event_rows.append(row + [event_time.isoformat() + "Z"])
    return event_rows


def main():
    rows = []
    for i in range(1, 5001):
        fake = random.random() < 0.25
        rows.append(make_user(i, fake=fake))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "user_id",
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
                "source_id",
                "target_id",
            ]
        )
        writer.writerows(rows)

    print(f"Saved: {OUT_PATH}")

    time_rows = make_events(rows[:200], events_per_user=4)
    with TIME_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "user_id",
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
                "source_id",
                "target_id",
                "timestamp",
            ]
        )
        writer.writerows(time_rows)

    print(f"Saved: {TIME_PATH}")


if __name__ == "__main__":
    main()
