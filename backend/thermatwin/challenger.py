"""Offline candidate only. Importing this module never fits, sends or promotes."""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

from .model import scores
from .reliability import SEASONS
from .science import FEATURES


class CausalFeatureExpansion(TransformerMixin, BaseEstimator):
    """Row-local transformation of the existing causal inference contract."""

    def fit(self, x, y=None):
        self.feature_names_in_ = np.asarray(FEATURES, dtype=object)
        self.n_features_in_ = len(FEATURES)
        self.transform(x)
        return self

    def transform(self, x):
        if not isinstance(x, pd.DataFrame) or list(x.columns) != FEATURES:
            raise ValueError("Candidate requires the original ordered feature contract")
        out = x.copy()
        out["delta1"] = x.sst_c - x.lag1
        out["delta2"] = x.lag1 - x.lag2
        out["acceleration"] = out.delta1 - out.delta2
        out["trend_change"] = x.trend3 / 3 - x.trend7 / 7
        out["mean_gap"] = x.mean3 - x.mean14
        out["scaled_trend"] = x.trend3 / (x.std7 + 0.05)
        out["positive_delta1"] = out.delta1.clip(lower=0)
        out["delta1_sin"] = out.delta1 * x.sin_day
        out["delta1_cos"] = out.delta1 * x.cos_day
        return out


def select_candidate(x_train, y_train, x_validation, y_validation, origin_validation, protocol):
    """No calibration or test block is accepted by the selection API."""
    winner, board = None, []
    for order, variant in enumerate(protocol["variants"]):
        model = Pipeline(
            [
                ("causal", CausalFeatureExpansion()),
                (
                    "xgb",
                    XGBRegressor(
                        **protocol["shared_parameters"], **{k: v for k, v in variant.items() if k != "name"}
                    ),
                ),
            ]
        )
        model.fit(x_train, y_train)
        delta = model.predict(x_validation)
        for weight in protocol["weights"]:
            metric = scores(y_validation, origin_validation + weight * delta)
            item = {"variant": variant["name"], "weight": weight, "validation": metric}
            board.append(item)
            key = (metric["mae_c"], order, weight)
            if winner is None or key < winner[0]:
                winner = (key, model, item)
    return winner[1], winner[2], board


def subgroup_scores(rows):
    groups = {str(y): g for y, g in rows.groupby(pd.DatetimeIndex(rows.target_date).year)}
    groups.update(
        {
            s: rows.loc[pd.DatetimeIndex(rows.target_date).month.map(SEASONS) == s]
            for s in ("DJF", "MAM", "JJA", "SON")
        }
    )
    return {k: {"n": len(g), **scores(g.actual_c, g.model_c)} for k, g in groups.items() if len(g)}


def promotion_gates(candidate, champion, gates):
    """An explicit list of failures; never changes an artifact or config."""
    checks = {}
    for h in ("1", "2", "3"):
        a, b = candidate["horizons"][h], champion["horizons"][h]
        gain = 100 * (1 - a["model"]["mae_c"] / b["model"]["mae_c"])
        daily_a, daily_b = a["daily"]["optimized"], b["daily"]["optimized"]
        tests = {
            "mae_gain": gain >= gates["minimum_mae_gain_pct_each_horizon"],
            "rmse": a["model"]["rmse_c"] <= b["model"]["rmse_c"] * gates["maximum_rmse_ratio"],
            "warning_f1": daily_a["f1"] - daily_b["f1"] >= gates["minimum_warning_f1_delta"],
            "warning_recall": daily_b["recall"] - daily_a["recall"] <= gates["maximum_warning_recall_drop"],
            "rapid_warming": a["subgroups"]["rising"]["model"]["mae_c"]
            <= b["subgroups"]["rising"]["model"]["mae_c"] * gates["maximum_rapid_warming_mae_ratio"],
            "coverage": a["interval"]["coverage"] >= gates["minimum_interval_coverage"],
            "width": a["interval"]["mean_width_c"]
            <= b["interval"]["mean_width_c"] * gates["maximum_interval_width_ratio"],
            "year_season": all(
                a["year_season"][k]["mae_c"] <= m["mae_c"] * gates["maximum_year_season_mae_ratio_n_ge_30"]
                for k, m in b["year_season"].items()
                if m["n"] >= 30
            ),
        }
        checks.update({f"{h}d/{key}": bool(value) for key, value in tests.items()})
    a, b = candidate["combined_engine"], champion["combined_engine"]
    checks["early_events"] = a["early_events"] - b["early_events"] >= gates["minimum_early_events_delta"]
    checks["false_event_notices"] = (
        a["false_event_notifications"] - b["false_event_notifications"]
        <= gates["maximum_false_event_notices_delta"]
    )
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "failed": [k for k, v in checks.items() if not v],
    }
