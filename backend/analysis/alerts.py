from __future__ import annotations

from typing import List


def build_alerts(row) -> List[str]:
    alerts: List[str] = []

    ratio = row.get("follower_following_ratio", 0) or 0
    post_rate = row.get("post_rate_per_day", 0) or 0
    engagement = row.get("engagement_rate", 0) or 0
    bio_len = row.get("bio_length", 0) or 0
    has_pic = row.get("has_profile_pic", 0) or 0
    fake_prob = row.get("fake_probability", 0) or 0

    if ratio < 0.1 or ratio > 6:
        alerts.append("Abnormal follower/following ratio")
    if post_rate > 8:
        alerts.append("Excessive posting frequency")
    if engagement > 0.25 and row.get("_followers", 0) < 200:
        alerts.append("High engagement with low followers")
    if bio_len < 6 and not has_pic:
        alerts.append("Low-profile identity signals")
    if fake_prob > 0.8:
        alerts.append("High model risk probability")

    if row.get("suspicious_keyword_score", 0) >= 2:
        alerts.append("Suspicious keywords detected in text")
    if row.get("sentiment_score", 0) < -1:
        alerts.append("Negative sentiment pattern detected")
    if row.get("url_count", 0) >= 2:
        alerts.append("Multiple URLs in content")

    burstiness = row.get("burstiness", 0) or 0
    night_ratio = row.get("night_activity_ratio", 0) or 0
    if burstiness > 1.2:
        alerts.append("Burst posting behavior detected")
    if night_ratio > 0.45:
        alerts.append("Unusual night activity")

    bot_ring = row.get("bot_ring_warning", False)
    if bot_ring:
        alerts.append("Possible bot-ring coordination")

    botnet = row.get("botnet_attack_warning", False)
    if botnet:
        alerts.append("Botnet attack pattern detected")

    if row.get("simulated_attack", False):
        attack_type = row.get("attack_type", "Attack simulation")
        alerts.append(f"Simulated attack: {attack_type}")

    platform = str(row.get("platform", "")).lower()
    if platform == "tiktok" and post_rate > 5:
        alerts.append("TikTok: excessive posting cadence")
    if platform == "twitter" and ratio < 0.2:
        alerts.append("Twitter: abnormal follower ratio")
    if platform == "instagram" and engagement > 0.2:
        alerts.append("Instagram: unusually high engagement")

    return alerts
