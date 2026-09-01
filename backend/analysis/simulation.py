from __future__ import annotations

from typing import Tuple

import pandas as pd


def simulate_attack_signals(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    df["simulated_attack"] = False
    df["attack_type"] = ""
    df["attack_score"] = 0

    conditions = []
    conditions.append(
        (
            (df.get("burstiness", 0) > 1.1)
            & (df.get("night_activity_ratio", 0) > 0.3),
            "Automated_Botnet_Burst",
            2,
        )
    )
    conditions.append(
        (
            (df.get("post_rate_per_day", 0) > 6)
            & (df.get("follower_following_ratio", 0) < 0.2),
            "Follower_Farm_Wave",
            1,
        )
    )
    conditions.append(
        (
            (df.get("fake_probability", 0) > 0.8)
            & (df.get("account_age_days", 0) < 90),
            "Fresh_Account_Surge",
            1,
        )
    )

    for condition, label, score in conditions:
        if hasattr(condition, "fillna"):
            hit = condition.fillna(False)
        else:
            hit = pd.Series(bool(condition), index=df.index)
        df.loc[hit, "simulated_attack"] = True
        df.loc[hit, "attack_type"] = label
        df.loc[hit, "attack_score"] = df.loc[hit, "attack_score"] + score

    summary = {
        "simulated_attack_count": int(df["simulated_attack"].sum()),
        "attack_types": (
            df[df["simulated_attack"]]["attack_type"].value_counts().to_dict()
        ),
    }

    return df, summary
