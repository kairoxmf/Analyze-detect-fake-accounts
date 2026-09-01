from __future__ import annotations

from typing import Optional

import pandas as pd


TIMESTAMP_CANDIDATES = [
    "timestamp",
    "post_time",
    "created_at",
    "date",
    "time",
]


def find_timestamp_column(df: pd.DataFrame) -> Optional[str]:
    for col in TIMESTAMP_CANDIDATES:
        if col in df.columns:
            return col
    return None


def compute_temporal_features(
    df: pd.DataFrame, user_col: str, time_col: str
) -> pd.DataFrame:
    data = df[[user_col, time_col]].copy()
    data[time_col] = pd.to_datetime(data[time_col], errors="coerce", utc=True)
    data = data.dropna(subset=[time_col])

    if data.empty:
        return pd.DataFrame(columns=[user_col])

    data = data.sort_values([user_col, time_col])

    features = []
    for user_id, group in data.groupby(user_col):
        times = group[time_col].sort_values()
        if len(times) < 2:
            features.append(
                {
                    user_col: user_id,
                    "post_count": len(times),
                    "active_span_days": 0.0,
                    "mean_gap_hours": 0.0,
                    "burstiness": 0.0,
                    "night_activity_ratio": 0.0,
                }
            )
            continue

        deltas = times.diff().dropna().dt.total_seconds() / 3600.0
        mean_gap = deltas.mean() if not deltas.empty else 0.0
        std_gap = deltas.std() if not deltas.empty else 0.0
        burstiness = (std_gap / mean_gap) if mean_gap else 0.0
        span_days = (times.max() - times.min()).total_seconds() / 86400.0

        hours = times.dt.hour
        night_ratio = float((hours < 6).sum()) / max(len(hours), 1)

        features.append(
            {
                user_col: user_id,
                "post_count": len(times),
                "active_span_days": float(span_days),
                "mean_gap_hours": float(mean_gap),
                "burstiness": float(burstiness),
                "night_activity_ratio": float(night_ratio),
            }
        )

    return pd.DataFrame(features)
