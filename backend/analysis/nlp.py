from __future__ import annotations

import re
from typing import Dict

import pandas as pd

SUSPICIOUS_KEYWORDS = [
    "free",
    "earn",
    "click",
    "giveaway",
    "promo",
    "dm",
    "follow",
    "follower",
    "followers",
    "like",
    "likes",
    "view",
    "views",
    "panel",
    "insta",
    "instagram",
    "bitcoin",
    "crypto",
    "investment",
    "signal",
    "boost",
    "shop",
    "service",
    "رایگان",
    "هدیه",
    "فالو",
    "فالوور",
    "لایک",
    "ویو",
]

POSITIVE_WORDS = [
    "trusted",
    "official",
    "verified",
    "research",
    "developer",
    "engineer",
    "education",
    "science",
]

NEGATIVE_WORDS = [
    "scam",
    "fake",
    "hack",
    "bot",
    "spam",
    "fraud",
]


URL_PATTERN = re.compile(r"(https?://|www\.)", re.IGNORECASE)


def _count_keywords(text: str, keywords) -> int:
    text_lower = text.lower()
    return sum(1 for kw in keywords if kw in text_lower)


def compute_text_features(text_series: pd.Series) -> pd.DataFrame:
    text_series = text_series.fillna("").astype(str)
    features = {
        "suspicious_keyword_score": [],
        "sentiment_score": [],
        "url_count": [],
        "caps_ratio": [],
    }

    for text in text_series:
        suspicious = _count_keywords(text, SUSPICIOUS_KEYWORDS)
        positive = _count_keywords(text, POSITIVE_WORDS)
        negative = _count_keywords(text, NEGATIVE_WORDS)
        sentiment = positive - negative
        urls = len(URL_PATTERN.findall(text))
        caps = sum(1 for c in text if c.isupper())
        caps_ratio = caps / max(len(text), 1)

        features["suspicious_keyword_score"].append(suspicious)
        features["sentiment_score"].append(sentiment)
        features["url_count"].append(urls)
        features["caps_ratio"].append(caps_ratio)

    return pd.DataFrame(features)
