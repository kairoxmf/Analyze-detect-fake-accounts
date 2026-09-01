from __future__ import annotations

import io
import os
import re
import html
import time
import uuid
import hmac
import secrets
import hashlib
import smtplib
from email.message import EmailMessage
from pathlib import Path
from urllib import error as urlerror
from urllib import request as urlrequest

try:
  from dotenv import load_dotenv
  load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
  pass
import json
import datetime as dt
from typing import Dict, List, Optional, Tuple

import networkx as nx
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.ensemble import IsolationForest, RandomForestClassifier

try:
  from openai import OpenAI
except ImportError:
  OpenAI = None
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MinMaxScaler
from instagrapi import Client

from analysis.temporal import compute_temporal_features, find_timestamp_column
from analysis.alerts import build_alerts
from analysis.simulation import simulate_attack_signals
from analysis.nlp import compute_text_features

app = Flask(__name__)
CORS(app)

LATEST_RESULTS: List[Dict] = []
LATEST_SUMMARY: Dict = {}
LATEST_DF: Optional[pd.DataFrame] = None
CHATBOT_SURVEY_DF: Optional[pd.DataFrame] = None
CHATBOT_SURVEY_DF_CODED: Optional[pd.DataFrame] = None
CHATBOT_SURVEY_LOAD_ERROR: Optional[str] = None
ACTIVITY_LOG: List[Dict] = []
BOT_LOG: List[Dict] = []
BOT_CONFIG = {
  "group_mode": True,
  "allow_mentions": True,
  "default_lang": "fa",
}
SUPPORT_SESSIONS_PATH = Path(__file__).resolve().parent / "support_sessions.json"
SUPPORT_SESSIONS: Dict[str, Dict] = {}
SUPPORT_NEXT_MSG_ID = 1
REWARD_DATA_PATH = Path(__file__).resolve().parent / "reward_data.json"
REWARD_DATA: Dict[str, Dict] = {}
REPORT_REWARD_USD = 25
MIN_WITHDRAW_USD = 250
REFERRAL_BONUS_USD = 5
FIRST_REPORT_BONUS_USD = 3
DAILY_CHALLENGE_BONUS_PCT = 10
LUCKY_BOX_EVERY_N = 5
LUCKY_BOX_MIN_USD = 2
LUCKY_BOX_MAX_USD = 15
USERS_DATA_PATH = Path(__file__).resolve().parent / "users_data.json"
USERS_DATA: Dict[str, Dict] = {}
OPERATOR_LAST_SEEN_AT = 0.0
LAST_UPLOAD_AT: Optional[str] = None
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
BOT_API_KEY = os.getenv("BOT_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
# Gap GPT: set to "1" or "true" to use https://api.gapgpt.app/v1 (OpenAI-compatible)
USE_GAPGPT = os.getenv("USE_GAPGPT", "").strip().lower() in ("1", "true", "yes")
GAPGPT_BASE_URL = os.getenv("GAPGPT_BASE_URL", "https://api.gapgpt.app/v1").strip()
# Other OpenAI-compatible APIs: set base URL (used when USE_GAPGPT is false)
CHAT_API_BASE_URL = (os.getenv("CHAT_API_BASE_URL", "").strip() or None)
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "").strip()
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest").strip()
CLAUDE_BASE_URL = os.getenv("CLAUDE_BASE_URL", "https://api.anthropic.com/v1/messages").strip()
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").strip().rstrip("/")
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587") or 587)
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER).strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "1").strip().lower() in ("1", "true", "yes")
OLLAMA_ENABLED = os.getenv("OLLAMA_ENABLED", "1").strip().lower() in ("1", "true", "yes")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip().rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b").strip()
OLLAMA_TIMEOUT_SEC = float(os.getenv("OLLAMA_TIMEOUT_SEC", "25") or 25)
IG_USERNAME = os.getenv("IG_USERNAME", "")
IG_PASSWORD = os.getenv("IG_PASSWORD", "")
IG_CLIENT: Optional[Client] = None
IG_CLIENT_LAST_ERROR: str = ""
IG_LOGIN_BLOCK_UNTIL: float = 0.0
INSTAGRAM_FEEDBACK_PATH = Path(__file__).resolve().parent / "instagram_feedback.json"
INSTAGRAM_FEEDBACK: Dict[str, str] = {}
CHATBOT_SURVEY_DIR = Path(__file__).resolve().parent.parent / "archive" / "Impact of Conversational Chatbots on Learning of University Students"
CHATBOT_SURVEY_FILE = CHATBOT_SURVEY_DIR / "AI_Chatbots_Students_Attitude_Dataset_EN.csv"
CHATBOT_SURVEY_FILE_CODED = CHATBOT_SURVEY_DIR / "AI_Chatbots_Students_Attitude_Dataset_Coded_EN.csv"

if INSTAGRAM_FEEDBACK_PATH.exists():
  try:
    INSTAGRAM_FEEDBACK = json.loads(
      INSTAGRAM_FEEDBACK_PATH.read_text(encoding="utf-8")
    )
  except Exception:
    INSTAGRAM_FEEDBACK = {}


def _get_ig_client() -> Optional[Client]:
  global IG_CLIENT, IG_CLIENT_LAST_ERROR, IG_LOGIN_BLOCK_UNTIL
  if IG_CLIENT is not None:
    return IG_CLIENT
  if IG_LOGIN_BLOCK_UNTIL and time.time() < IG_LOGIN_BLOCK_UNTIL:
    return None
  try:
    session_path = Path(__file__).resolve().parent / "instagram_session.json"
    client = Client()
    if session_path.exists():
      settings = session_path.read_text(encoding="utf-8")
      client.load_settings(settings)
      try:
        client.get_timeline_feed()
        IG_CLIENT = client
        IG_CLIENT_LAST_ERROR = ""
        return IG_CLIENT
      except Exception:
        pass
    if not IG_USERNAME or not IG_PASSWORD:
      IG_CLIENT_LAST_ERROR = "IG_USERNAME / IG_PASSWORD is missing in backend .env."
      # Return a non-authenticated client so we can still try public reads.
      IG_CLIENT = client
      return IG_CLIENT
    client.login(IG_USERNAME, IG_PASSWORD)
    try:
      session_path.write_text(client.get_settings(), encoding="utf-8")
    except Exception:
      pass
    IG_CLIENT = client
    IG_CLIENT_LAST_ERROR = ""
  except Exception as exc:
    IG_CLIENT = None
    IG_CLIENT_LAST_ERROR = _compact_ig_error(
      str(exc) or "Unknown Instagram client initialization error."
    )
    IG_LOGIN_BLOCK_UNTIL = time.time() + 300
  return IG_CLIENT


def _compact_ig_error(err: str) -> str:
  text = str(err or "").strip()
  if not text:
    return "Unknown Instagram error."
  low = text.lower()
  if "challengeresolve" in low or "challenge" in low:
    return "Instagram challenge required. Approve login from Instagram app/web and retry."
  if "429" in low or "rate" in low or "too many requests" in low:
    return "Instagram rate limit reached. Wait and retry later."
  if "password" in low or "login_required" in low:
    return "Instagram login failed. Check IG username/password in backend .env."
  if len(text) > 220:
    return text[:220] + "..."
  return text


def _parse_compact_number(raw: str) -> Optional[int]:
  s = str(raw or "").strip().replace(",", "")
  if not s:
    return None
  mult = 1
  if s[-1].lower() == "k":
    mult = 1_000
    s = s[:-1]
  elif s[-1].lower() == "m":
    mult = 1_000_000
    s = s[:-1]
  elif s[-1].lower() == "b":
    mult = 1_000_000_000
    s = s[:-1]
  try:
    return int(float(s) * mult)
  except Exception:
    return None


def _fetch_public_profile_fallback(username: str) -> Optional[Dict]:
  """Fetch limited public profile stats from instagram web page meta."""
  try:
    import requests  # already in requirements
  except Exception:
    return None
  try:
    headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "en-US,en;q=0.9",
    }
    resp = requests.get(
      f"https://www.instagram.com/{username}/",
      headers=headers,
      timeout=15,
    )
    if resp.status_code != 200 or not resp.text:
      return None
    text = resp.text
    # Try meta: "<followers> Followers, <following> Following, <posts> Posts - ..."
    m = re.search(
      r'property="og:description"\s+content="([^"]+)"',
      text,
      flags=re.IGNORECASE,
    )
    if not m:
      m = re.search(
        r"property='og:description'\s+content='([^']+)'",
        text,
        flags=re.IGNORECASE,
      )
    if not m:
      return None
    desc = html.unescape(m.group(1))
    counts = re.search(
      r"([\d\.,kmbKMB]+)\s+Followers?,\s*([\d\.,kmbKMB]+)\s+Following,\s*([\d\.,kmbKMB]+)\s+Posts?",
      desc,
      flags=re.IGNORECASE,
    )
    if not counts:
      return None
    followers = _parse_compact_number(counts.group(1))
    following = _parse_compact_number(counts.group(2))
    posts = _parse_compact_number(counts.group(3))
    name_m = re.search(r"videos from (.+?)\s*\(@", desc, flags=re.IGNORECASE)
    full_name = name_m.group(1).strip() if name_m else ""
    return {
      "followers": followers,
      "following": following,
      "posts": posts,
      "full_name": full_name,
    }
  except Exception:
    return None


def _read_csv(file_stream) -> pd.DataFrame:
  try:
    df = pd.read_csv(file_stream)
  except Exception:
    file_stream.seek(0)
    df = pd.read_csv(file_stream, sep=None, engine="python")
  df.columns = [str(col).strip().lower() for col in df.columns]
  return df


def _get_col(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
  for col in candidates:
    if col in df.columns:
      return col
  return None


def _safe_numeric(series) -> pd.Series:
  if not hasattr(series, "fillna"):
    series = pd.Series(series)
  return pd.to_numeric(series, errors="coerce").fillna(0)


def _log_activity(event: str, detail: Dict):
  timestamp = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
  ACTIVITY_LOG.insert(0, {"time": timestamp, "event": event, **detail})
  if len(ACTIVITY_LOG) > 200:
    ACTIVITY_LOG.pop()


def _log_bot(event: str, detail: Dict):
  timestamp = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
  BOT_LOG.insert(0, {"time": timestamp, "event": event, **detail})
  if len(BOT_LOG) > 200:
    BOT_LOG.pop()


def _require_admin(req) -> bool:
  token = req.headers.get("X-Admin-Token", "")
  return bool(ADMIN_TOKEN) and token == ADMIN_TOKEN


def _require_bot(req) -> bool:
  token = req.headers.get("X-Bot-Key", "")
  if BOT_API_KEY:
    return token == BOT_API_KEY
  # Fallback for local development when BOT_API_KEY is not set.
  return req.remote_addr in ["127.0.0.1", "::1"]


def _default_users_data() -> Dict:
  return {
    "users": {},
    "username_map": {},
    "email_map": {},
    "sessions": {},
    "reset_tokens": {},
    "next_user_id": 1,
  }


def _ensure_users_data_loaded():
  global USERS_DATA
  if USERS_DATA:
    return
  if not USERS_DATA_PATH.exists():
    USERS_DATA = _default_users_data()
    return
  try:
    raw = json.loads(USERS_DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
      USERS_DATA = _default_users_data()
      return
    data = _default_users_data()
    for key in ["users", "username_map", "email_map", "sessions", "reset_tokens"]:
      value = raw.get(key)
      data[key] = value if isinstance(value, dict) else {}
    try:
      data["next_user_id"] = max(int(raw.get("next_user_id") or 1), 1)
    except Exception:
      data["next_user_id"] = 1
    USERS_DATA = data
  except Exception:
    USERS_DATA = _default_users_data()


def _save_users_data():
  try:
    USERS_DATA_PATH.write_text(
      json.dumps(USERS_DATA, ensure_ascii=False, indent=2),
      encoding="utf-8",
    )
  except Exception:
    pass


def _normalize_username(raw: str) -> str:
  return re.sub(r"[^a-z0-9_.-]", "", str(raw or "").strip().lower())


def _normalize_email(raw: str) -> str:
  return str(raw or "").strip().lower()


def _is_valid_email(raw: str) -> bool:
  email = _normalize_email(raw)
  return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def _hash_password(password: str, salt_hex: str) -> str:
  data = hashlib.pbkdf2_hmac(
    "sha256",
    str(password or "").encode("utf-8"),
    bytes.fromhex(salt_hex),
    180000,
  )
  return data.hex()


def _create_user(username: str, password: str, display_name: str = "", email: str = "") -> Dict:
  _ensure_users_data_loaded()
  uname = _normalize_username(username)
  email_norm = _normalize_email(email)
  if len(uname) < 3:
    raise ValueError("Username must be at least 3 chars.")
  if len(str(password or "")) < 6:
    raise ValueError("Password must be at least 6 chars.")
  if not _is_valid_email(email_norm):
    raise ValueError("Valid email is required.")
  username_map = USERS_DATA.setdefault("username_map", {})
  email_map = USERS_DATA.setdefault("email_map", {})
  if uname in username_map:
    raise ValueError("Username already exists.")
  if email_norm in email_map:
    raise ValueError("Email already exists.")
  uid = str(USERS_DATA.get("next_user_id") or 1)
  USERS_DATA["next_user_id"] = int(uid) + 1
  salt_hex = secrets.token_hex(16)
  now = _now_iso()
  user = {
    "id": uid,
    "username": uname,
    "email": email_norm,
    "display_name": str(display_name or "").strip()[:80],
    "password_salt": salt_hex,
    "password_hash": _hash_password(password, salt_hex),
    "created_at": now,
    "last_login_at": now,
  }
  USERS_DATA.setdefault("users", {})[uid] = user
  username_map[uname] = uid
  email_map[email_norm] = uid
  _save_users_data()
  return user


def _find_user_by_username(username: str) -> Optional[Dict]:
  _ensure_users_data_loaded()
  uname = _normalize_username(username)
  uid = str((USERS_DATA.get("username_map") or {}).get(uname) or "")
  if not uid:
    return None
  return (USERS_DATA.get("users") or {}).get(uid)


def _find_user_by_email(email: str) -> Optional[Dict]:
  _ensure_users_data_loaded()
  e = _normalize_email(email)
  uid = str((USERS_DATA.get("email_map") or {}).get(e) or "")
  if not uid:
    return None
  return (USERS_DATA.get("users") or {}).get(uid)


def _clear_user_sessions(user_id: str):
  sessions = USERS_DATA.setdefault("sessions", {})
  to_delete = [tok for tok, s in sessions.items() if str((s or {}).get("user_id") or "") == str(user_id)]
  for tok in to_delete:
    sessions.pop(tok, None)


def _create_reset_token(user_id: str) -> str:
  _ensure_users_data_loaded()
  token = secrets.token_urlsafe(40)
  USERS_DATA.setdefault("reset_tokens", {})[token] = {
    "user_id": str(user_id),
    "expires_at": int(time.time() + 3600),
  }
  _save_users_data()
  return token


def _consume_reset_token(token: str) -> Optional[Dict]:
  _ensure_users_data_loaded()
  tokens = USERS_DATA.setdefault("reset_tokens", {})
  payload = tokens.get(str(token or ""))
  if not payload:
    return None
  try:
    if int(payload.get("expires_at") or 0) < int(time.time()):
      tokens.pop(str(token), None)
      _save_users_data()
      return None
  except Exception:
    tokens.pop(str(token), None)
    _save_users_data()
    return None
  tokens.pop(str(token), None)
  _save_users_data()
  return payload


def _send_password_reset_email(to_email: str, reset_token: str) -> Tuple[bool, str]:
  if not SMTP_HOST or not SMTP_FROM:
    return False, "SMTP is not configured."
  reset_link = f"{FRONTEND_BASE_URL}/user/reset-password?token={reset_token}"
  msg = EmailMessage()
  msg["Subject"] = "Reset your password"
  msg["From"] = SMTP_FROM
  msg["To"] = to_email
  msg.set_content(
    "You requested a password reset.\n\n"
    f"Open this link to set a new password:\n{reset_link}\n\n"
    "This link expires in 60 minutes.\n"
    "If you did not request this, ignore this email."
  )
  try:
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
      if SMTP_USE_TLS:
        server.starttls()
      if SMTP_USER:
        server.login(SMTP_USER, SMTP_PASSWORD)
      server.send_message(msg)
    return True, ""
  except Exception as exc:
    return False, str(exc)


def _create_user_session(user_id: str) -> str:
  _ensure_users_data_loaded()
  token = secrets.token_urlsafe(32)
  USERS_DATA.setdefault("sessions", {})[token] = {
    "user_id": str(user_id),
    "created_at": _now_iso(),
    "last_seen_at": _now_iso(),
  }
  _save_users_data()
  return token


def _extract_user_token(req) -> str:
  auth = str(req.headers.get("Authorization") or "").strip()
  if auth.lower().startswith("bearer "):
    return auth[7:].strip()
  return str(req.headers.get("X-User-Token") or "").strip()


def _require_user(req) -> Optional[Dict]:
  _ensure_users_data_loaded()
  token = _extract_user_token(req)
  if not token:
    return None
  sessions = USERS_DATA.get("sessions", {})
  session = sessions.get(token)
  if not session:
    return None
  user = (USERS_DATA.get("users") or {}).get(str(session.get("user_id") or ""))
  if not user:
    sessions.pop(token, None)
    _save_users_data()
    return None
  session["last_seen_at"] = _now_iso()
  _save_users_data()
  return user


def _public_user(user: Dict) -> Dict:
  return {
    "id": user.get("id"),
    "username": user.get("username"),
    "email": user.get("email", ""),
    "display_name": user.get("display_name", ""),
    "created_at": user.get("created_at"),
    "last_login_at": user.get("last_login_at"),
  }


def feature_engineering(df: pd.DataFrame) -> pd.DataFrame:
  # Normalize feature columns from any CSV schema.
  followers_col = _get_col(df, ["followers", "followers_count", "subscriber_count"])
  following_col = _get_col(df, ["following", "following_count", "friends_count"])
  posts_col = _get_col(df, ["posts", "posts_count", "post_count"])
  age_col = _get_col(df, ["account_age_days", "age_days", "days_active"])
  bio_col = _get_col(df, ["bio", "about", "description"])
  pic_col = _get_col(df, ["has_profile_pic", "has_photo", "profile_picture"])
  likes_col = _get_col(df, ["likes_per_day", "avg_likes", "like_rate"])
  comments_col = _get_col(df, ["comments_per_day", "avg_comments", "comment_rate"])

  df["_followers"] = _safe_numeric(df[followers_col]) if followers_col else 0
  df["_following"] = _safe_numeric(df[following_col]) if following_col else 1
  df["_posts"] = _safe_numeric(df[posts_col]) if posts_col else 0
  df["_age_days"] = _safe_numeric(df[age_col]) if age_col else 1
  df["_likes_day"] = _safe_numeric(df[likes_col]) if likes_col else 0
  df["_comments_day"] = _safe_numeric(df[comments_col]) if comments_col else 0

  df["follower_following_ratio"] = df["_followers"] / df["_following"].clip(lower=1)
  df["post_rate_per_day"] = df["_posts"] / df["_age_days"].clip(lower=1)
  df["bio_length"] = (
    df[bio_col].fillna("").astype(str).str.len() if bio_col else 0
  )
  df["engagement_rate"] = (
    (df["_likes_day"] + df["_comments_day"]) / df["_followers"].clip(lower=1)
  )
  df["account_activity_score"] = (
    0.3 * df["post_rate_per_day"]
    + 0.3 * df["engagement_rate"]
    + 0.2 * df["follower_following_ratio"]
    + 0.2 * df["_age_days"].clip(lower=1) ** 0.5
  )

  if pic_col:
    df["has_profile_pic"] = _safe_numeric(df[pic_col])
  else:
    df["has_profile_pic"] = 0

  return df


def behavioral_score(df: pd.DataFrame) -> pd.Series:
  # Weighted behavioral risk score (0-100).
  ratio = df["follower_following_ratio"].clip(upper=10)
  posting = df["post_rate_per_day"].clip(upper=5)
  engagement = df["engagement_rate"].clip(upper=1)

  score = (
    (posting * 25)
    + (engagement * 35)
    + (ratio / 10 * 20)
    + (df["has_profile_pic"] * 20)
  )
  return score.clip(lower=0, upper=100)


def build_graph(df: pd.DataFrame, label_col: Optional[str]) -> Tuple[Optional[nx.Graph], Dict]:
  # Build interaction graph if relational columns exist.
  source_col = _get_col(df, ["source_id", "source", "user_id"])
  target_col = _get_col(df, ["target_id", "target", "mentioned_user"])
  if target_col and label_col and target_col == label_col:
    target_col = None
  if not source_col or not target_col:
    return None, {}

  edges = df[[source_col, target_col]].dropna()
  graph = nx.Graph()
  graph.add_edges_from(edges.values.tolist())
  metrics = {
    "degree_centrality": nx.degree_centrality(graph),
    "clustering": nx.clustering(graph),
  }
  return graph, metrics


def detect_bot_rings(
  graph: Optional[nx.Graph], fake_probs: pd.Series
) -> Dict[str, bool]:
  # Flag coordinated clusters with high fake probability.
  if graph is None or graph.number_of_nodes() == 0:
    return {}

  communities = list(nx.algorithms.community.greedy_modularity_communities(graph))
  warning_map: Dict[str, bool] = {}

  for community in communities:
    if len(community) < 5:
      continue
    avg_prob = np.mean([fake_probs.get(node, 0) for node in community])
    if avg_prob >= 0.6:
      for node in community:
        warning_map[str(node)] = True

  return warning_map


def detect_botnet_attacks(
  graph: Optional[nx.Graph], df: pd.DataFrame, node_col: Optional[str]
) -> Dict[str, bool]:
  if graph is None or graph.number_of_nodes() == 0 or not node_col:
    return {}

  warnings: Dict[str, bool] = {}
  communities = list(nx.algorithms.community.greedy_modularity_communities(graph))

  for community in communities:
    if len(community) < 5:
      continue
    subset = df[df[node_col].astype(str).isin([str(n) for n in community])]
    if subset.empty:
      continue
    avg_burst = float(subset.get("burstiness", pd.Series([0])).mean())
    avg_night = float(subset.get("night_activity_ratio", pd.Series([0])).mean())
    avg_fake = float(subset.get("fake_probability", pd.Series([0])).mean())
    if avg_burst > 1.1 and avg_night > 0.3 and avg_fake > 0.6:
      for node in community:
        warnings[str(node)] = True

  return warnings


def model_scoring(df: pd.DataFrame) -> Tuple[pd.DataFrame, str, List[str], Optional[str]]:
  # Select supervised or unsupervised ML based on labels.
  label_col = _get_col(df, ["label", "is_fake", "target", "fake"])
  text_col = _get_col(df, ["bio", "about", "description", "text"])
  feature_cols = [
    "follower_following_ratio",
    "post_rate_per_day",
    "bio_length",
    "engagement_rate",
    "account_activity_score",
    "has_profile_pic",
  ]
  X = df[feature_cols].fillna(0)
  feature_names = feature_cols.copy()
  model_type = "IsolationForest"
  top_features = feature_cols

  if text_col and df[text_col].fillna("").astype(str).str.len().mean() > 4:
    text_series = df[text_col].fillna("").astype(str)
    nlp_features = compute_text_features(text_series)
    for col in nlp_features.columns:
      df[col] = nlp_features[col].values
      feature_names.append(col)

    vectorizer = TfidfVectorizer(max_features=300, ngram_range=(1, 2))
    tfidf = vectorizer.fit_transform(text_series)
    svd = TruncatedSVD(n_components=3, random_state=42)
    text_components = svd.fit_transform(tfidf)
    for idx in range(text_components.shape[1]):
      df[f"text_comp_{idx+1}"] = text_components[:, idx]
      feature_names.append(f"text_comp_{idx+1}")
    df["content_signal"] = (text_components**2).sum(axis=1) ** 0.5
    feature_names.append("content_signal")
    X = np.hstack([X.values, text_components, df["content_signal"].values.reshape(-1, 1)])

  if label_col:
    y_raw = df[label_col]
    y = y_raw.map(lambda x: 1 if str(x).lower() in ["1", "true", "fake"] else 0)
    model = RandomForestClassifier(
      n_estimators=200,
      random_state=42,
      class_weight="balanced",
    )
    model.fit(X, y)
    proba = model.predict_proba(X)[:, 1]
    df["fake_probability"] = proba
    df["is_fake"] = proba >= 0.5
    model_type = "RandomForestClassifier"
    importances = model.feature_importances_
    top_features = [
      feature
      for feature, _ in sorted(
        zip(feature_names, importances), key=lambda item: item[1], reverse=True
      )
    ]
  else:
    model = IsolationForest(
      n_estimators=200, random_state=42, contamination=0.2
    )
    model.fit(X)
    scores = -model.decision_function(X)
    scaler = MinMaxScaler()
    df["fake_probability"] = scaler.fit_transform(scores.reshape(-1, 1)).ravel()
    df["is_fake"] = df["fake_probability"] >= 0.6

  return df, model_type, top_features[:5], label_col


def build_reasons(row: pd.Series, top_features: List[str], medians: pd.Series) -> List[str]:
  # Lightweight explainability using feature deviations.
  reasons = []
  for feature in top_features:
    if feature.startswith("text_comp_"):
      continue
    value = row.get(feature, 0)
    median = medians.get(feature, 0)
    direction = "higher" if value >= median else "lower"
    label = feature.replace("_", " ")
    reasons.append(f"{label} is {direction} than baseline ({value:.2f}).")
  return reasons


def build_personalized_report(row: pd.Series) -> Dict:
  recommendations: List[str] = []
  fake_prob = float(row.get("fake_probability", 0) or 0)
  alert_score = int(row.get("alert_score", 0) or 0)
  has_pic = int(row.get("has_profile_pic", 0) or 0)
  bio_len = int(row.get("bio_length", 0) or 0)
  ratio = float(row.get("follower_following_ratio", 0) or 0)
  post_rate = float(row.get("post_rate_per_day", 0) or 0)

  if not has_pic:
    recommendations.append("add_profile_photo")
  if bio_len < 10:
    recommendations.append("expand_bio")
  if ratio < 0.2:
    recommendations.append("reduce_following")
  if post_rate > 5:
    recommendations.append("slow_posting")
  if fake_prob > 0.7:
    recommendations.append("enable_verification")
  if alert_score >= 2:
    recommendations.append("resolve_alerts")

  outlook = "rising" if (fake_prob > 0.6 or alert_score >= 2) else "stable"
  prediction = (
    "high_30d"
    if fake_prob > 0.75
    else "moderate_30d"
    if fake_prob > 0.5
    else "low_30d"
  )

  return {
    "risk_outlook": outlook,
    "prediction": prediction,
    "recommendations": recommendations[:4],
  }


def summarize(df: pd.DataFrame) -> Dict:
  # Aggregate statistics for dashboard.
  total = len(df)
  fake_count = int(df["is_fake"].sum())
  real_count = total - fake_count
  risk_levels = df["risk_level"].value_counts().to_dict()
  alert_counts = df["alerts"].explode().value_counts().to_dict()
  temporal_avg = {
    "burstiness": float(df.get("burstiness", pd.Series([0])).mean()),
    "night_activity_ratio": float(
      df.get("night_activity_ratio", pd.Series([0])).mean()
    ),
    "mean_gap_hours": float(df.get("mean_gap_hours", pd.Series([0])).mean()),
  }
  return {
    "total": total,
    "fake": fake_count,
    "real": real_count,
    "avg_fake_probability": float(df["fake_probability"].mean()),
    "avg_trust_score": float(df["trust_score"].mean()),
    "risk_levels": {
      "low": int(risk_levels.get("LOW", 0)),
      "medium": int(risk_levels.get("MEDIUM", 0)),
      "high": int(risk_levels.get("HIGH", 0)),
    },
    "bot_ring_count": int(df["bot_ring_warning"].sum()),
    "botnet_attack_count": int(df.get("botnet_attack_warning", pd.Series([0])).sum()),
    "simulated_attack_count": int(df.get("simulated_attack", pd.Series([0])).sum()),
    "alert_count": int(df["alert_score"].sum()),
    "alert_top": [
      {"name": key, "count": int(value)}
      for key, value in list(alert_counts.items())[:5]
    ],
    "temporal_stats": temporal_avg,
    "behavior_stats": {
      "min": float(df["behavioral_score"].min()),
      "max": float(df["behavioral_score"].max()),
      "avg": float(df["behavioral_score"].mean()),
    },
  }


def analyze_dataframe(df: pd.DataFrame, file_name: str) -> Tuple[List[Dict], Dict]:
  if not _get_col(df, ["user_id", "username"]):
    df["user_id"] = df.index.astype(str)

  user_col = _get_col(df, ["user_id", "username"])
  time_col = find_timestamp_column(df)
  temporal_features = pd.DataFrame()

  if user_col and time_col:
    temporal_features = compute_temporal_features(df, user_col, time_col)
    if df[user_col].duplicated().any():
      df = df.groupby(user_col, as_index=False).first()
    if not temporal_features.empty:
      df = df.merge(temporal_features, on=user_col, how="left")

  df = feature_engineering(df)
  df["behavioral_score"] = behavioral_score(df)
  df, model_type, top_features, label_col = model_scoring(df)

  df["risk_level"] = pd.cut(
    df["fake_probability"],
    bins=[-0.01, 0.4, 0.7, 1.0],
    labels=["LOW", "MEDIUM", "HIGH"],
  ).astype(str)
  df["trust_score"] = (1 - df["fake_probability"]) * 100

  graph, metrics = build_graph(df, label_col)
  node_col = _get_col(df, ["user_id", "username"])
  if node_col:
    prob_map = df.set_index(node_col)["fake_probability"]
  else:
    prob_map = df.set_index(df.index)["fake_probability"]
  bot_map = detect_bot_rings(graph, prob_map)
  df["bot_ring_warning"] = False
  if bot_map:
    if node_col:
      df.loc[df[node_col].astype(str).isin(bot_map.keys()), "bot_ring_warning"] = True

  botnet_map = detect_botnet_attacks(graph, df, node_col)
  df["botnet_attack_warning"] = False
  if botnet_map and node_col:
    df.loc[df[node_col].astype(str).isin(botnet_map.keys()), "botnet_attack_warning"] = True

  df, simulation_summary = simulate_attack_signals(df)

  df["alerts"] = df.apply(build_alerts, axis=1)
  df["alert_score"] = df["alerts"].apply(len)
  df["personalized_report"] = df.apply(build_personalized_report, axis=1)

  medians = df.median(numeric_only=True)
  reasons = [
    build_reasons(row, top_features, medians) for _, row in df.iterrows()
  ]
  df["reasons"] = reasons

  if metrics:
    degree_map = metrics.get("degree_centrality", {})
    clustering_map = metrics.get("clustering", {})
    node_col = _get_col(df, ["user_id", "username"])
    if node_col:
      df["degree_centrality"] = df[node_col].astype(str).map(degree_map).fillna(0)
      df["clustering_coeff"] = df[node_col].astype(str).map(clustering_map).fillna(0)

  results = df.to_dict(orient="records")
  summary = summarize(df)
  summary["simulation"] = simulation_summary
  meta = {
    "file_name": file_name,
    "model_type": model_type,
    "analyzed_at": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
  }
  return results, {"summary": summary, "analysis_meta": meta}


def analyze_instagram_username(username: str) -> Dict:
  query = str(username).strip().lstrip("@").lower()
  client = _get_ig_client()
  profile = None
  live_profile_error: Optional[str] = None
  if client is not None:
    try:
      profile = client.user_info_by_username(query)
    except Exception as exc:
      live_profile_error = str(exc)

  if profile is None:
    public_fallback = _fetch_public_profile_fallback(query)
    reason = live_profile_error or IG_CLIENT_LAST_ERROR
    text_features = compute_text_features(pd.Series([query]))
    suspicious = int(text_features.loc[0, "suspicious_keyword_score"])
    sentiment = float(text_features.loc[0, "sentiment_score"])
    u = query.lower()
    letters = [c for c in u if c.isalpha()]
    vowels = [c for c in letters if c in "aeiou"]
    length = len(letters)
    vowel_ratio = len(vowels) / max(length, 1)
    unique_ratio = len(set(letters)) / max(length, 1)
    separator_count = sum(1 for c in u if c in "._-")
    digit_count = sum(1 for c in u if c.isdigit())
    digit_ratio = digit_count / max(len(u), 1)
    fake_prob = 0.12
    fake_prob += min(0.45, 0.18 * max(suspicious, 0))
    keyword_boost = any(
      kw in u
      for kw in [
        "free",
        "follow",
        "follower",
        "like",
        "likes",
        "bot",
        "panel",
        "fx",
        "cash",
        "gift",
        "promo",
        "crypto",
        "signal",
        "boost",
        "shop",
        "panel",
        "service",
      ]
    )
    if keyword_boost:
      fake_prob += 0.22
    if any(c.isdigit() for c in u) and any(c.isalpha() for c in u):
      fake_prob += 0.08
    if len(u) <= 4:
      fake_prob += 0.14
    elif len(u) <= 6:
      fake_prob += 0.06
    if any(u.count(ch) >= 3 for ch in set(u)):
      fake_prob += 0.08
    if length >= 5 and length <= 12 and vowel_ratio < 0.3 and not keyword_boost:
      fake_prob += 0.1
    if "__" in u or ".." in u:
      fake_prob += 0.12
    if digit_count >= 2 and any(c.isdigit() for c in u[-3:]):
      fake_prob += 0.12
    if digit_ratio > 0.35:
      fake_prob += 0.1
    if separator_count > 2:
      fake_prob += 0.08

    # Human-like usernames are usually lower risk.
    if (
      length >= 8
      and length <= 14
      and not any(ch in u for ch in "._-")
      and not any(c.isdigit() for c in u)
      and 0.22 < vowel_ratio < 0.62
      and unique_ratio > 0.55
    ):
      fake_prob -= 0.18
    if suspicious == 0 and not keyword_boost:
      fake_prob -= 0.05
    if sentiment < -1:
      fake_prob += 0.06

    feedback_label = INSTAGRAM_FEEDBACK.get(query.lower())
    if feedback_label == "fake":
      fake_prob = max(fake_prob, 0.95)
    elif feedback_label == "real":
      fake_prob = min(fake_prob, 0.2)
    fake_prob = float(max(0.0, min(fake_prob, 0.98)))
    trust_score = (1 - fake_prob) * 100
    is_fake = fake_prob >= 0.5
    if fake_prob > 0.7:
      risk_level = "HIGH"
    elif fake_prob > 0.4:
      risk_level = "MEDIUM"
    else:
      risk_level = "LOW"
    pf_followers = public_fallback.get("followers") if public_fallback else None
    pf_following = public_fallback.get("following") if public_fallback else None
    pf_posts = public_fallback.get("posts") if public_fallback else None
    if (
      pf_followers is not None
      and pf_following is not None
      and pf_following > 0
      and pf_posts is not None
    ):
      ratio = pf_followers / max(pf_following, 1)
      if pf_followers < 80 and pf_following > 1200:
        fake_prob = min(0.98, fake_prob + 0.2)
      if ratio < 0.15:
        fake_prob = min(0.98, fake_prob + 0.1)
      if pf_posts <= 2 and pf_followers > 1000:
        fake_prob = min(0.98, fake_prob + 0.1)
      trust_score = (1 - fake_prob) * 100
      is_fake = fake_prob >= 0.5

    result = {
      "username": query,
      "fake_probability": fake_prob,
      "trust_score": trust_score,
      "is_fake": is_fake,
      "risk_level": risk_level,
      "behavioral_score": 0.0,
      "alert_score": 0,
      "alerts": [],
      "bot_ring_warning": False,
      "botnet_attack_warning": False,
      "simulated_attack": False,
      "sentiment_score": sentiment,
      "suspicious_keyword_score": suspicious,
      "followers": pf_followers,
      "following": pf_following,
      "posts": pf_posts,
      "account_age_days": None,
      "account_created_year": None,
      "avg_likes_recent": None,
      "avg_comments_recent": None,
      "engagement_rate_estimate": None,
      "has_profile_pic": None,
      "is_private": None,
      "is_verified": None,
      "full_name": (public_fallback.get("full_name") if public_fallback else ""),
      "live_profile_data": bool(public_fallback),
      "live_profile_message": (
        "Partial public profile data is shown (fallback mode)." if public_fallback else
        "Live Instagram profile data is unavailable. Configure IG credentials or try again later."
        if not reason
        else f"Live profile data unavailable: {_compact_ig_error(reason)}"
      ),
      "feedback_label": feedback_label,
      "personalized_report": {
        "risk_outlook": "rising" if fake_prob > 0.6 else "stable",
        "prediction": "high_30d"
        if fake_prob > 0.75
        else "moderate_30d"
        if fake_prob > 0.5
        else "low_30d",
        "recommendations": [],
      },
      "reasons": [],
    }
    meta = {
      "summary": {},
      "analysis_meta": {
        "file_name": "instagram_live_username_only",
        "model_type": "heuristic_username",
        "analyzed_at": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
      },
    }
    return {"result": result, **meta}

  followers = int(getattr(profile, "follower_count", 0) or 0)
  following = int(getattr(profile, "following_count", 0) or 1)
  posts = int(getattr(profile, "media_count", 0) or 0)
  bio = str(getattr(profile, "biography", "") or "")
  full_name = str(getattr(profile, "full_name", "") or "")
  is_private = bool(getattr(profile, "is_private", False))
  is_verified = bool(getattr(profile, "is_verified", False))
  has_pic = 1 if getattr(profile, "profile_pic_url", None) else 0
  created_at = getattr(profile, "date_joined", None)
  account_created_year = None
  if created_at and isinstance(created_at, dt.datetime):
    age_days = max((dt.datetime.utcnow() - created_at).days, 1)
    account_created_year = int(created_at.year)
  else:
    age_days = 365

  avg_likes_recent = None
  avg_comments_recent = None
  try:
    profile_pk = getattr(profile, "pk", None) or getattr(profile, "id", None)
    if profile_pk:
      medias = client.user_medias(profile_pk, amount=12) or []
      if medias:
        likes = [int(getattr(m, "like_count", 0) or 0) for m in medias]
        comments = [int(getattr(m, "comment_count", 0) or 0) for m in medias]
        avg_likes_recent = float(np.mean(likes)) if likes else None
        avg_comments_recent = float(np.mean(comments)) if comments else None
  except Exception:
    avg_likes_recent = None
    avg_comments_recent = None

  row = {
    "username": query,
    "followers": followers,
    "following": following,
    "posts": posts,
    "account_age_days": age_days,
    "bio": bio,
    "has_profile_pic": has_pic,
    "likes_per_day": avg_likes_recent or 0,
    "comments_per_day": avg_comments_recent or 0,
  }
  df = pd.DataFrame([row])
  results, meta = analyze_dataframe(df, "instagram_live.csv")
  base = results[0]

  ratio = followers / max(following, 1)
  post_rate = posts / max(age_days, 1)
  profile_risk = 0.0
  if followers < 50 and following > 1000:
    profile_risk += 0.5
  if followers < 200 and following > 2000:
    profile_risk += 0.4
  if followers > 5000 and ratio < 0.2:
    profile_risk += 0.4
  if age_days < 90 and followers > 1000:
    profile_risk += 0.3
  if posts < 5 and followers > 1000:
    profile_risk += 0.3
  if posts > 1000 and followers < 100:
    profile_risk += 0.3
  profile_risk = min(profile_risk, 1.0)

  text_source = f"{query} {bio}"
  text_features = compute_text_features(pd.Series([text_source]))
  text_suspicious = int(text_features.loc[0, "suspicious_keyword_score"])
  text_sentiment = float(text_features.loc[0, "sentiment_score"])
  text_risk = 0.0
  if text_suspicious >= 1:
    text_risk += 0.3
  if text_suspicious >= 3:
    text_risk += 0.3
  if text_sentiment < -1:
    text_risk += 0.1
  text_risk = min(text_risk, 1.0)

  base_prob = float(base.get("fake_probability", 0) or 0)
  # Weighted fusion is more stable than max(), which over-penalizes on one noisy signal.
  combined_prob = (0.55 * base_prob) + (0.30 * profile_risk) + (0.15 * text_risk)
  if profile_risk > 0.8 and text_risk > 0.5:
    combined_prob = max(combined_prob, 0.8)
  if text_suspicious >= 3 and profile_risk >= 0.4:
    combined_prob += 0.08
  if has_pic and posts >= 5 and age_days > 180 and 0.2 <= ratio <= 5:
    combined_prob -= 0.08
  if followers >= 300 and 0.5 <= ratio <= 3 and text_suspicious == 0:
    combined_prob -= 0.05
  feedback_label = INSTAGRAM_FEEDBACK.get(query.lower())
  if feedback_label == "fake":
    combined_prob = max(combined_prob, 0.95)
  elif feedback_label == "real":
    combined_prob = min(combined_prob, 0.2)

  combined_prob = float(max(0.0, min(combined_prob, 0.98)))
  base["fake_probability"] = combined_prob
  base["trust_score"] = (1 - combined_prob) * 100
  base["is_fake"] = combined_prob >= 0.5
  base["risk_level"] = (
    "HIGH" if combined_prob > 0.7 else "MEDIUM" if combined_prob > 0.4 else "LOW"
  )
  base["sentiment_score"] = text_sentiment
  base["suspicious_keyword_score"] = text_suspicious
  base["feedback_label"] = feedback_label
  base["followers"] = followers
  base["following"] = following
  base["posts"] = posts
  base["account_age_days"] = age_days
  base["account_created_year"] = account_created_year
  base["avg_likes_recent"] = avg_likes_recent
  base["avg_comments_recent"] = avg_comments_recent
  base["engagement_rate_estimate"] = (
    ((avg_likes_recent or 0) + (avg_comments_recent or 0)) / max(followers, 1)
  )
  base["has_profile_pic"] = has_pic
  base["is_private"] = is_private
  base["is_verified"] = is_verified
  base["full_name"] = full_name
  base["live_profile_data"] = True
  base["live_profile_message"] = ""

  return {"result": base, **meta}


@app.route("/instagram/feedback", methods=["POST"])
def instagram_feedback():
  payload = request.get_json(silent=True) or {}
  username = str(payload.get("username", "")).strip()
  label = str(payload.get("label", "")).strip().lower()
  if not username or label not in ["fake", "real"]:
    return jsonify({"error": "Invalid feedback."}), 400
  key = username.lstrip("@").lower()
  INSTAGRAM_FEEDBACK[key] = label
  try:
    INSTAGRAM_FEEDBACK_PATH.write_text(
      json.dumps(INSTAGRAM_FEEDBACK, ensure_ascii=False, indent=2),
      encoding="utf-8",
    )
  except Exception:
    pass
  _log_activity("instagram_feedback", {"username": key, "label": label})
  return jsonify({"status": "ok", "username": key, "label": label})


@app.route("/instagram/batch", methods=["POST"])
def instagram_batch():
  payload = request.get_json(silent=True) or {}
  raw = payload.get("usernames") or []
  if isinstance(raw, str):
    parts = [p.strip() for p in raw.replace(",", "\n").splitlines()]
    usernames = [p for p in parts if p]
  else:
    usernames = [str(u).strip() for u in raw if str(u).strip()]
  if not usernames:
    return jsonify({"error": "Usernames are required."}), 400

  results: List[Dict] = []
  for name in usernames[:50]:
    query = str(name).strip()
    try:
      analysis = analyze_instagram_username(query)
      data = analysis.get("result") or {}
      data["username_input"] = query
      results.append(data)
    except Exception as exc:
      results.append(
        {
          "username_input": query,
          "error": str(exc),
        }
      )
  _log_activity("instagram_batch", {"count": len(results)})
  return jsonify({"results": results})


@app.route("/upload_csv", methods=["POST"])
def upload_csv():
  global LATEST_RESULTS, LATEST_SUMMARY, LATEST_DF, LAST_UPLOAD_AT

  file = (
    request.files.get("file")
    or request.files.get("csv")
    or request.files.get("dataset")
  )
  if not file:
    raw_body = request.get_data()
    if raw_body:
      content = io.BytesIO(raw_body)
      file_name = "uploaded.csv"
    else:
      return jsonify({"error": "CSV file is required."}), 400
  else:
    if not file.filename:
      return jsonify({"error": "Invalid file."}), 400
    content = io.BytesIO(file.read())
    file_name = file.filename

  if content.getbuffer().nbytes == 0:
    return jsonify({"error": "Empty file."}), 400

  try:
    df = _read_csv(content)
    results, meta = analyze_dataframe(df, file_name)
  except Exception as exc:
    return jsonify({"error": f"CSV parse failed: {exc}"}), 400
  LATEST_RESULTS = results
  LATEST_SUMMARY = meta
  LATEST_DF = df
  LAST_UPLOAD_AT = meta["analysis_meta"]["analyzed_at"]
  _log_activity("upload_csv", {"file": file_name, "rows": len(results)})
  return jsonify({"results": results, **meta})


@app.route("/analyze", methods=["POST"])
def analyze_user():
  payload = request.get_json(silent=True) or {}
  username = payload.get("username")
  if not username:
    return jsonify({"error": "Username is required."}), 400

  query = str(username).strip().lstrip("@").lower()
  try:
    result = analyze_instagram_username(query)
    _log_activity("analyze_instagram", {"username": query})
    return jsonify(result)
  except Exception as exc:
    return jsonify({"error": f"Instagram analysis failed: {exc}"}), 502


@app.route("/results", methods=["GET"])
def get_results():
  return jsonify({"results": LATEST_RESULTS, **(LATEST_SUMMARY or {})})


@app.route("/reports", methods=["GET"])
def reports():
  if not LATEST_RESULTS:
    return jsonify({"summary": {}, "alerts": [], "top_risky": []})

  top_risky = sorted(
    LATEST_RESULTS, key=lambda r: r.get("fake_probability", 0), reverse=True
  )[:10]
  alert_counts: Dict[str, int] = {}
  for item in LATEST_RESULTS:
    for alert in item.get("alerts", []):
      alert_counts[alert] = alert_counts.get(alert, 0) + 1

  alert_list = [
    {"name": key, "count": value}
    for key, value in sorted(alert_counts.items(), key=lambda i: i[1], reverse=True)
  ][:8]

  return jsonify(
    {
      "summary": (LATEST_SUMMARY or {}).get("summary", {}),
      "alerts": alert_list,
      "top_risky": [
        {
          "user": item.get("username") or item.get("user_id"),
          "fake_probability": item.get("fake_probability", 0),
          "risk_level": item.get("risk_level", "LOW"),
          "alert_score": item.get("alert_score", 0),
        }
        for item in top_risky
      ],
      "botnet_attack_count": int(
        sum(1 for item in LATEST_RESULTS if item.get("botnet_attack_warning"))
      ),
      "simulated_attack_count": int(
        sum(1 for item in LATEST_RESULTS if item.get("simulated_attack"))
      ),
    }
  )


@app.route("/demo", methods=["GET"])
def load_demo():
  global LATEST_RESULTS, LATEST_SUMMARY, LATEST_DF, LAST_UPLOAD_AT
  demo_root = Path(__file__).resolve().parents[1] / "data"
  demo_path = demo_root / "synthetic_accounts_large.csv"
  if not demo_path.exists():
    demo_path = demo_root / "real_accounts.csv"
  if not demo_path.exists():
    demo_path = demo_root / "synthetic_accounts_time.csv"
  if not demo_path.exists():
    demo_path = demo_root / "synthetic_accounts.csv"
  if not demo_path.exists():
    return jsonify({"error": "Demo dataset not found."}), 404
  df = pd.read_csv(demo_path)
  results, meta = analyze_dataframe(df, demo_path.name)
  LATEST_RESULTS = results
  LATEST_SUMMARY = meta
  LATEST_DF = df
  LAST_UPLOAD_AT = meta["analysis_meta"]["analyzed_at"]
  _log_activity("load_demo", {"file": demo_path.name, "rows": len(results)})
  return jsonify({"results": results, **meta})


@app.route("/admin/summary", methods=["GET"])
def admin_summary():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401

  if not LATEST_RESULTS:
    return jsonify(
      {
        "summary": {},
        "analysis_meta": {},
        "last_upload_at": LAST_UPLOAD_AT,
        "activity": ACTIVITY_LOG[:50],
        "top_risky": [],
      }
    )

  top_risky = sorted(
    LATEST_RESULTS, key=lambda r: r.get("fake_probability", 0), reverse=True
  )[:10]
  return jsonify(
    {
      "summary": (LATEST_SUMMARY or {}).get("summary", {}),
      "analysis_meta": (LATEST_SUMMARY or {}).get("analysis_meta", {}),
      "last_upload_at": LAST_UPLOAD_AT,
      "activity": ACTIVITY_LOG[:50],
      "top_risky": [
        {
          "user": item.get("username") or item.get("user_id"),
          "fake_probability": item.get("fake_probability", 0),
          "risk_level": item.get("risk_level", "LOW"),
        }
        for item in top_risky
      ],
    }
  )


def _hunter_of_day_for_user(user_id: str) -> Optional[Dict]:
  today_key = dt.datetime.utcnow().date().isoformat()
  hotd = REWARD_DATA.get("hunter_of_day") or {}
  hot_uid = hotd.get(today_key)
  if not hot_uid:
    return None
  users = REWARD_DATA.get("users", {})
  u = users.get(str(hot_uid)) or {}
  return {
    "user_id": hot_uid,
    "display_name": u.get("display_name") or "Hunter",
    "is_me": str(hot_uid) == str(user_id),
  }


def _reward_dashboard_payload(user_id: str) -> Dict:
  user_reward = _ensure_reward_user(user_id)
  _ensure_reward_data_loaded()
  uid = str(user_reward.get("id") or "")
  claims_raw = [
    c for c in REWARD_DATA.get("claims", {}).values()
    if str(c.get("user_id")) == uid
  ]
  withdrawals_raw = [
    w for w in REWARD_DATA.get("withdrawals", {}).values()
    if str(w.get("user_id")) == uid
  ]
  approved_claims = [c for c in claims_raw if str(c.get("status")) == "approved"]
  pending_claims = [c for c in claims_raw if str(c.get("status")) == "pending"]
  gm = _compute_gamification(claims_raw, withdrawals_raw, uid)
  challenge = _compute_weekly_challenge(claims_raw)
  verification = _compute_verification_quest(claims_raw, float(gm.get("trust_score") or 0.0))
  user_reward["fast_lane_reviewer"] = bool(verification.get("fast_lane"))
  badges = user_reward.get("special_badges")
  if not isinstance(badges, list):
    badges = []
  if challenge.get("done") and challenge.get("badge") and challenge.get("badge") not in badges:
    badges.append(challenge.get("badge"))
  user_reward["special_badges"] = badges[-20:]
  lifetime_earned = int(gm.get("lifetime_earned_usd") or 0)
  withdrawn = int(gm.get("withdrawn_usd") or 0)
  available = int(gm.get("available_usd") or 0)
  # Keep counters consistent even if previous writes were interrupted.
  user_reward["approved_claims"] = len(approved_claims)
  user_reward["pending_claims"] = len(pending_claims)
  user_reward["lifetime_earned_usd"] = lifetime_earned
  user_reward["withdrawn_usd"] = withdrawn
  user_reward["available_usd"] = available
  user_reward["updated_at"] = _now_iso()
  user_reward.setdefault("referral_code", uuid.uuid4().hex[:8].upper())
  user_reward.setdefault("title", "")
  _save_reward_data()
  claims = [
    _claim_to_public(c)
    for c in claims_raw
  ]
  withdrawals = [
    _withdrawal_to_public(w)
    for w in withdrawals_raw
  ]
  claims.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
  withdrawals.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
  timeline_items: List[Dict] = []
  for c in claims_raw:
    timeline_items.append(
      {
        "time": c.get("created_at"),
        "type": "claim_submitted",
        "title": f"Report submitted @{c.get('suspect_username')}",
        "status": "submitted",
      }
    )
    timeline_items.append(
      {
        "time": c.get("created_at"),
        "type": "claim_pending",
        "title": "Report queued for admin review",
        "status": "pending",
      }
    )
    if c.get("reviewed_at"):
      if str(c.get("status")) == "approved":
        timeline_items.append(
          {
            "time": c.get("reviewed_at"),
            "type": "claim_approved",
            "title": "Admin approved your report",
            "status": "approved",
          }
        )
        timeline_items.append(
          {
            "time": c.get("reviewed_at"),
            "type": "reward_added",
            "title": f"Reward added +${int(c.get('reward_usd') or 0)}",
            "status": "approved",
          }
        )
      else:
        timeline_items.append(
          {
            "time": c.get("reviewed_at"),
            "type": "claim_rejected",
            "title": "Admin rejected your report",
            "status": "rejected",
          }
        )
  for w in withdrawals_raw:
    timeline_items.append(
      {
        "time": w.get("created_at"),
        "type": "withdraw_requested",
        "title": f"Withdraw requested ${int(w.get('amount_usd') or 0)}",
        "status": w.get("status"),
      }
    )
    if w.get("reviewed_at"):
      timeline_items.append(
        {
          "time": w.get("reviewed_at"),
          "type": "withdraw_completed" if str(w.get("status")) == "paid" else "withdraw_rejected",
          "title": "Withdraw paid" if str(w.get("status")) == "paid" else "Withdraw rejected",
          "status": w.get("status"),
        }
      )
  timeline_items.sort(key=lambda x: str(x.get("time") or ""), reverse=True)
  all_claims = list(REWARD_DATA.get("claims", {}).values())
  heatmap = _compute_heatmap(all_claims)
  latest_claim = claims[0] if claims else {}
  radar = latest_claim.get("risk_radar") if isinstance(latest_claim.get("risk_radar"), dict) else {}
  clans_raw = list(REWARD_DATA.get("clans", {}).values())
  clans_public = [_clan_public(c, all_claims) for c in clans_raw]
  clans_public.sort(key=lambda x: (int(x.get("weekly_points") or 0), int(x.get("total_points") or 0)), reverse=True)
  current_clan = {}
  cid = str(user_reward.get("clan_id") or "")
  if cid:
    clan_raw = REWARD_DATA.get("clans", {}).get(cid)
    for row in clans_public:
      if str(row.get("id")) == cid:
        current_clan = dict(row)
        current_clan["is_owner"] = str(clan_raw.get("owner_user_id") or "") == uid if clan_raw else False
        current_clan["is_private"] = bool(clan_raw.get("is_private")) if clan_raw else False
        requests_raw = clan_raw.get("join_requests") or [] if clan_raw else []
        if not isinstance(requests_raw, list):
          requests_raw = []
        users_map = REWARD_DATA.get("users", {})
        current_clan["join_requests"] = [
          {"user_id": r.get("user_id"), "display_name": r.get("display_name") or "User", "requested_at": r.get("requested_at")}
          for r in requests_raw if isinstance(r, dict) and r.get("user_id")
        ]
        members_raw = [str(m) for m in (clan_raw.get("members") or []) if str(m)] if clan_raw else []
        current_clan["members"] = [
          {"id": mid, "display_name": (users_map.get(mid) or {}).get("display_name") or f"User {mid[:8]}"}
          for mid in members_raw
        ]
        break
  season = _season_payload(uid)
  today = dt.datetime.utcnow().date()
  approved_today = [c for c in approved_claims if _to_date(c.get("reviewed_at")) == today]
  first_report_done_today = len(approved_today) >= 1
  daily_challenge = {
    "target": 3,
    "progress": len(approved_today),
    "bonus_pct": DAILY_CHALLENGE_BONUS_PCT,
    "done": len(approved_today) >= 3,
    "first_report_done_today": first_report_done_today,
  }
  week_start = today - dt.timedelta(days=6)
  month_start = today - dt.timedelta(days=29)
  weekly_approved_count = len([c for c in approved_claims if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start])
  monthly_approved_count = len([c for c in approved_claims if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= month_start])
  weekly_earned = sum(int(c.get("reward_usd") or 0) for c in approved_claims if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start)
  monthly_earned = sum(int(c.get("reward_usd") or 0) for c in approved_claims if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= month_start)
  progress_chart = {"labels": [], "values": []}
  for i in range(30, -1, -1):
    d = today - dt.timedelta(days=i)
    day_earn = sum(int(c.get("reward_usd") or 0) for c in approved_claims if _to_day(c.get("reviewed_at") or c.get("created_at")) == d)
    progress_chart["labels"].append(d.isoformat())
    progress_chart["values"].append(day_earn)
  goal_weekly = int(user_reward.get("goal_weekly_reports") or 0)
  goal_monthly = int(user_reward.get("goal_monthly_reports") or 0)
  goal_weekly_usd = int(user_reward.get("goal_weekly_usd") or 0)
  goal_monthly_usd = int(user_reward.get("goal_monthly_usd") or 0)
  personal_goals = {
    "weekly_reports": {"target": goal_weekly, "progress": weekly_approved_count, "done": weekly_approved_count >= goal_weekly if goal_weekly else False},
    "monthly_reports": {"target": goal_monthly, "progress": monthly_approved_count, "done": monthly_approved_count >= goal_monthly if goal_monthly else False},
    "weekly_usd": {"target": goal_weekly_usd, "progress": weekly_earned, "done": weekly_earned >= goal_weekly_usd if goal_weekly_usd else False},
    "monthly_usd": {"target": goal_monthly_usd, "progress": monthly_earned, "done": monthly_earned >= goal_monthly_usd if goal_monthly_usd else False},
  }
  lucky_day_today = _is_lucky_day()
  clan_rival = None
  clan_match = None
  if cid and clans_public:
    idx = next((i for i, r in enumerate(clans_public) if str(r.get("id")) == cid), -1)
    if idx >= 1:
      clan_rival = clans_public[idx - 1]
    week_key = _week_key(today)
    clan_matches = REWARD_DATA.get("clan_matches") or {}
    clan_match = clan_matches.get(week_key) or clan_matches.get(str(cid))
  return {
    "user_reward": user_reward,
    "report_reward_usd": REPORT_REWARD_USD,
    "min_withdraw_usd": MIN_WITHDRAW_USD,
    "claims": claims[:100],
    "withdrawals": withdrawals[:100],
    "gamification": {
      "xp": gm.get("xp", 0),
      "level": gm.get("level", 1),
      "badge": gm.get("badge", "Rookie"),
      "league": gm.get("league", "bronze"),
      "trust_score": gm.get("trust_score", 0.0),
      "quality_score": gm.get("quality_score", 0),
      "verified": gm.get("verified", False),
      "reviewed_total": gm.get("reviewed_total", 0),
      "streak_days": gm.get("streak_days", 0),
      "streak_freeze_used": gm.get("streak_freeze_used", 0),
      "streak_freeze_remaining": gm.get("streak_freeze_remaining", 0),
      "weekly_approved": gm.get("weekly_approved", 0),
      "missions": gm.get("missions", []),
      "verification_quest": verification,
      "special_badges": user_reward.get("special_badges", []),
    },
    "weekly_challenge": challenge,
    "daily_challenge": daily_challenge,
    "active_events": REWARD_DATA.get("active_events") or {},
    "gamification_config": REWARD_DATA.get("gamification_config") or {},
    "hunter_of_day": _hunter_of_day_for_user(uid),
    "clan_rival": clan_rival,
    "clan_match": clan_match,
    "heatmap": heatmap,
    "risk_radar": radar,
    "clans": {
      "current": current_clan,
      "leaderboard": clans_public[:20],
    },
    "season": season,
    "timeline": timeline_items[:120],
    "progress_chart": progress_chart,
    "personal_goals": personal_goals,
    "lucky_day_today": lucky_day_today,
    "annual_hall_of_fame": list(REWARD_DATA.get("annual_hall_of_fame", []))[:20],
    "flash_challenges": REWARD_DATA.get("gamification_config", {}).get("flash_challenges") or [],
    "hidden_missions": REWARD_DATA.get("gamification_config", {}).get("hidden_missions") or [],
    "duels": _duels_for_user(uid),
    "predictions": _predictions_for_user(uid),
    "reactions": _reactions_for_user(uid),
    "daily_random_challenge": _daily_random_challenge(claims_raw, uid),
    "story_quests": _story_quests(claims_raw, uid),
    "hidden_achievements": _hidden_achievements(claims_raw, uid, user_reward),
    "week_comparison": _week_comparison(claims_raw, uid),
    "ai_prediction": _ai_prediction(uid, claims_raw, weekly_earned),
  }


@app.route("/auth/register", methods=["POST"])
def auth_register():
  payload = request.get_json(silent=True) or {}
  username = str(payload.get("username") or "")
  password = str(payload.get("password") or "")
  display_name = str(payload.get("display_name") or "")
  email = str(payload.get("email") or "")
  referral_code = str(payload.get("referral_code") or "").strip().upper()
  try:
    user = _create_user(username, password, display_name, email)
    reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
    reward_user.setdefault("referral_code", uuid.uuid4().hex[:8].upper())
    reward_user.setdefault("referred_by", "")
    reward_user.setdefault("title", "")
    if referral_code:
      referrer = next(
        (u for u in REWARD_DATA.get("users", {}).values()
         if str(u.get("referral_code") or "").upper() == referral_code and str(u.get("id")) != str(reward_user.get("id"))),
        None
      )
      if referrer:
        reward_user["referred_by"] = str(referrer.get("id") or "")
        referrer["available_usd"] = int(referrer.get("available_usd") or 0) + REFERRAL_BONUS_USD
        referrer["lifetime_earned_usd"] = int(referrer.get("lifetime_earned_usd") or 0) + REFERRAL_BONUS_USD
        reward_user["available_usd"] = int(reward_user.get("available_usd") or 0) + REFERRAL_BONUS_USD
        reward_user["lifetime_earned_usd"] = int(reward_user.get("lifetime_earned_usd") or 0) + REFERRAL_BONUS_USD
        _reward_add_event(referrer.get("id"), "referral_bonus", f"Referral bonus +${REFERRAL_BONUS_USD}", {"referred_user": reward_user.get("id")})
        _reward_add_event(reward_user.get("id"), "referral_bonus", f"Welcome bonus +${REFERRAL_BONUS_USD}", {"referred_by": referrer.get("id")})
    _save_reward_data()
    token = _create_user_session(str(user.get("id") or ""))
    return jsonify({"ok": True, "token": token, "user": _public_user(user)})
  except ValueError as exc:
    return jsonify({"error": str(exc)}), 400
  except Exception:
    return jsonify({"error": "Could not create account."}), 500


@app.route("/auth/login", methods=["POST"])
def auth_login():
  payload = request.get_json(silent=True) or {}
  username = str(payload.get("username") or "")
  password = str(payload.get("password") or "")
  user = _find_user_by_username(username)
  if not user:
    return jsonify({"error": "Invalid username or password."}), 401
  check_hash = _hash_password(password, str(user.get("password_salt") or ""))
  if not hmac.compare_digest(check_hash, str(user.get("password_hash") or "")):
    return jsonify({"error": "Invalid username or password."}), 401
  user["last_login_at"] = _now_iso()
  _save_users_data()
  token = _create_user_session(str(user.get("id") or ""))
  _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  return jsonify({"ok": True, "token": token, "user": _public_user(user)})


@app.route("/auth/me", methods=["GET"])
def auth_me():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  return jsonify({"user": _public_user(user)})


@app.route("/auth/logout", methods=["POST"])
def auth_logout():
  _ensure_users_data_loaded()
  token = _extract_user_token(request)
  if token:
    USERS_DATA.setdefault("sessions", {}).pop(token, None)
    _save_users_data()
  return jsonify({"ok": True})


@app.route("/auth/forgot-password", methods=["POST"])
def auth_forgot_password():
  payload = request.get_json(silent=True) or {}
  email = str(payload.get("email") or "").strip()
  if not _is_valid_email(email):
    return jsonify({"error": "Valid email is required."}), 400
  user = _find_user_by_email(email)
  # Do not leak whether account exists.
  if not user:
    return jsonify({"ok": True, "message": "If account exists, reset email was sent."})
  token = _create_reset_token(str(user.get("id") or ""))
  sent, err = _send_password_reset_email(str(user.get("email") or ""), token)
  if not sent:
    # Dev-friendly fallback: provide link when SMTP is not configured.
    if "SMTP is not configured" in str(err):
      reset_link = f"{FRONTEND_BASE_URL}/user/reset-password?token={token}"
      return jsonify(
        {
          "ok": True,
          "message": "SMTP is not configured. Use the reset link below.",
          "reset_link": reset_link,
        }
      )
    return jsonify({"error": f"Could not send reset email: {err}"}), 500
  return jsonify({"ok": True, "message": "Reset email sent."})


@app.route("/auth/reset-password", methods=["POST"])
def auth_reset_password():
  payload = request.get_json(silent=True) or {}
  token = str(payload.get("token") or "").strip()
  new_password = str(payload.get("new_password") or "")
  if len(new_password) < 6:
    return jsonify({"error": "Password must be at least 6 chars."}), 400
  if not token:
    return jsonify({"error": "token is required."}), 400
  token_data = _consume_reset_token(token)
  if not token_data:
    return jsonify({"error": "Reset token is invalid or expired."}), 400
  uid = str(token_data.get("user_id") or "")
  user = (USERS_DATA.get("users") or {}).get(uid)
  if not user:
    return jsonify({"error": "User not found."}), 404
  salt_hex = str(user.get("password_salt") or "")
  if not salt_hex:
    salt_hex = secrets.token_hex(16)
    user["password_salt"] = salt_hex
  user["password_hash"] = _hash_password(new_password, salt_hex)
  user["updated_at"] = _now_iso()
  _clear_user_sessions(uid)
  _save_users_data()
  return jsonify({"ok": True, "message": "Password reset successful."})


@app.route("/user/activity", methods=["POST"])
def user_activity_push():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  event = str(payload.get("event") or "").strip()
  detail = payload.get("detail")
  if not event:
    return jsonify({"error": "event is required."}), 400
  _ensure_users_data_loaded()
  user.setdefault("activity", [])
  user["activity"].insert(
    0,
    {
      "time": _now_iso(),
      "event": event[:80],
      "detail": detail if isinstance(detail, dict) else {},
    },
  )
  user["activity"] = user["activity"][:100]
  _save_users_data()
  return jsonify({"ok": True})


@app.route("/user/panel", methods=["GET"])
def user_panel():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  rewards = _reward_dashboard_payload(str(user.get("id") or ""))
  return jsonify(
    {
      "user": _public_user(user),
      "activity": (user.get("activity") or [])[:50],
      "rewards": rewards,
    }
  )


@app.route("/rewards/register", methods=["POST"])
def rewards_register():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  display_name = str(payload.get("display_name") or "").strip()
  if display_name:
    user["display_name"] = display_name[:80]
    _save_users_data()
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  return jsonify(
    {
      "user_id": reward_user.get("id"),
      "display_name": reward_user.get("display_name", ""),
      "report_reward_usd": REPORT_REWARD_USD,
      "min_withdraw_usd": MIN_WITHDRAW_USD,
    }
  )


@app.route("/rewards/profile", methods=["PATCH"])
def rewards_profile_update():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  if "display_name" in payload:
    reward_user["display_name"] = str(payload.get("display_name") or "")[:80]
  if "nickname" in payload:
    reward_user["nickname"] = str(payload.get("nickname") or "")[:40]
  if "goal_weekly_reports" in payload:
    v = payload.get("goal_weekly_reports")
    reward_user["goal_weekly_reports"] = max(0, int(v)) if v is not None else None
  if "goal_monthly_reports" in payload:
    v = payload.get("goal_monthly_reports")
    reward_user["goal_monthly_reports"] = max(0, int(v)) if v is not None else None
  if "goal_weekly_usd" in payload:
    v = payload.get("goal_weekly_usd")
    reward_user["goal_weekly_usd"] = max(0, int(v)) if v is not None else None
  if "goal_monthly_usd" in payload:
    v = payload.get("goal_monthly_usd")
    reward_user["goal_monthly_usd"] = max(0, int(v)) if v is not None else None
  if "theme" in payload:
    reward_user["theme"] = str(payload.get("theme") or "").strip()[:40]
  reward_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True, "user_reward": reward_user})


@app.route("/rewards/streak-freeze", methods=["POST"])
def rewards_streak_freeze():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  date_str = str(payload.get("date") or "").strip()
  if not date_str:
    return jsonify({"error": "date required"}), 400
  target = _to_date(date_str)
  if not target:
    return jsonify({"error": "invalid date"}), 400
  today = dt.datetime.utcnow().date()
  if target != today and target != (today - dt.timedelta(days=1)):
    return jsonify({"error": "date must be today or yesterday"}), 400
  uid = str(user.get("id") or "")
  reward_user = _ensure_reward_user(uid, user.get("display_name") or "")
  cfg = REWARD_DATA.get("gamification_config") or {}
  max_freeze = int(cfg.get("streak_freeze_per_month") or 1)
  freeze_dates = reward_user.get("streak_freeze_dates") or []
  if not isinstance(freeze_dates, list):
    freeze_dates = []
  month_freeze = [d for d in freeze_dates if _to_date(d) and _to_date(d).month == today.month and _to_date(d).year == today.year]
  if len(month_freeze) >= max_freeze:
    return jsonify({"error": "streak_freeze_limit_reached", "remaining": 0}), 400
  target_str = target.isoformat()
  if target_str in freeze_dates:
    return jsonify({"ok": True, "message": "already_frozen", "remaining": max_freeze - len(month_freeze)})
  freeze_dates.append(target_str)
  reward_user["streak_freeze_dates"] = freeze_dates[-24:]
  reward_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True, "date": target_str, "remaining": max_freeze - len(month_freeze) - 1})


@app.route("/rewards/personal-goals", methods=["PATCH"])
def rewards_personal_goals():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  uid = str(user.get("id") or "")
  reward_user = _ensure_reward_user(uid, user.get("display_name") or "")
  for key in ["goal_weekly_reports", "goal_monthly_reports", "goal_weekly_usd", "goal_monthly_usd"]:
    if key in payload:
      reward_user[key] = max(0, int(payload[key]) if payload[key] is not None else 0)
  reward_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True, "user_reward": reward_user})


@app.route("/rewards/duel/create", methods=["POST"])
def rewards_duel_create():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  opponent_id = str(payload.get("opponent_id") or "").strip()
  if not opponent_id:
    return jsonify({"error": "opponent_id required"}), 400
  # Resolve referral code to user_id if needed
  opp_upper = opponent_id.upper()
  if len(opponent_id) == 8 and opp_upper.isalnum():
    for u in (REWARD_DATA.get("users") or {}).values():
      if str(u.get("referral_code") or "").upper() == opp_upper:
        opponent_id = str(u.get("id") or "")
        break
  uid = str(user.get("id") or "")
  if opponent_id == uid:
    return jsonify({"error": "cannot duel yourself"}), 400
  week_key = _week_key()
  duels = REWARD_DATA.setdefault("duels", {})
  for d in duels.values():
    if str(d.get("week_key")) == week_key and str(d.get("status")) in ("pending", "active"):
      if uid in (str(d.get("user_a")), str(d.get("user_b"))):
        return jsonify({"error": "already_in_duel", "duel": d}), 400
  duel_id = uuid.uuid4().hex[:12]
  duel = {
    "id": duel_id,
    "user_a": uid,
    "user_b": opponent_id,
    "week_key": week_key,
    "status": "pending",
    "created_at": _now_iso(),
    "scores": {uid: 0, opponent_id: 0},
  }
  duels[duel_id] = duel
  _save_reward_data()
  return jsonify({"ok": True, "duel": duel})


@app.route("/rewards/duel/accept", methods=["POST"])
def rewards_duel_accept():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  duel_id = str(payload.get("duel_id") or "").strip()
  if not duel_id:
    return jsonify({"error": "duel_id required"}), 400
  uid = str(user.get("id") or "")
  duels = REWARD_DATA.get("duels") or {}
  duel = duels.get(duel_id)
  if not duel or str(duel.get("user_b")) != uid:
    return jsonify({"error": "duel not found or not your turn"}), 404
  if str(duel.get("status")) != "pending":
    return jsonify({"error": "duel already accepted or finished"}), 400
  duel["status"] = "active"
  duel["accepted_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True, "duel": duel})


@app.route("/rewards/prediction", methods=["POST"])
def rewards_prediction():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  clan_id = str(payload.get("clan_id") or "").strip()
  predicted_points = int(payload.get("predicted_points") or 0)
  if not clan_id or predicted_points < 0:
    return jsonify({"error": "clan_id and predicted_points required"}), 400
  uid = str(user.get("id") or "")
  week_key = _week_key()
  preds = REWARD_DATA.setdefault("predictions", {})
  for p_id, p in preds.items():
    if str(p.get("user_id")) == uid and str(p.get("week_key")) == week_key:
      p["clan_id"] = clan_id
      p["predicted_points"] = predicted_points
      p["updated_at"] = _now_iso()
      _save_reward_data()
      return jsonify({"ok": True, "prediction": p})
  pred_id = uuid.uuid4().hex[:12]
  pred = {
    "id": pred_id,
    "user_id": uid,
    "week_key": week_key,
    "clan_id": clan_id,
    "predicted_points": predicted_points,
    "created_at": _now_iso(),
  }
  preds[pred_id] = pred
  _save_reward_data()
  return jsonify({"ok": True, "prediction": pred})


@app.route("/rewards/reaction", methods=["POST"])
def rewards_reaction():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  target_user_id = str(payload.get("target_user_id") or "").strip()
  target_type = str(payload.get("target_type") or "achievement")[:40]
  target_id = str(payload.get("target_id") or "")[:80]
  reaction_type = str(payload.get("reaction_type") or "afarin")[:20]
  if reaction_type not in ("afarin", "ghavi", "bravo", "strong"):
    reaction_type = "afarin"
  if not target_user_id or not target_id:
    return jsonify({"error": "target_user_id and target_id required"}), 400
  uid = str(user.get("id") or "")
  if target_user_id == uid:
    return jsonify({"error": "cannot react to yourself"}), 400
  react_key = f"{target_type}_{target_id}_{uid}"
  reactions = REWARD_DATA.setdefault("reactions", {})
  if react_key in reactions:
    reactions[react_key]["reaction_type"] = reaction_type
    reactions[react_key]["updated_at"] = _now_iso()
    _save_reward_data()
    return jsonify({"ok": True, "reaction": reactions[react_key]})
  react_id = uuid.uuid4().hex[:12]
  react = {
    "id": react_id,
    "target_user_id": target_user_id,
    "target_type": target_type,
    "target_id": target_id,
    "reactor_id": uid,
    "reaction_type": reaction_type,
    "created_at": _now_iso(),
  }
  reactions[react_key] = react
  _save_reward_data()
  return jsonify({"ok": True, "reaction": react})


@app.route("/stats/live", methods=["GET"])
def stats_live():
  """Live stats for landing page - no auth required."""
  _ensure_reward_data_loaded()
  claims = REWARD_DATA.get("claims") or {}
  users = REWARD_DATA.get("users") or {}
  approved = sum(1 for c in claims.values() if str(c.get("status")) == "approved")
  return jsonify({
    "total_reports": len(claims),
    "approved_reports": approved,
    "total_users": len(users),
    "fake_accounts_detected": approved,
  })


@app.route("/rewards/daily-wheel", methods=["POST"])
def rewards_daily_wheel():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  uid = str(user.get("id") or "")
  today = dt.datetime.utcnow().date().isoformat()
  spins = REWARD_DATA.setdefault("daily_wheel_spins", {})
  user_spins = spins.get(uid) or {}
  if user_spins.get("date") == today and user_spins.get("count", 0) >= 1:
    return jsonify({"error": "already_spun_today", "remaining": 0}), 400
  amount = 1 + (int(hashlib.sha256(f"{uid}{today}".encode()).hexdigest()[:4], 16) % 5)
  if user_spins.get("date") != today:
    user_spins = {"date": today, "count": 0, "total_usd": 0}
  user_spins["count"] = user_spins.get("count", 0) + 1
  user_spins["total_usd"] = user_spins.get("total_usd", 0) + amount
  spins[uid] = user_spins
  reward_user = _ensure_reward_user(uid, user.get("display_name") or "")
  reward_user["available_usd"] = int(reward_user.get("available_usd") or 0) + amount
  reward_user["lifetime_earned_usd"] = int(reward_user.get("lifetime_earned_usd") or 0) + amount
  _save_reward_data()
  return jsonify({"ok": True, "amount_usd": amount, "remaining_today": 0})


@app.route("/rewards/easter-egg", methods=["POST"])
def rewards_easter_egg():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  code = str(payload.get("code") or "").strip().upper()
  if not code:
    return jsonify({"error": "code required"}), 400
  eggs = REWARD_DATA.get("easter_eggs") or {}
  if code not in eggs:
    return jsonify({"error": "invalid_code"}), 400
  amount = int(eggs.get(code) or 0)
  uid = str(user.get("id") or "")
  reward_user = _ensure_reward_user(uid, user.get("display_name") or "")
  redeemed = list(reward_user.get("easter_eggs_redeemed") or [])
  if code in redeemed:
    return jsonify({"error": "already_redeemed"}), 400
  redeemed.append(code)
  reward_user["easter_eggs_redeemed"] = redeemed[-20:]
  reward_user["available_usd"] = int(reward_user.get("available_usd") or 0) + amount
  reward_user["lifetime_earned_usd"] = int(reward_user.get("lifetime_earned_usd") or 0) + amount
  _save_reward_data()
  return jsonify({"ok": True, "amount_usd": amount, "code": code})


@app.route("/rewards/friends", methods=["GET", "POST"])
def rewards_friends():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  uid = str(user.get("id") or "")
  friends_data = REWARD_DATA.setdefault("friends", {})
  my_friends = friends_data.get(uid) or []
  if not isinstance(my_friends, list):
    my_friends = []
  if request.method == "GET":
    users_map = REWARD_DATA.get("users", {})
    result = [{"id": fid, "display_name": (users_map.get(fid) or {}).get("display_name") or f"User {str(fid)[:8]}"} for fid in my_friends[:50]]
    return jsonify({"friends": result})
  payload = request.get_json(silent=True) or {}
  friend_id = str(payload.get("friend_id") or "").strip()
  if not friend_id or friend_id == uid:
    return jsonify({"error": "invalid friend_id"}), 400
  if friend_id in my_friends:
    return jsonify({"ok": True, "message": "already_friends"})
  my_friends.append(friend_id)
  friends_data[uid] = my_friends[-100:]
  _save_reward_data()
  return jsonify({"ok": True, "friend_id": friend_id})


@app.route("/rewards/profile-comments", methods=["GET", "POST"])
def rewards_profile_comments():
  target_id = request.args.get("user_id") or (request.get_json(silent=True) or {}).get("user_id")
  target_id = str(target_id or "").strip()
  if not target_id:
    return jsonify({"error": "user_id required"}), 400
  _ensure_reward_data_loaded()
  comments_data = REWARD_DATA.setdefault("profile_comments", {})
  key = f"user_{target_id}"
  comments = comments_data.get(key) or []
  if not isinstance(comments, list):
    comments = []
  if request.method == "GET":
    return jsonify({"comments": comments[-30:]})
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  text = str(payload.get("text") or "").strip()[:200]
  if not text:
    return jsonify({"error": "text required"}), 400
  uid = str(user.get("id") or "")
  comments.append({"user_id": uid, "display_name": user.get("display_name") or "User", "text": text, "created_at": _now_iso()})
  comments_data[key] = comments[-50:]
  _save_reward_data()
  return jsonify({"ok": True, "comment": comments[-1]})


@app.route("/rewards/weekly-summary", methods=["GET"])
def rewards_weekly_summary():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  uid = str(user.get("id") or "")
  claims_raw = [c for c in REWARD_DATA.get("claims", {}).values() if str(c.get("user_id")) == uid]
  approved = [c for c in claims_raw if str(c.get("status")) == "approved"]
  today = dt.datetime.utcnow().date()
  week_start = today - dt.timedelta(days=6)
  weekly = [c for c in approved if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start]
  earned = sum(int(c.get("reward_usd") or 0) for c in weekly)
  summary = f"This week: {len(weekly)} approved reports, ${earned} earned. Keep it up!"
  return jsonify({"summary": summary, "weekly_reports": len(weekly), "weekly_earned": earned})


@app.route("/rewards/report-suggestions", methods=["GET"])
def rewards_report_suggestions():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  if not LATEST_RESULTS:
    return jsonify({"suggestions": []})
  high_risk = [r for r in LATEST_RESULTS if (r.get("fake_probability") or 0) >= 0.7][:5]
  return jsonify({"suggestions": [{"username": r.get("username"), "fake_probability": r.get("fake_probability"), "platform": r.get("platform", "instagram")} for r in high_risk]})


@app.route("/rewards/dashboard", methods=["GET"])
def rewards_dashboard():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = _reward_dashboard_payload(str(user.get("id") or ""))
  return jsonify(payload)


@app.route("/rewards/leaderboard", methods=["GET"])
def rewards_leaderboard():
  _ensure_reward_data_loaded()
  now = dt.datetime.utcnow().date()
  week_start = now - dt.timedelta(days=6)
  month_start = now - dt.timedelta(days=29)
  users = []
  for uid, user_row in (REWARD_DATA.get("users") or {}).items():
    claims_raw = [
      c for c in REWARD_DATA.get("claims", {}).values()
      if str(c.get("user_id")) == str(uid)
    ]
    withdrawals_raw = [
      w for w in REWARD_DATA.get("withdrawals", {}).values()
      if str(w.get("user_id")) == str(uid)
    ]
    gm = _compute_gamification(claims_raw, withdrawals_raw)
    weekly_earn = sum(
      int(c.get("reward_usd") or 0)
      for c in claims_raw
      if str(c.get("status")) == "approved"
      and ((_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start)
    )
    monthly_earn = sum(
      int(c.get("reward_usd") or 0)
      for c in claims_raw
      if str(c.get("status")) == "approved"
      and ((_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= month_start)
    )
    users.append(
      {
        "user_id": str(uid),
        "display_name": user_row.get("display_name") or f"user_{uid}",
        "badge": gm.get("badge"),
        "level": gm.get("level"),
        "xp": gm.get("xp"),
        "trust_score": gm.get("trust_score"),
        "weekly_earned_usd": weekly_earn,
        "monthly_earned_usd": monthly_earn,
        "lifetime_earned_usd": gm.get("lifetime_earned_usd"),
      }
    )
  weekly = sorted(users, key=lambda x: (x.get("weekly_earned_usd", 0), x.get("xp", 0)), reverse=True)[:20]
  monthly = sorted(users, key=lambda x: (x.get("monthly_earned_usd", 0), x.get("xp", 0)), reverse=True)[:20]
  hall = sorted(users, key=lambda x: (x.get("lifetime_earned_usd", 0), x.get("xp", 0)), reverse=True)[:20]
  clans = [_clan_public(c, list(REWARD_DATA.get("claims", {}).values())) for c in REWARD_DATA.get("clans", {}).values()]
  clans.sort(key=lambda x: (x.get("weekly_points", 0), x.get("total_points", 0)), reverse=True)
  return jsonify({"weekly": weekly, "monthly": monthly, "hall_of_fame": hall, "clans": clans[:20]})


@app.route("/rewards/clan/create", methods=["POST"])
def rewards_clan_create():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  name = str(payload.get("name") or "").strip()[:40]
  if len(name) < 3:
    return jsonify({"error": "Clan name is too short."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  if str(reward_user.get("clan_id") or ""):
    return jsonify({"error": "You are already in a clan."}), 400
  _ensure_reward_data_loaded()
  clan_id = int(REWARD_DATA.get("next_clan_id") or 1)
  REWARD_DATA["next_clan_id"] = clan_id + 1
  invite_code = uuid.uuid4().hex[:8].upper()
  clan = {
    "id": clan_id,
    "name": name,
    "owner_user_id": reward_user.get("id"),
    "members": [reward_user.get("id")],
    "invite_code": invite_code,
    "is_private": False,
    "join_requests": [],
    "created_at": _now_iso(),
  }
  REWARD_DATA.setdefault("clans", {})[str(clan_id)] = clan
  reward_user["clan_id"] = str(clan_id)
  reward_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True, "clan": clan})


@app.route("/rewards/clan/join", methods=["POST"])
def rewards_clan_join():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  clan_id = str(payload.get("clan_id") or "").strip()
  invite_code = str(payload.get("invite_code") or "").strip().upper()
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  if str(reward_user.get("clan_id") or ""):
    return jsonify({"error": "Leave your current clan first."}), 400
  _ensure_reward_data_loaded()
  target = None
  if clan_id:
    target = REWARD_DATA.get("clans", {}).get(clan_id)
  if not target and invite_code:
    for c in REWARD_DATA.get("clans", {}).values():
      if str(c.get("invite_code") or "").upper() == invite_code:
        target = c
        break
  if not target:
    return jsonify({"error": "Clan not found."}), 404
  members = [str(x) for x in (target.get("members") or []) if str(x)]
  if str(reward_user.get("id")) in members:
    return jsonify({"ok": True, "clan": target})
  if target.get("is_private"):
    requests = target.setdefault("join_requests", [])
    if not isinstance(requests, list):
      target["join_requests"] = []
      requests = target["join_requests"]
    uid = str(reward_user.get("id") or "")
    existing = next((r for r in requests if isinstance(r, dict) and str(r.get("user_id")) == uid), None)
    if not existing:
      requests.append({
        "user_id": uid,
        "display_name": user.get("display_name") or user.get("username") or "User",
        "requested_at": _now_iso(),
      })
    _save_reward_data()
    return jsonify({"ok": True, "pending": True, "message": "Join request sent. Wait for admin approval."})
  members.append(reward_user.get("id"))
  target["members"] = members[:200]
  reward_user["clan_id"] = str(target.get("id") or "")
  reward_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True, "clan": target})


@app.route("/rewards/clan/settings", methods=["PATCH"])
def rewards_clan_settings():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if not clan:
    return jsonify({"error": "Clan not found."}), 404
  if str(clan.get("owner_user_id") or "") != str(reward_user.get("id") or ""):
    return jsonify({"error": "Only the clan owner can change settings."}), 403
  if "is_private" in payload:
    clan["is_private"] = bool(payload.get("is_private"))
  _save_reward_data()
  return jsonify({"ok": True, "clan": clan})


@app.route("/rewards/clan/join-requests", methods=["GET"])
def rewards_clan_join_requests():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if not clan:
    return jsonify({"error": "Clan not found."}), 404
  if str(clan.get("owner_user_id") or "") != str(reward_user.get("id") or ""):
    return jsonify({"error": "Only the clan owner can view join requests."}), 403
  requests = clan.get("join_requests") or []
  if not isinstance(requests, list):
    requests = []
  return jsonify({"items": requests})


@app.route("/rewards/clan/join/approve", methods=["POST"])
def rewards_clan_join_approve():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  user_id = str(payload.get("user_id") or "").strip()
  if not user_id:
    return jsonify({"error": "user_id is required."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if not clan:
    return jsonify({"error": "Clan not found."}), 404
  if str(clan.get("owner_user_id") or "") != str(reward_user.get("id") or ""):
    return jsonify({"error": "Only the clan owner can approve requests."}), 403
  requests = clan.get("join_requests") or []
  if not isinstance(requests, list):
    clan["join_requests"] = []
    requests = clan["join_requests"]
  target_req = next((r for r in requests if isinstance(r, dict) and str(r.get("user_id")) == user_id), None)
  if not target_req:
    return jsonify({"error": "Request not found."}), 404
  clan["join_requests"] = [r for r in requests if str((r or {}).get("user_id")) != user_id]
  members = [str(m) for m in (clan.get("members") or []) if str(m)]
  if user_id not in members:
    members.append(user_id)
  clan["members"] = members[:200]
  target_u = REWARD_DATA.get("users", {}).get(user_id)
  if target_u:
    target_u["clan_id"] = cid
    target_u["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True})


@app.route("/rewards/clan/join/reject", methods=["POST"])
def rewards_clan_join_reject():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  user_id = str(payload.get("user_id") or "").strip()
  if not user_id:
    return jsonify({"error": "user_id is required."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if not clan:
    return jsonify({"error": "Clan not found."}), 404
  if str(clan.get("owner_user_id") or "") != str(reward_user.get("id") or ""):
    return jsonify({"error": "Only the clan owner can reject requests."}), 403
  requests = clan.get("join_requests") or []
  if not isinstance(requests, list):
    clan["join_requests"] = []
    requests = clan["join_requests"]
  clan["join_requests"] = [r for r in requests if str((r or {}).get("user_id")) != user_id]
  _save_reward_data()
  return jsonify({"ok": True})


@app.route("/rewards/clan/delete", methods=["POST"])
def rewards_clan_delete():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if not clan:
    return jsonify({"error": "Clan not found."}), 404
  if str(clan.get("owner_user_id") or "") != str(reward_user.get("id") or ""):
    return jsonify({"error": "Only the clan owner can delete the clan."}), 403
  members = [str(m) for m in (clan.get("members") or []) if str(m)]
  users = REWARD_DATA.get("users", {})
  for mid in members:
    u = users.get(mid)
    if u:
      u["clan_id"] = ""
      u["updated_at"] = _now_iso()
  del REWARD_DATA.get("clans", {})[cid]
  clan_chat = REWARD_DATA.get("clan_chat", {})
  if cid in clan_chat:
    del clan_chat[cid]
  _save_reward_data()
  return jsonify({"ok": True})


@app.route("/rewards/clan/kick", methods=["POST"])
def rewards_clan_kick():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  member_id = str(payload.get("member_id") or "").strip()
  if not member_id:
    return jsonify({"error": "member_id is required."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if not clan:
    return jsonify({"error": "Clan not found."}), 404
  if str(clan.get("owner_user_id") or "") != str(reward_user.get("id") or ""):
    return jsonify({"error": "Only the clan owner can kick members."}), 403
  if member_id == str(reward_user.get("id") or ""):
    return jsonify({"error": "Use Leave clan to leave. Use Delete clan to disband."}), 400
  members = [str(m) for m in (clan.get("members") or []) if str(m)]
  if member_id not in members:
    return jsonify({"error": "Member not in clan."}), 404
  clan["members"] = [m for m in members if m != member_id]
  target_user = REWARD_DATA.get("users", {}).get(member_id)
  if target_user:
    target_user["clan_id"] = ""
    target_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True})


@app.route("/rewards/clan/leave", methods=["POST"])
def rewards_clan_leave():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "You are not in a clan."}), 400
  _ensure_reward_data_loaded()
  clan = REWARD_DATA.get("clans", {}).get(cid)
  if clan:
    clan["members"] = [m for m in (clan.get("members") or []) if str(m) != str(reward_user.get("id"))]
  reward_user["clan_id"] = ""
  reward_user["updated_at"] = _now_iso()
  _save_reward_data()
  return jsonify({"ok": True})


@app.route("/rewards/clan/chat", methods=["GET"])
def rewards_clan_chat_get():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "Join a clan first."}), 400
  _ensure_reward_data_loaded()
  try:
    after_id = int(request.args.get("after_id", "0") or 0)
  except Exception:
    after_id = 0
  items = REWARD_DATA.get("clan_chat", {}).get(cid, [])
  if not isinstance(items, list):
    items = []
  filtered = [m for m in items if int(m.get("id") or 0) > after_id]
  filtered.sort(key=lambda x: int(x.get("id") or 0))
  latest_id = max([after_id] + [int(m.get("id") or 0) for m in items]) if items else after_id
  return jsonify({"items": filtered[-100:], "latest_id": latest_id})


@app.route("/rewards/clan/chat", methods=["POST"])
def rewards_clan_chat_post():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  text = str(payload.get("text") or "").strip()
  if len(text) < 1:
    return jsonify({"error": "Message is required."}), 400
  if len(text) > 400:
    return jsonify({"error": "Message is too long."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  cid = str(reward_user.get("clan_id") or "")
  if not cid:
    return jsonify({"error": "Join a clan first."}), 400
  _ensure_reward_data_loaded()
  msg_id = int(REWARD_DATA.get("next_chat_id") or 1)
  REWARD_DATA["next_chat_id"] = msg_id + 1
  item = {
    "id": msg_id,
    "clan_id": cid,
    "user_id": str(reward_user.get("id") or ""),
    "display_name": user.get("display_name") or user.get("username") or "User",
    "text": text,
    "time": _now_iso(),
  }
  bag = REWARD_DATA.setdefault("clan_chat", {}).setdefault(cid, [])
  bag.append(item)
  if len(bag) > 500:
    del bag[: len(bag) - 500]
  _save_reward_data()
  return jsonify({"ok": True, "item": item})


@app.route("/rewards/season", methods=["GET"])
def rewards_season():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = _season_payload(str(user.get("id") or ""))
  return jsonify(payload)


@app.route("/rewards/profile/public/<identifier>", methods=["GET"])
def rewards_public_profile(identifier: str):
  _ensure_reward_data_loaded()
  raw_id = (identifier or "").strip()
  identifier_upper = raw_id.upper()
  users = REWARD_DATA.get("users", {})
  reward_user = None
  for u in users.values():
    if str(u.get("id") or "") == raw_id:
      reward_user = u
      break
    if str(u.get("referral_code") or "").upper() == identifier_upper:
      reward_user = u
      break
  if not reward_user:
    return jsonify({"error": "Profile not found"}), 404
  uid = str(reward_user.get("id") or "")
  claims_raw = [c for c in REWARD_DATA.get("claims", {}).values() if str(c.get("user_id")) == uid]
  approved = [c for c in claims_raw if str(c.get("status")) == "approved"]
  gm = _compute_gamification(claims_raw, [])
  clan_name = ""
  cid = str(reward_user.get("clan_id") or "")
  if cid:
    clan = REWARD_DATA.get("clans", {}).get(cid)
    if clan:
      clan_name = clan.get("name") or ""
  return jsonify({
    "display_name": reward_user.get("display_name") or "Hunter",
    "badge": gm.get("badge", "Rookie"),
    "title": reward_user.get("title") or "",
    "level": int(gm.get("level") or 1),
    "xp": int(gm.get("xp") or 0),
    "approved_claims": len(approved),
    "clan_name": clan_name,
    "special_badges": reward_user.get("special_badges") or [],
  })


@app.route("/rewards/notifications", methods=["GET"])
def rewards_notifications():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  uid = str(user.get("id") or "")
  try:
    after_id = int(request.args.get("after_id", "0") or 0)
  except Exception:
    after_id = 0
  events = [
    e for e in REWARD_DATA.get("events", [])
    if str(e.get("user_id")) == uid and int(e.get("id") or 0) > after_id
  ]
  events.sort(key=lambda x: int(x.get("id") or 0))
  latest_id = max([after_id] + [int(e.get("id") or 0) for e in events])
  return jsonify({"items": events[:120], "latest_id": latest_id})


@app.route("/rewards/challenge", methods=["GET"])
def rewards_challenge():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  uid = str(user.get("id") or "")
  claims = _claims_sorted_for_user(uid)
  challenge = _compute_weekly_challenge(claims)
  gm = _compute_gamification(claims, [])
  verification = _compute_verification_quest(claims, float(gm.get("trust_score") or 0.0))
  return jsonify({"weekly_challenge": challenge, "verification_quest": verification})


@app.route("/rewards/report", methods=["POST"])
def rewards_report():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  suspect_username = str(payload.get("suspect_username") or "").strip().lstrip("@")
  platform = str(payload.get("platform") or "instagram").strip().lower()
  evidence = str(payload.get("evidence") or "").strip()
  note = str(payload.get("note") or "").strip()
  if not suspect_username:
    return jsonify({"error": "suspect_username is required."}), 400
  if len(suspect_username) < 2:
    return jsonify({"error": "suspect_username is too short."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  _ensure_reward_data_loaded()
  claim_id = int(REWARD_DATA.get("next_claim_id") or 1)
  REWARD_DATA["next_claim_id"] = claim_id + 1
  now = _now_iso()
  claim = {
    "id": claim_id,
    "user_id": reward_user.get("id"),
    "suspect_username": suspect_username[:80],
    "platform": platform[:30] or "instagram",
    "evidence": evidence[:400],
    "note": note[:400],
    "status": "pending",
    "reward_usd": 0,
    "review_note": "",
    "created_at": now,
    "reviewed_at": None,
  }
  claim["ai_profile"] = _build_claim_ai_profile(claim)
  REWARD_DATA.setdefault("claims", {})[str(claim_id)] = claim
  _reward_add_event(
    reward_user.get("id"),
    "claim_submitted",
    f"Report submitted @{suspect_username[:40]}",
    {"claim_id": claim_id, "platform": platform},
  )
  _reward_add_event(
    reward_user.get("id"),
    "claim_pending",
    "Report is pending admin review",
    {"claim_id": claim_id},
  )
  reward_user["pending_claims"] = int(reward_user.get("pending_claims") or 0) + 1
  reward_user["updated_at"] = now
  _save_reward_data()
  return jsonify({"ok": True, "claim": _claim_to_public(claim)})


@app.route("/rewards/withdraw", methods=["POST"])
def rewards_withdraw():
  user = _require_user(request)
  if not user:
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  method = str(payload.get("method") or "USDT").strip()[:40]
  wallet_address = str(payload.get("wallet_address") or "").strip()[:200]
  if not wallet_address:
    return jsonify({"error": "wallet_address is required."}), 400
  reward_user = _ensure_reward_user(str(user.get("id") or ""), user.get("display_name") or "")
  available = int(reward_user.get("available_usd") or 0)
  if available < MIN_WITHDRAW_USD:
    return jsonify({"error": f"Minimum withdraw is ${MIN_WITHDRAW_USD}."}), 400
  _ensure_reward_data_loaded()
  pending_exists = any(
    str(w.get("user_id")) == reward_user.get("id") and str(w.get("status")) == "pending"
    for w in REWARD_DATA.get("withdrawals", {}).values()
  )
  if pending_exists:
    return jsonify({"error": "You already have a pending withdrawal request."}), 400
  withdrawal_id = int(REWARD_DATA.get("next_withdrawal_id") or 1)
  REWARD_DATA["next_withdrawal_id"] = withdrawal_id + 1
  now = _now_iso()
  item = {
    "id": withdrawal_id,
    "user_id": reward_user.get("id"),
    "status": "pending",
    "amount_usd": available,
    "method": method or "USDT",
    "wallet_address": wallet_address,
    "review_note": "",
    "created_at": now,
    "reviewed_at": None,
  }
  REWARD_DATA.setdefault("withdrawals", {})[str(withdrawal_id)] = item
  _reward_add_event(
    reward_user.get("id"),
    "withdraw_requested",
    f"Withdraw requested ${available}",
    {"withdrawal_id": withdrawal_id, "amount_usd": available},
  )
  reward_user["updated_at"] = now
  _save_reward_data()
  return jsonify({"ok": True, "withdrawal": _withdrawal_to_public(item)})


@app.route("/admin/rewards/overview", methods=["GET"])
def admin_rewards_overview():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  users = list(REWARD_DATA.get("users", {}).values())
  claims = list(REWARD_DATA.get("claims", {}).values())
  withdrawals = list(REWARD_DATA.get("withdrawals", {}).values())
  pending_claims = [c for c in claims if c.get("status") == "pending"]
  pending_claims_enriched = []
  for c in pending_claims:
    pending_claims_enriched.append(
      {
        **c,
        "assist": _assist_for_claim(c),
      }
    )
  pending_claims_enriched.sort(
    key=lambda x: (
      1 if bool((x.get("assist") or {}).get("fast_lane")) else 0,
      int((x.get("assist") or {}).get("priority_score") or 0),
    ),
    reverse=True,
  )
  pending_withdrawals = [w for w in withdrawals if w.get("status") == "pending"]
  return jsonify(
    {
      "stats": {
        "users": len(users),
        "claims_total": len(claims),
        "claims_pending": len(pending_claims),
        "withdrawals_total": len(withdrawals),
        "withdrawals_pending": len(pending_withdrawals),
      },
      "pending_claims": sorted(
        pending_claims_enriched,
        key=lambda x: (
          1 if bool((x.get("assist") or {}).get("fast_lane")) else 0,
          int((x.get("assist") or {}).get("priority_score") or 0),
        ),
        reverse=True,
      )[:100],
      "pending_withdrawals": sorted(
        pending_withdrawals,
        key=lambda x: str(x.get("created_at") or ""),
        reverse=True,
      )[:100],
    }
  )


@app.route("/admin/rewards/config", methods=["GET", "PATCH"])
def admin_rewards_config():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  cfg = REWARD_DATA.setdefault("gamification_config", {})
  if request.method == "GET":
    return jsonify({
      "config": cfg,
      "active_events": REWARD_DATA.get("active_events") or {},
    })
  payload = request.get_json(silent=True) or {}
  for key in ["golden_hour", "birthday_bonus_usd", "streak_freeze_per_month", "comeback_bonus_usd",
              "lucky_wheel_enabled", "lucky_wheel_every_n", "season_story"]:
    if key in payload:
      if key == "golden_hour":
        v = payload[key]
        cfg[key] = int(v) if v is not None and str(v).strip() != "" else None
      elif key in ("lucky_wheel_enabled",):
        cfg[key] = bool(payload[key])
      elif key in ("lucky_wheel_every_n", "birthday_bonus_usd", "streak_freeze_per_month", "comeback_bonus_usd"):
        cfg[key] = int(payload[key]) if payload[key] is not None else 0
      else:
        cfg[key] = str(payload.get(key) or "")[:500]
  if "hidden_badges" in payload and isinstance(payload["hidden_badges"], list):
    cfg["hidden_badges"] = [b for b in payload["hidden_badges"] if isinstance(b, dict)][:50]
  for key in ["lucky_day_dow", "lucky_day_bonus_pct", "combo_bonus_per_report", "combo_max_pct"]:
    if key in payload:
      v = payload[key]
      if key == "lucky_day_dow":
        cfg[key] = int(v) if v is not None and str(v).strip() != "" else None
      else:
        cfg[key] = int(v) if v is not None else 0
  if "league_thresholds" in payload and isinstance(payload["league_thresholds"], dict):
    th = payload["league_thresholds"]
    cfg["league_thresholds"] = {
      "bronze": int(th.get("bronze") or 0),
      "silver": int(th.get("silver") or 500),
      "gold": int(th.get("gold") or 2000),
      "platinum": int(th.get("platinum") or 5000),
    }
  if "flash_challenges" in payload and isinstance(payload["flash_challenges"], list):
    cfg["flash_challenges"] = [c for c in payload["flash_challenges"] if isinstance(c, dict)][:20]
  if "hidden_missions" in payload and isinstance(payload["hidden_missions"], list):
    cfg["hidden_missions"] = [m for m in payload["hidden_missions"] if isinstance(m, dict)][:20]
  REWARD_DATA["gamification_config"] = cfg
  _save_reward_data()
  return jsonify({"ok": True, "config": cfg})


@app.route("/admin/rewards/events", methods=["PATCH"])
def admin_rewards_events():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  _ensure_reward_data_loaded()
  events = REWARD_DATA.setdefault("active_events", {})
  for key in ["double_reward", "golden_week", "lucky_hour"]:
    if key in payload:
      events[key] = bool(payload[key])
  REWARD_DATA["active_events"] = events
  _save_reward_data()
  return jsonify({"ok": True, "active_events": events})


@app.route("/admin/rewards/notify", methods=["POST"])
def admin_rewards_notify():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  payload = request.get_json(silent=True) or {}
  user_ids = payload.get("user_ids") or []
  user_id = str(payload.get("user_id") or "").strip()
  if user_id:
    user_ids = [user_id]
  if not user_ids:
    users = list(REWARD_DATA.get("users", {}).keys())
    user_ids = users
  title = str(payload.get("title") or "Notification")[:180]
  event_type = str(payload.get("type") or "admin_notification")[:80]
  for uid in user_ids[:500]:
    _reward_add_event(str(uid), event_type, title, payload.get("meta"))
  return jsonify({"ok": True, "sent": len(user_ids)})


@app.route("/admin/rewards/hunter-of-day", methods=["GET", "POST"])
def admin_rewards_hunter_of_day():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_reward_data_loaded()
  hotd = REWARD_DATA.setdefault("hunter_of_day", {})
  today_key = dt.datetime.utcnow().date().isoformat()
  if request.method == "GET":
    return jsonify({"hunter_of_day": hotd, "today": today_key})
  payload = request.get_json(silent=True) or {}
  user_id = str(payload.get("user_id") or "").strip()
  if user_id:
    hotd[today_key] = user_id
    REWARD_DATA["hunter_of_day"] = hotd
    _save_reward_data()
    _reward_add_event(user_id, "hunter_of_day", "You are Hunter of the Day!", {"date": today_key})
  return jsonify({"ok": True, "hunter_of_day": hotd})


@app.route("/admin/rewards/season/close", methods=["POST"])
def admin_rewards_season_close():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  note = str(payload.get("note") or "").strip()[:180]
  result = _season_close_and_reward(note)
  return jsonify({"ok": True, "season": result})


@app.route("/admin/rewards/claim/<int:claim_id>/review", methods=["POST"])
def admin_review_claim(claim_id: int):
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  status = str(payload.get("status") or "").strip().lower()
  review_note = str(payload.get("review_note") or "").strip()[:400]
  if status not in {"approved", "rejected"}:
    return jsonify({"error": "status must be approved or rejected."}), 400
  _ensure_reward_data_loaded()
  claim = REWARD_DATA.get("claims", {}).get(str(claim_id))
  if not claim:
    return jsonify({"error": "Claim not found."}), 404
  if claim.get("status") != "pending":
    return jsonify({"error": "This claim has already been reviewed."}), 400
  user = _ensure_reward_user(str(claim.get("user_id") or ""))
  now = _now_iso()
  claim["status"] = status
  claim["review_note"] = review_note
  claim["reviewed_at"] = now
  if status == "approved":
    uid = str(user.get("id") or "")
    user_claims = [c for c in REWARD_DATA.get("claims", {}).values() if str(c.get("user_id")) == uid]
    reward_usd, bonus_breakdown = _compute_reward_with_bonuses(uid, user_claims)
    claim["reward_usd"] = reward_usd
    claim["reward_bonuses"] = bonus_breakdown
    user["approved_claims"] = int(user.get("approved_claims") or 0) + 1
    user["lifetime_earned_usd"] = int(user.get("lifetime_earned_usd") or 0) + reward_usd
    user["available_usd"] = int(user.get("available_usd") or 0) + reward_usd
    _reward_add_event(
      user.get("id"),
      "claim_approved",
      f"Report approved for @{claim.get('suspect_username')}",
      {"claim_id": claim_id},
    )
    _reward_add_event(
      user.get("id"),
      "reward_added",
      f"Reward added +${reward_usd}",
      {"claim_id": claim_id, "amount_usd": reward_usd, "bonuses": bonus_breakdown},
    )
    if int(bonus_breakdown.get("lucky_box") or 0) > 0:
      _reward_add_event(
        user.get("id"),
        "lucky_box",
        f"Lucky Box! +${int(bonus_breakdown.get('lucky_box') or 0)}",
        {"claim_id": claim_id, "amount_usd": int(bonus_breakdown.get("lucky_box") or 0)},
      )
    _update_duel_scores(uid, reward_usd)
  else:
    claim["reward_usd"] = 0
    user["last_streak_broke_at"] = now
    user.pop("comeback_used_at", None)
    _reward_add_event(
      user.get("id"),
      "claim_rejected",
      f"Report rejected for @{claim.get('suspect_username')}",
      {"claim_id": claim_id},
    )
  user["pending_claims"] = max(int(user.get("pending_claims") or 0) - 1, 0)
  user["updated_at"] = now
  _save_reward_data()
  return jsonify({"ok": True, "claim": _claim_to_public(claim), "user": user})


@app.route("/admin/rewards/withdrawal/<int:withdrawal_id>/review", methods=["POST"])
def admin_review_withdrawal(withdrawal_id: int):
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  status = str(payload.get("status") or "").strip().lower()
  review_note = str(payload.get("review_note") or "").strip()[:400]
  if status not in {"paid", "rejected"}:
    return jsonify({"error": "status must be paid or rejected."}), 400
  _ensure_reward_data_loaded()
  item = REWARD_DATA.get("withdrawals", {}).get(str(withdrawal_id))
  if not item:
    return jsonify({"error": "Withdrawal not found."}), 404
  if item.get("status") != "pending":
    return jsonify({"error": "This withdrawal has already been reviewed."}), 400
  user = _ensure_reward_user(str(item.get("user_id") or ""))
  now = _now_iso()
  item["status"] = status
  item["review_note"] = review_note
  item["reviewed_at"] = now
  amount = int(item.get("amount_usd") or 0)
  if status == "paid":
    available = int(user.get("available_usd") or 0)
    user["available_usd"] = max(available - amount, 0)
    user["withdrawn_usd"] = int(user.get("withdrawn_usd") or 0) + amount
    _reward_add_event(
      user.get("id"),
      "withdraw_completed",
      f"Withdrawal paid ${amount}",
      {"withdrawal_id": withdrawal_id, "amount_usd": amount},
    )
  else:
    _reward_add_event(
      user.get("id"),
      "withdraw_rejected",
      f"Withdrawal rejected ${amount}",
      {"withdrawal_id": withdrawal_id, "amount_usd": amount},
    )
  user["updated_at"] = now
  _save_reward_data()
  return jsonify({"ok": True, "withdrawal": _withdrawal_to_public(item), "user": user})


@app.route("/bot/config", methods=["GET", "POST"])
def bot_config():
  if request.method == "GET":
    if not _require_bot(request) and not _require_admin(request):
      return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"config": BOT_CONFIG})

  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401

  payload = request.get_json(silent=True) or {}
  BOT_CONFIG["group_mode"] = bool(payload.get("group_mode", BOT_CONFIG["group_mode"]))
  BOT_CONFIG["allow_mentions"] = bool(
    payload.get("allow_mentions", BOT_CONFIG["allow_mentions"])
  )
  lang = payload.get("default_lang", BOT_CONFIG["default_lang"])
  if lang in ["fa", "en"]:
    BOT_CONFIG["default_lang"] = lang
  _log_bot("config_update", {"by": "admin"})
  return jsonify({"config": BOT_CONFIG})


@app.route("/bot/logs", methods=["GET"])
def bot_logs():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  return jsonify({"logs": BOT_LOG[:100]})


@app.route("/bot/ping", methods=["POST"])
def bot_ping():
  if not _require_bot(request):
    return jsonify({"error": "Unauthorized"}), 401
  payload = request.get_json(silent=True) or {}
  _log_bot("ping", {"info": payload.get("info", "ok")})
  return jsonify({"status": "ok"})


def _now_iso() -> str:
  return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _ensure_support_loaded():
  global SUPPORT_SESSIONS, SUPPORT_NEXT_MSG_ID
  if SUPPORT_SESSIONS:
    return
  if not SUPPORT_SESSIONS_PATH.exists():
    SUPPORT_SESSIONS = {}
    SUPPORT_NEXT_MSG_ID = 1
    return
  try:
    raw = json.loads(SUPPORT_SESSIONS_PATH.read_text(encoding="utf-8"))
    SUPPORT_SESSIONS = raw if isinstance(raw, dict) else {}
    max_id = 0
    for sess in SUPPORT_SESSIONS.values():
      for m in sess.get("messages", []):
        try:
          max_id = max(max_id, int(m.get("id") or 0))
        except Exception:
          pass
    SUPPORT_NEXT_MSG_ID = max_id + 1
  except Exception:
    SUPPORT_SESSIONS = {}
    SUPPORT_NEXT_MSG_ID = 1


def _save_support_sessions():
  try:
    SUPPORT_SESSIONS_PATH.write_text(
      json.dumps(SUPPORT_SESSIONS, ensure_ascii=False, indent=2),
      encoding="utf-8",
    )
  except Exception:
    pass


def _default_reward_data() -> Dict:
  return {
    "users": {},
    "claims": {},
    "withdrawals": {},
    "clans": {},
    "clan_chat": {},
    "season_history": [],
    "events": [],
    "active_events": {},
    "clan_matches": {},
    "gamification_config": {
      "golden_hour": None,
      "birthday_bonus_usd": 10,
      "streak_freeze_per_month": 1,
      "comeback_bonus_usd": 5,
      "lucky_wheel_enabled": True,
      "lucky_wheel_every_n": 5,
      "season_story": "",
      "hidden_badges": [],
      "rivalry_history": [],
      "lucky_day_dow": None,
      "lucky_day_bonus_pct": 15,
      "combo_bonus_per_report": 2,
      "combo_max_pct": 20,
      "flash_challenges": [],
      "hidden_missions": [],
      "league_thresholds": {"bronze": 0, "silver": 500, "gold": 2000, "platinum": 5000},
    },
    "duels": {},
    "predictions": {},
    "reactions": {},
    "friends": {},
    "profile_comments": {},
    "easter_eggs": {"SENTINEL2025": 5, "HUNTER": 3, "LEGEND": 10},
    "daily_wheel_spins": {},
    "hunter_of_day": {},
    "annual_hall_of_fame": [],
    "next_claim_id": 1,
    "next_withdrawal_id": 1,
    "next_clan_id": 1,
    "next_chat_id": 1,
    "next_event_id": 1,
  }


def _to_date(iso_str: str) -> Optional[dt.date]:
  s = str(iso_str or "").strip()
  if not s:
    return None
  try:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).date()
  except Exception:
    return None


def _is_golden_hour() -> bool:
  cfg = (REWARD_DATA.get("gamification_config") or {}).get("golden_hour")
  if cfg is None:
    return False
  try:
    gh = int(cfg)
    return 0 <= gh <= 23 and dt.datetime.utcnow().hour == gh
  except Exception:
    return False


def _is_birthday_today(user: Dict) -> bool:
  created = user.get("created_at") or ""
  if not created:
    return False
  d = _to_date(created)
  if not d:
    return False
  today = dt.datetime.utcnow().date()
  return d.month == today.month and d.day == today.day


def _is_lucky_day() -> bool:
  cfg = REWARD_DATA.get("gamification_config") or {}
  dow = cfg.get("lucky_day_dow")
  if dow is None or str(dow).strip() == "":
    return False
  try:
    target = int(dow)
    return 0 <= target <= 6 and dt.datetime.utcnow().weekday() == target
  except Exception:
    return False


def _consecutive_approved_count(claims_raw: List[Dict], user_id: str) -> int:
  """Count consecutive approved reports from most recent (streak)."""
  user_claims = [c for c in claims_raw if str(c.get("user_id")) == user_id]
  user_claims.sort(key=lambda x: str(x.get("reviewed_at") or x.get("created_at") or ""), reverse=True)
  count = 0
  for c in user_claims:
    if str(c.get("status")) != "approved":
      break
    count += 1
  return count


def _league_for_points(points: int) -> str:
  cfg = REWARD_DATA.get("gamification_config") or {}
  th = cfg.get("league_thresholds") or {}
  if isinstance(th, dict) and points >= int(th.get("platinum") or 5000):
    return "platinum"
  if points >= int(th.get("gold") or 2000):
    return "gold"
  if points >= int(th.get("silver") or 500):
    return "silver"
  return "bronze"


def _compute_reward_with_bonuses(user_id: str, claims_raw: List[Dict], base_usd: int = REPORT_REWARD_USD) -> Tuple[int, Dict]:
  """Returns (total_usd, bonus_breakdown)."""
  today = dt.datetime.utcnow().date()
  user = REWARD_DATA.get("users", {}).get(user_id) or {}
  approved_today = [
    c for c in claims_raw
    if str(c.get("user_id")) == user_id
    and str(c.get("status")) == "approved"
    and _to_date(c.get("reviewed_at") or c.get("created_at")) == today
  ]
  approved_today.sort(key=lambda x: str(x.get("reviewed_at") or x.get("created_at") or ""))
  total = base_usd
  breakdown = {"base": base_usd, "first_report": 0, "daily_challenge": 0, "lucky_box": 0, "event_multiplier": 1.0, "birthday": 0, "comeback": 0, "lucky_day": 0, "combo": 0}
  is_first_today = len(approved_today) == 0
  if is_first_today:
    total += FIRST_REPORT_BONUS_USD
    breakdown["first_report"] = FIRST_REPORT_BONUS_USD
  after_this = len(approved_today) + 1
  if after_this >= 3:
    bonus = int(base_usd * DAILY_CHALLENGE_BONUS_PCT / 100)
    total += bonus
    breakdown["daily_challenge"] = bonus
  cfg = REWARD_DATA.get("gamification_config") or {}
  wheel_n = int(cfg.get("lucky_wheel_every_n") or LUCKY_BOX_EVERY_N or 5)
  wheel_enabled = cfg.get("lucky_wheel_enabled", True)
  if wheel_enabled and after_this > 0 and after_this % wheel_n == 0:
    span = max(1, LUCKY_BOX_MAX_USD - LUCKY_BOX_MIN_USD + 1)
    lucky = LUCKY_BOX_MIN_USD + (abs(hash(str(user_id) + str(after_this))) % span)
    total += lucky
    breakdown["lucky_box"] = lucky
  events = REWARD_DATA.get("active_events") or {}
  if isinstance(events, dict) and events.get("double_reward"):
    total = int(total * 2)
    breakdown["event_multiplier"] = 2.0
  if _is_golden_hour():
    total = int(total * 2)
    breakdown["event_multiplier"] = breakdown.get("event_multiplier", 1.0) * 2.0
  birthday_bonus = int(cfg.get("birthday_bonus_usd") or 0)
  if birthday_bonus > 0 and _is_birthday_today(user):
    total += birthday_bonus
    breakdown["birthday"] = birthday_bonus
  comeback_bonus = int(cfg.get("comeback_bonus_usd") or 0)
  last_broke = user.get("last_streak_broke_at")
  comeback_used = user.get("comeback_used_at")
  if comeback_bonus > 0 and last_broke and not comeback_used:
    broke_date = _to_date(last_broke)
    if broke_date and (today - broke_date).days <= 7:
      total += comeback_bonus
      breakdown["comeback"] = comeback_bonus
      user["comeback_used_at"] = _now_iso()
  lucky_day_pct = int(cfg.get("lucky_day_bonus_pct") or 0)
  if lucky_day_pct > 0 and _is_lucky_day():
    bonus = int(total * lucky_day_pct / 100)
    total += bonus
    breakdown["lucky_day"] = bonus
  combo_pct = int(cfg.get("combo_bonus_per_report") or 0)
  combo_max = int(cfg.get("combo_max_pct") or 50)
  if combo_pct > 0:
    streak = _consecutive_approved_count(claims_raw, user_id)
    if streak > 1:
      combo_bonus_pct = min(combo_max, (streak - 1) * combo_pct)
      bonus = int(total * combo_bonus_pct / 100)
      total += bonus
      breakdown["combo"] = bonus
  return (total, breakdown)


def _ensure_reward_data_loaded():
  global REWARD_DATA
  if REWARD_DATA:
    return
  if not REWARD_DATA_PATH.exists():
    REWARD_DATA = _default_reward_data()
    return
  try:
    raw = json.loads(REWARD_DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
      REWARD_DATA = _default_reward_data()
      return
    data = _default_reward_data()
    for key in ["users", "claims", "withdrawals", "clans", "clan_chat"]:
      value = raw.get(key)
      data[key] = value if isinstance(value, dict) else {}
    season_history_val = raw.get("season_history")
    data["season_history"] = season_history_val if isinstance(season_history_val, list) else []
    events_value = raw.get("events")
    data["events"] = events_value if isinstance(events_value, list) else []
    data["active_events"] = raw.get("active_events") if isinstance(raw.get("active_events"), dict) else {}
    data["clan_matches"] = raw.get("clan_matches") if isinstance(raw.get("clan_matches"), dict) else {}
    cfg = raw.get("gamification_config")
    data["gamification_config"] = cfg if isinstance(cfg, dict) else _default_reward_data().get("gamification_config", {})
    hotd = raw.get("hunter_of_day")
    data["hunter_of_day"] = hotd if isinstance(hotd, dict) else {}
    ahof = raw.get("annual_hall_of_fame")
    data["annual_hall_of_fame"] = ahof if isinstance(ahof, list) else []
    data["duels"] = raw.get("duels") if isinstance(raw.get("duels"), dict) else {}
    data["predictions"] = raw.get("predictions") if isinstance(raw.get("predictions"), dict) else {}
    data["reactions"] = raw.get("reactions") if isinstance(raw.get("reactions"), dict) else {}
    data["friends"] = raw.get("friends") if isinstance(raw.get("friends"), dict) else {}
    data["profile_comments"] = raw.get("profile_comments") if isinstance(raw.get("profile_comments"), dict) else {}
    data["easter_eggs"] = raw.get("easter_eggs") if isinstance(raw.get("easter_eggs"), dict) else {"SENTINEL2025": 5, "HUNTER": 3, "LEGEND": 10}
    data["daily_wheel_spins"] = raw.get("daily_wheel_spins") if isinstance(raw.get("daily_wheel_spins"), dict) else {}
    try:
      data["next_claim_id"] = max(int(raw.get("next_claim_id") or 1), 1)
    except Exception:
      data["next_claim_id"] = 1
    try:
      data["next_withdrawal_id"] = max(int(raw.get("next_withdrawal_id") or 1), 1)
    except Exception:
      data["next_withdrawal_id"] = 1
    try:
      data["next_clan_id"] = max(int(raw.get("next_clan_id") or 1), 1)
    except Exception:
      data["next_clan_id"] = 1
    try:
      data["next_chat_id"] = max(int(raw.get("next_chat_id") or 1), 1)
    except Exception:
      data["next_chat_id"] = 1
    try:
      data["next_event_id"] = max(int(raw.get("next_event_id") or 1), 1)
    except Exception:
      data["next_event_id"] = 1
    REWARD_DATA = data
  except Exception:
    REWARD_DATA = _default_reward_data()


def _save_reward_data():
  try:
    REWARD_DATA_PATH.write_text(
      json.dumps(REWARD_DATA, ensure_ascii=False, indent=2),
      encoding="utf-8",
    )
  except Exception:
    pass


def _ensure_reward_user(user_id: str, display_name: str = "") -> Dict:
  _ensure_reward_data_loaded()
  uid = (user_id or "").strip()
  if not uid:
    uid = uuid.uuid4().hex[:12]
  users = REWARD_DATA.setdefault("users", {})
  user = users.get(uid)
  if user:
    if display_name and not user.get("display_name"):
      user["display_name"] = display_name.strip()[:80]
      user["updated_at"] = _now_iso()
      _save_reward_data()
    user.setdefault("clan_id", "")
    user.setdefault("special_badges", [])
    user.setdefault("nickname", "")
    user.setdefault("fast_lane_reviewer", False)
    return user
  now = _now_iso()
  user = {
    "id": uid,
    "display_name": (display_name or "").strip()[:80],
    "created_at": now,
    "updated_at": now,
    "lifetime_earned_usd": 0,
    "available_usd": 0,
    "pending_claims": 0,
    "approved_claims": 0,
    "withdrawn_usd": 0,
    "clan_id": "",
    "special_badges": [],
    "fast_lane_reviewer": False,
    "referral_code": uuid.uuid4().hex[:8].upper(),
    "referred_by": "",
    "title": "",
    "nickname": "",
  }
  users[uid] = user
  _save_reward_data()
  return user


def _claim_to_public(claim: Dict) -> Dict:
  profile = claim.get("ai_profile") if isinstance(claim.get("ai_profile"), dict) else _build_claim_ai_profile(claim)
  return {
    "id": claim.get("id"),
    "suspect_username": claim.get("suspect_username"),
    "platform": claim.get("platform"),
    "evidence": claim.get("evidence"),
    "note": claim.get("note"),
    "status": claim.get("status"),
    "created_at": claim.get("created_at"),
    "reviewed_at": claim.get("reviewed_at"),
    "reward_usd": claim.get("reward_usd", 0),
    "review_note": claim.get("review_note", ""),
    "ai_signals": profile.get("signals", []),
    "risk_radar": profile.get("risk_radar", {}),
  }


def _withdrawal_to_public(item: Dict) -> Dict:
  return {
    "id": item.get("id"),
    "status": item.get("status"),
    "amount_usd": item.get("amount_usd", 0),
    "method": item.get("method"),
    "wallet_address": item.get("wallet_address"),
    "created_at": item.get("created_at"),
    "reviewed_at": item.get("reviewed_at"),
    "review_note": item.get("review_note", ""),
  }


def _to_day(iso_str: str) -> Optional[dt.date]:
  s = str(iso_str or "").strip()
  if not s:
    return None
  try:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).date()
  except Exception:
    return None


def _to_dt(iso_str: str) -> Optional[dt.datetime]:
  s = str(iso_str or "").strip()
  if not s:
    return None
  try:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
  except Exception:
    return None


def _update_duel_scores(user_id: str, points_added: int):
  """Add points to active duel for user when claim approved."""
  if points_added <= 0:
    return
  duels = REWARD_DATA.get("duels") or {}
  week_key = _week_key()
  for d in duels.values():
    if str(d.get("week_key")) != week_key or str(d.get("status")) != "active":
      continue
    scores = d.get("scores") or {}
    if user_id in (str(d.get("user_a")), str(d.get("user_b"))):
      scores[user_id] = int(scores.get(user_id) or 0) + points_added
      d["scores"] = scores
      _save_reward_data()
      break


def _duels_for_user(user_id: str) -> Dict:
  duels = REWARD_DATA.get("duels") or {}
  week_key = _week_key()
  result = {"active": None, "history": []}
  for d_id, d in duels.items():
    if str(d.get("user_a")) == user_id or str(d.get("user_b")) == user_id:
      if str(d.get("week_key")) == week_key and str(d.get("status")) in ("pending", "active"):
        result["active"] = d
      else:
        result["history"].append(d)
  result["history"].sort(key=lambda x: str(x.get("week_key") or ""), reverse=True)
  result["history"] = result["history"][:10]
  return result


def _predictions_for_user(user_id: str) -> Dict:
  preds = REWARD_DATA.get("predictions") or {}
  week_key = _week_key()
  result = {"current": None, "history": []}
  for p_id, p in preds.items():
    if str(p.get("user_id")) == user_id:
      if str(p.get("week_key")) == week_key:
        result["current"] = p
      else:
        result["history"].append(p)
  result["history"].sort(key=lambda x: str(x.get("week_key") or ""), reverse=True)
  result["history"] = result["history"][:5]
  return result


def _reactions_for_user(user_id: str) -> List[Dict]:
  """Reactions received by this user on their achievements."""
  reactions = REWARD_DATA.get("reactions") or {}
  result = []
  for r in reactions.values():
    if str(r.get("target_user_id")) == user_id:
      result.append(r)
  result.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
  return result[:30]


def _daily_random_challenge(claims_raw: List[Dict], user_id: str) -> Dict:
  """Daily challenge based on date hash - same for everyone each day."""
  today = dt.datetime.utcnow().date()
  seed = hashlib.sha256(f"daily_{today.isoformat()}".encode()).hexdigest()
  variants = [
    {"id": "3in3", "title": "3 reports in 3 different days", "target_reports": 3, "target_days": 3, "bonus_usd": 5},
    {"id": "streak5", "title": "5-day streak", "target_streak": 5, "bonus_usd": 8},
    {"id": "first3", "title": "First 3 reports today", "target_today": 3, "bonus_usd": 5},
    {"id": "trust90", "title": "Keep 90%+ trust", "target_trust": 90, "bonus_usd": 3},
  ]
  idx = int(seed[:8], 16) % len(variants)
  v = variants[idx].copy()
  approved = [c for c in claims_raw if str(c.get("user_id")) == user_id and str(c.get("status")) == "approved"]
  approved_days = sorted({_to_day(c.get("reviewed_at") or c.get("created_at")) for c in approved if _to_day(c.get("reviewed_at") or c.get("created_at"))})
  if v.get("id") == "3in3":
    v["progress"] = min(len(approved_days), 3)
    v["done"] = len(approved_days) >= 3
  elif v.get("id") == "streak5":
    streak = 0
    cursor = today
    while cursor in approved_days:
      streak += 1
      cursor -= dt.timedelta(days=1)
    v["progress"] = min(streak, 5)
    v["done"] = streak >= 5
  elif v.get("id") == "first3":
    today_count = len([c for c in approved if _to_day(c.get("reviewed_at") or c.get("created_at")) == today])
    v["progress"] = min(today_count, 3)
    v["done"] = today_count >= 3
  else:
    reviewed = len([c for c in claims_raw if str(c.get("user_id")) == user_id and str(c.get("status")) in ("approved", "rejected")])
    approved_count = len(approved)
    trust = round((approved_count / reviewed) * 100, 1) if reviewed > 0 else 0
    v["progress"] = min(trust, 90)
    v["done"] = trust >= 90
  return v


def _story_quests(claims_raw: List[Dict], user_id: str) -> List[Dict]:
  """Multi-stage story quests."""
  approved = [c for c in claims_raw if str(c.get("user_id")) == user_id and str(c.get("status")) == "approved"]
  total = len(approved)
  earned = sum(int(c.get("reward_usd") or 0) for c in approved)
  stages = [
    {"id": "s1", "target": 1, "progress": min(total, 1), "reward_key": "storyQuestReward1"},
    {"id": "s2", "target": 5, "progress": min(total, 5), "reward_key": "storyQuestReward2"},
    {"id": "s3", "target": 15, "progress": min(total, 15), "reward_key": "storyQuestReward3"},
    {"id": "s4", "target": 50, "progress": min(total, 50), "reward_key": "storyQuestReward4"},
  ]
  for s in stages:
    s["done"] = s["progress"] >= s["target"]
  return stages


def _hidden_achievements(claims_raw: List[Dict], user_id: str, user: Dict) -> List[Dict]:
  """Hidden achievements unlocked by conditions."""
  approved = [c for c in claims_raw if str(c.get("user_id")) == user_id and str(c.get("status")) == "approved"]
  badges = user.get("special_badges") or []
  unlocked = []
  if len(approved) >= 7 and "hidden_7streak" not in badges:
    unlocked.append({"id": "hidden_7streak", "title": "۷ روز پشت‌سرهم", "secret": True})
  if len(approved) >= 100 and "hidden_century" not in badges:
    unlocked.append({"id": "hidden_century", "title": "صد گزارش", "secret": True})
  if sum(int(c.get("reward_usd") or 0) for c in approved) >= 500 and "hidden_500" not in badges:
    unlocked.append({"id": "hidden_500", "title": "۵۰۰ دلار", "secret": True})
  return unlocked


def _week_comparison(claims_raw: List[Dict], user_id: str) -> Dict:
  """Compare this week vs last week."""
  today = dt.datetime.utcnow().date()
  this_week_start = today - dt.timedelta(days=6)
  last_week_start = this_week_start - dt.timedelta(days=7)
  approved = [c for c in claims_raw if str(c.get("user_id")) == user_id and str(c.get("status")) == "approved"]
  this_week = sum(int(c.get("reward_usd") or 0) for c in approved if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= this_week_start)
  last_week = sum(int(c.get("reward_usd") or 0) for c in approved if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= last_week_start and (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) < this_week_start)
  pct = round((this_week - last_week) / last_week * 100, 1) if last_week > 0 else (100 if this_week > 0 else 0)
  return {"this_week": this_week, "last_week": last_week, "change_pct": pct}


def _ai_prediction(user_id: str, claims_raw: List[Dict], weekly_earned: int) -> Dict:
  """Simple prediction: earn rate * days left in month."""
  today = dt.datetime.utcnow().date()
  days_left = (dt.date(today.year, today.month + 1, 1) - dt.timedelta(days=1)).day - today.day + 1
  days_left = max(0, days_left)
  if today.day <= 7:
    predicted = int(weekly_earned * 4.3) if weekly_earned > 0 else 0
  else:
    predicted = int(weekly_earned * (days_left / 7.0))
  return {"predicted_month_end_usd": predicted, "days_left": days_left}


def _week_key(day: Optional[dt.date] = None) -> str:
  d = day or dt.datetime.utcnow().date()
  y, w, _ = d.isocalendar()
  return f"{y}-W{w:02d}"


def _hash_score(seed: str, minimum: int, maximum: int) -> int:
  raw = hashlib.sha256(str(seed or "").encode("utf-8")).hexdigest()
  span = max(maximum - minimum, 1)
  return minimum + (int(raw[:8], 16) % (span + 1))


def _build_claim_ai_profile(claim: Dict) -> Dict:
  username = str(claim.get("suspect_username") or "")
  note = str(claim.get("note") or "")
  evidence = str(claim.get("evidence") or "")
  platform = str(claim.get("platform") or "")
  seed = f"{username}|{platform}|{note}|{evidence}"
  behavior = _hash_score(seed + "|b", 35, 96)
  engagement = _hash_score(seed + "|e", 25, 92)
  account_age = _hash_score(seed + "|a", 18, 94)
  network = _hash_score(seed + "|n", 30, 98)
  content = _hash_score(seed + "|c", 20, 95)
  signals = sorted(
    [
      {"key": "behavior_spike", "label": "Behavior spike", "value": behavior, "impact": "high" if behavior >= 75 else "medium"},
      {"key": "engagement_anomaly", "label": "Engagement anomaly", "value": engagement, "impact": "high" if engagement >= 75 else "medium"},
      {"key": "account_age_risk", "label": "Account age risk", "value": account_age, "impact": "high" if account_age >= 75 else "medium"},
      {"key": "network_pattern", "label": "Network pattern", "value": network, "impact": "high" if network >= 75 else "medium"},
      {"key": "content_suspicion", "label": "Content suspicion", "value": content, "impact": "high" if content >= 75 else "medium"},
    ],
    key=lambda x: int(x.get("value") or 0),
    reverse=True,
  )
  return {
    "signals": signals[:3],
    "risk_radar": {
      "behavior": behavior,
      "engagement": engagement,
      "account_age": account_age,
      "network": network,
      "content": content,
    },
  }


def _claims_sorted_for_user(uid: str) -> List[Dict]:
  claims = [
    c
    for c in REWARD_DATA.get("claims", {}).values()
    if str(c.get("user_id")) == str(uid)
  ]
  claims.sort(
    key=lambda c: str(c.get("reviewed_at") or c.get("created_at") or ""),
    reverse=True,
  )
  return claims


def _compute_verification_quest(claims_raw: List[Dict], trust_score: float) -> Dict:
  reviewed = [
    c for c in claims_raw
    if str(c.get("status")) in {"approved", "rejected"} and c.get("reviewed_at")
  ]
  reviewed.sort(key=lambda c: str(c.get("reviewed_at") or ""), reverse=True)
  streak_ok = 0
  for c in reviewed:
    if str(c.get("status")) == "approved":
      streak_ok += 1
    else:
      break
  target = 4
  done = streak_ok >= target and trust_score >= 80.0
  return {
    "title": "Verification Quest",
    "progress": min(streak_ok, target),
    "target": target,
    "required_trust": 80.0,
    "fast_lane": done,
  }


def _compute_weekly_challenge(claims_raw: List[Dict]) -> Dict:
  now = dt.datetime.utcnow().date()
  week_start = now - dt.timedelta(days=6)
  reviewed_week = [
    c for c in claims_raw
    if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start
    and str(c.get("status")) in {"approved", "rejected"}
  ]
  approved_week = [c for c in reviewed_week if str(c.get("status")) == "approved"]
  reviewed_count = len(reviewed_week)
  acc = round((len(approved_week) / reviewed_count) * 100, 1) if reviewed_count > 0 else 0.0
  done = len(approved_week) >= 5 and acc >= 80.0
  return {
    "week_key": _week_key(now),
    "title": "Weekly Challenge",
    "target_approved": 5,
    "target_accuracy": 80.0,
    "approved_progress": len(approved_week),
    "accuracy": acc,
    "done": done,
    "badge": "Weekly Sentinel" if done else "",
  }


def _compute_heatmap(claims_raw: List[Dict]) -> Dict:
  hours = [0] * 24
  weekdays = [0] * 7
  for c in claims_raw:
    mark = c.get("reviewed_at") or c.get("created_at")
    dtv = _to_dt(mark)
    if not dtv:
      continue
    hours[int(dtv.hour)] += 1
    weekdays[int(dtv.weekday())] += 1
  return {"hours": hours, "weekdays": weekdays}


def _clan_public(clan: Dict, claims: List[Dict]) -> Dict:
  cid = str(clan.get("id") or "")
  members = [str(x) for x in (clan.get("members") or []) if str(x)]
  approved = [
    c for c in claims
    if str(c.get("user_id")) in members and str(c.get("status")) == "approved"
  ]
  week_start = dt.datetime.utcnow().date() - dt.timedelta(days=6)
  weekly_points = sum(
    int(c.get("reward_usd") or 0)
    for c in approved
    if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start
  )
  total_points = int(sum(int(c.get("reward_usd") or 0) for c in approved))
  return {
    "id": cid,
    "name": clan.get("name") or f"Clan {cid}",
    "invite_code": clan.get("invite_code") or "",
    "is_private": bool(clan.get("is_private")),
    "member_count": len(members),
    "weekly_points": weekly_points,
    "total_points": total_points,
  }


def _season_window(ref: Optional[dt.date] = None) -> Tuple[str, dt.datetime, dt.datetime]:
  day = ref or dt.datetime.utcnow().date()
  start = dt.datetime(day.year, day.month, 1, 0, 0, 0)
  if day.month == 12:
    next_month = dt.datetime(day.year + 1, 1, 1, 0, 0, 0)
  else:
    next_month = dt.datetime(day.year, day.month + 1, 1, 0, 0, 0)
  end = next_month - dt.timedelta(seconds=1)
  return f"{day.year}-{day.month:02d}", start, end


def _in_window(iso_str: str, start: dt.datetime, end: dt.datetime) -> bool:
  x = _to_dt(iso_str)
  if not x:
    return False
  if x.tzinfo is not None:
    x = x.replace(tzinfo=None)
  return start <= x <= end


def _season_clan_rankings(claims: List[Dict], clans: List[Dict], start: dt.datetime, end: dt.datetime) -> List[Dict]:
  rows = []
  for clan in clans:
    members = [str(x) for x in (clan.get("members") or []) if str(x)]
    approved = [
      c for c in claims
      if str(c.get("user_id")) in members
      and str(c.get("status")) == "approved"
      and _in_window(c.get("reviewed_at") or c.get("created_at"), start, end)
    ]
    points = int(sum(int(c.get("reward_usd") or 0) for c in approved))
    rows.append(
      {
        "id": str(clan.get("id") or ""),
        "name": clan.get("name") or f"Clan {clan.get('id')}",
        "member_count": len(members),
        "season_points": points,
      }
    )
  rows.sort(key=lambda x: (int(x.get("season_points") or 0), int(x.get("member_count") or 0)), reverse=True)
  return rows


def _season_payload(user_id: str) -> Dict:
  _ensure_reward_data_loaded()
  season_key, start, end = _season_window()
  claims = list(REWARD_DATA.get("claims", {}).values())
  clans = list(REWARD_DATA.get("clans", {}).values())
  rankings = _season_clan_rankings(claims, clans, start, end)
  current = None
  user = _ensure_reward_user(user_id)
  cid = str(user.get("clan_id") or "")
  if cid:
    for idx, row in enumerate(rankings):
      if str(row.get("id")) == cid:
        current = {**row, "rank": idx + 1}
        break
  return {
    "key": season_key,
    "start_at": start.isoformat(timespec="seconds") + "Z",
    "end_at": end.isoformat(timespec="seconds") + "Z",
    "leaderboard": rankings[:20],
    "current_clan": current or {},
    "history": list(REWARD_DATA.get("season_history", []))[:8],
  }


def _season_close_and_reward(admin_note: str = "") -> Dict:
  _ensure_reward_data_loaded()
  season_key, start, end = _season_window()
  claims = list(REWARD_DATA.get("claims", {}).values())
  clans = list(REWARD_DATA.get("clans", {}).values())
  rankings = _season_clan_rankings(claims, clans, start, end)
  clan_bonus_pool = [300, 180, 90]
  rewarded = []
  users = REWARD_DATA.setdefault("users", {})
  for idx, clan_row in enumerate(rankings[:3]):
    clan = REWARD_DATA.get("clans", {}).get(str(clan_row.get("id") or ""))
    if not clan:
      continue
    members = [str(x) for x in (clan.get("members") or []) if str(x)]
    if not members:
      continue
    per_user = int(clan_bonus_pool[idx] // max(len(members), 1))
    if per_user <= 0:
      continue
    for uid in members:
      u = users.get(uid) or _ensure_reward_user(uid)
      u["lifetime_earned_usd"] = int(u.get("lifetime_earned_usd") or 0) + per_user
      u["available_usd"] = int(u.get("available_usd") or 0) + per_user
      u["updated_at"] = _now_iso()
      badges = u.get("special_badges")
      if not isinstance(badges, list):
        badges = []
      badge_name = f"Season {season_key} Top {idx + 1}"
      if badge_name not in badges:
        badges.append(badge_name)
      u["special_badges"] = badges[-20:]
      _reward_add_event(uid, "season_reward", f"Season reward +${per_user}", {"season": season_key, "rank": idx + 1})
    rewarded.append({"clan_id": clan_row.get("id"), "clan_name": clan_row.get("name"), "rank": idx + 1, "per_user_usd": per_user})
  history = REWARD_DATA.setdefault("season_history", [])
  history.insert(
    0,
    {
      "season_key": season_key,
      "closed_at": _now_iso(),
      "admin_note": str(admin_note or "")[:180],
      "top_clans": rewarded,
    },
  )
  REWARD_DATA["season_history"] = history[:24]
  # Add top users to annual hall of fame
  user_scores = []
  for uid, u in (REWARD_DATA.get("users") or {}).items():
    claims_u = [c for c in claims if str(c.get("user_id")) == uid and str(c.get("status")) == "approved"]
    season_earn = sum(int(c.get("reward_usd") or 0) for c in claims_u if _in_window(c.get("reviewed_at") or c.get("created_at"), start, end))
    lifetime = int(u.get("lifetime_earned_usd") or 0)
    user_scores.append({"user_id": uid, "display_name": u.get("display_name") or f"user_{uid}", "season_earned": season_earn, "lifetime_earned": lifetime})
  user_scores.sort(key=lambda x: (x.get("lifetime_earned", 0), x.get("season_earned", 0)), reverse=True)
  ahof = list(REWARD_DATA.get("annual_hall_of_fame") or [])
  year = dt.datetime.utcnow().year
  for row in user_scores[:10]:
    ahof.append({"year": year, "season": season_key, "user_id": row.get("user_id"), "display_name": row.get("display_name"), "lifetime_earned": row.get("lifetime_earned")})
  REWARD_DATA["annual_hall_of_fame"] = ahof[-50:]
  _save_reward_data()
  return {"season_key": season_key, "rewarded": rewarded, "leaderboard": rankings[:10]}


def _compute_gamification(claims_raw: List[Dict], withdrawals_raw: List[Dict], user_id: Optional[str] = None) -> Dict:
  approved = [c for c in claims_raw if str(c.get("status")) == "approved"]
  pending = [c for c in claims_raw if str(c.get("status")) == "pending"]
  rejected = [c for c in claims_raw if str(c.get("status")) == "rejected"]
  reviewed_total = len(approved) + len(rejected)
  trust_score = round((len(approved) / reviewed_total) * 100, 1) if reviewed_total > 0 else 0.0
  lifetime_earned = int(sum(int(c.get("reward_usd") or 0) for c in approved))
  xp = int((len(approved) * 120) + (len(pending) * 20) + int(trust_score // 10) * 10)
  level = int(xp // 300) + 1
  badge = (
    "Legend" if xp >= 3000 else
    "Elite Hunter" if xp >= 1800 else
    "Pro Hunter" if xp >= 900 else
    "Rising Hunter" if xp >= 300 else
    "Rookie"
  )
  league = _league_for_points(xp)
  approved_days = sorted(
    {
      d
      for d in (_to_day(c.get("reviewed_at") or c.get("created_at")) for c in approved)
      if d
    }
  )
  approved_set = set(approved_days)
  if user_id:
    cfg = REWARD_DATA.get("gamification_config") or {}
    max_freeze = int(cfg.get("streak_freeze_per_month") or 1)
    user = REWARD_DATA.get("users", {}).get(user_id) or {}
    freeze_dates_raw = user.get("streak_freeze_dates") or []
    if isinstance(freeze_dates_raw, list):
      today = dt.datetime.utcnow().date()
      month_freeze = []
      for d in freeze_dates_raw:
        d_obj = _to_date(d) if isinstance(d, str) else None
        if d_obj and d_obj.month == today.month and d_obj.year == today.year:
          month_freeze.append(d_obj)
      for d_obj in month_freeze[:max_freeze]:
        approved_set.add(d_obj)
  streak = 0
  if approved_days or approved_set:
    cursor = dt.datetime.utcnow().date()
    while cursor in approved_set:
      streak += 1
      cursor -= dt.timedelta(days=1)
  week_start = dt.datetime.utcnow().date() - dt.timedelta(days=6)
  weekly_approved = sum(
    1
    for c in approved
    if (_to_day(c.get("reviewed_at") or c.get("created_at")) or dt.date.min) >= week_start
  )
  missions = [
    {
      "id": "m1",
      "title": "Get 3 approved reports this week",
      "progress": min(weekly_approved, 3),
      "target": 3,
      "done": weekly_approved >= 3,
    },
    {
      "id": "m2",
      "title": "Reach $100 lifetime earned",
      "progress": min(lifetime_earned, 100),
      "target": 100,
      "done": lifetime_earned >= 100,
    },
    {
      "id": "m3",
      "title": "Keep 3-day streak",
      "progress": min(streak, 3),
      "target": 3,
      "done": streak >= 3,
    },
  ]
  paid_withdrawals = [w for w in withdrawals_raw if str(w.get("status")) == "paid"]
  withdrawn = int(sum(int(w.get("amount_usd") or 0) for w in paid_withdrawals))
  available = max(lifetime_earned - withdrawn, 0)
  streak_freeze_used = 0
  streak_freeze_remaining = 0
  if user_id:
    cfg = REWARD_DATA.get("gamification_config") or {}
    max_freeze = int(cfg.get("streak_freeze_per_month") or 1)
    user = REWARD_DATA.get("users", {}).get(user_id) or {}
    freeze_dates_raw = user.get("streak_freeze_dates") or []
    if isinstance(freeze_dates_raw, list):
      today = dt.datetime.utcnow().date()
      month_freeze = []
      for d in freeze_dates_raw:
        d_obj = _to_date(d) if isinstance(d, str) else None
        if d_obj and d_obj.month == today.month and d_obj.year == today.year:
          month_freeze.append(d_obj)
      streak_freeze_used = len(month_freeze)
      streak_freeze_remaining = max(0, max_freeze - streak_freeze_used)
  quality_score = 0
  if reviewed_total >= 10:
    quality_score = min(100, int(trust_score) + (len(approved) // 5) * 2)
  verified = quality_score >= 70 and reviewed_total >= 20
  return {
    "xp": xp,
    "level": level,
    "badge": badge,
    "league": league,
    "streak_days": streak,
    "streak_freeze_used": streak_freeze_used,
    "streak_freeze_remaining": streak_freeze_remaining,
    "trust_score": trust_score,
    "quality_score": quality_score,
    "verified": verified,
    "reviewed_total": reviewed_total,
    "weekly_approved": weekly_approved,
    "lifetime_earned_usd": lifetime_earned,
    "withdrawn_usd": withdrawn,
    "available_usd": available,
    "missions": missions,
  }


def _reward_add_event(user_id: str, event_type: str, title: str, meta: Optional[Dict] = None):
  _ensure_reward_data_loaded()
  event_id = int(REWARD_DATA.get("next_event_id") or 1)
  REWARD_DATA["next_event_id"] = event_id + 1
  item = {
    "id": event_id,
    "user_id": str(user_id or ""),
    "type": str(event_type or "").strip(),
    "title": str(title or "").strip()[:180],
    "time": _now_iso(),
    "meta": meta if isinstance(meta, dict) else {},
  }
  events = REWARD_DATA.setdefault("events", [])
  events.append(item)
  if len(events) > 4000:
    del events[: len(events) - 4000]
  _save_reward_data()


def _assist_for_claim(claim: Dict) -> Dict:
  uid = str(claim.get("user_id") or "")
  claims_user = [
    c
    for c in REWARD_DATA.get("claims", {}).values()
    if str(c.get("user_id")) == uid
  ]
  withdrawals_user = [
    w
    for w in REWARD_DATA.get("withdrawals", {}).values()
    if str(w.get("user_id")) == uid
  ]
  gm = _compute_gamification(claims_user, withdrawals_user)
  evidence = str(claim.get("evidence") or "").strip()
  note = str(claim.get("note") or "").strip()
  uname = str(claim.get("suspect_username") or "").lower()
  evidence_score = 35 if evidence else 10
  note_score = 20 if len(note) >= 30 else 8
  username_risk = 25 if any(k in uname for k in ["bot", "fake", "spam", "scam"]) else 10
  trust_score = float(gm.get("trust_score") or 0.0)
  priority_score = int(evidence_score + note_score + username_risk + (trust_score * 0.35))
  risk_tag = "HIGH" if priority_score >= 75 else "MEDIUM" if priority_score >= 45 else "LOW"
  summary = (
    f"Evidence: {'yes' if evidence else 'no'} | "
    f"reporter trust: {trust_score:.1f}% | "
    f"username risk: {risk_tag}"
  )
  verification = _compute_verification_quest(claims_user, trust_score)
  ai_profile = claim.get("ai_profile") if isinstance(claim.get("ai_profile"), dict) else _build_claim_ai_profile(claim)
  top_signal_labels = [str(s.get("label") or "") for s in (ai_profile.get("signals") or [])[:3]]
  return {
    "priority_score": priority_score,
    "risk_tag": risk_tag,
    "summary": summary,
    "reporter_trust_score": trust_score,
    "reporter_level": int(gm.get("level") or 1),
    "reporter_badge": gm.get("badge") or "Rookie",
    "fast_lane": bool(verification.get("fast_lane")),
    "top_signals": top_signal_labels,
  }


def _touch_operator():
  global OPERATOR_LAST_SEEN_AT
  OPERATOR_LAST_SEEN_AT = time.time()


def _operator_online() -> bool:
  return (time.time() - OPERATOR_LAST_SEEN_AT) < 35


def _create_support_session(name: str = "") -> Dict:
  _ensure_support_loaded()
  sid = uuid.uuid4().hex[:12]
  now = _now_iso()
  session = {
    "id": sid,
    "name": (name or "").strip(),
    "status": "open",
    "created_at": now,
    "updated_at": now,
    "messages": [],
    "last_operator_read_id": 0,
  }
  SUPPORT_SESSIONS[sid] = session
  _save_support_sessions()
  return session


def _append_support_message(session: Dict, role: str, content: str) -> Dict:
  global SUPPORT_NEXT_MSG_ID
  msg = {
    "id": SUPPORT_NEXT_MSG_ID,
    "role": role,
    "content": str(content or "").strip(),
    "time": _now_iso(),
  }
  SUPPORT_NEXT_MSG_ID += 1
  session.setdefault("messages", []).append(msg)
  session["updated_at"] = _now_iso()
  _save_support_sessions()
  return msg


def _messages_after(session: Dict, after_id: int) -> List[Dict]:
  return [m for m in session.get("messages", []) if int(m.get("id", 0)) > after_id]


@app.route("/support/session", methods=["POST"])
def support_create_session():
  payload = request.get_json(silent=True) or {}
  session = _create_support_session(str(payload.get("name") or ""))
  return jsonify(
    {
      "session_id": session["id"],
      "status": session["status"],
      "messages": session["messages"],
      "operator_online": _operator_online(),
    }
  )


@app.route("/support/session/<session_id>/messages", methods=["GET"])
def support_get_messages(session_id: str):
  _ensure_support_loaded()
  session = SUPPORT_SESSIONS.get(session_id)
  if not session:
    return jsonify({"error": "Session not found."}), 404
  try:
    after_id = int(request.args.get("after_id", "0"))
  except Exception:
    after_id = 0
  return jsonify(
    {
      "session_id": session_id,
      "status": session.get("status", "open"),
      "messages": _messages_after(session, after_id),
      "operator_online": _operator_online(),
    }
  )


@app.route("/support/session/<session_id>/message", methods=["POST"])
def support_send_user_message(session_id: str):
  _ensure_support_loaded()
  session = SUPPORT_SESSIONS.get(session_id)
  if not session:
    return jsonify({"error": "Session not found."}), 404
  if session.get("status") == "closed":
    return jsonify({"error": "Session is closed."}), 409
  payload = request.get_json(silent=True) or {}
  content = str(payload.get("message") or "").strip()
  if not content:
    return jsonify({"error": "message is required."}), 400
  msg = _append_support_message(session, "user", content)
  return jsonify({"ok": True, "message": msg})


@app.route("/support/operator/status", methods=["GET"])
def support_operator_status():
  return jsonify({"online": _operator_online()})


@app.route("/support/operator/ping", methods=["POST"])
def support_operator_ping():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _touch_operator()
  return jsonify({"online": True})


@app.route("/support/operator/sessions", methods=["GET"])
def support_operator_sessions():
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_support_loaded()
  _touch_operator()
  items = []
  for s in SUPPORT_SESSIONS.values():
    msgs = s.get("messages", [])
    last = msgs[-1] if msgs else None
    unread = len(
      [
        m
        for m in msgs
        if m.get("role") == "user"
        and int(m.get("id", 0)) > int(s.get("last_operator_read_id", 0))
      ]
    )
    items.append(
      {
        "id": s.get("id"),
        "name": s.get("name", ""),
        "status": s.get("status", "open"),
        "created_at": s.get("created_at"),
        "updated_at": s.get("updated_at"),
        "last_message": (last or {}).get("content", ""),
        "last_role": (last or {}).get("role", ""),
        "total_messages": len(msgs),
        "unread": unread,
      }
    )
  items.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
  return jsonify({"sessions": items, "operator_online": True})


@app.route("/support/operator/session/<session_id>/messages", methods=["GET"])
def support_operator_get_messages(session_id: str):
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_support_loaded()
  session = SUPPORT_SESSIONS.get(session_id)
  if not session:
    return jsonify({"error": "Session not found."}), 404
  _touch_operator()
  try:
    after_id = int(request.args.get("after_id", "0"))
  except Exception:
    after_id = 0
  msgs = _messages_after(session, after_id)
  if session.get("messages"):
    session["last_operator_read_id"] = int(session["messages"][-1].get("id", 0))
    _save_support_sessions()
  return jsonify(
    {
      "session_id": session_id,
      "status": session.get("status", "open"),
      "messages": msgs,
    }
  )


@app.route("/support/operator/session/<session_id>/message", methods=["POST"])
def support_operator_send_message(session_id: str):
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_support_loaded()
  session = SUPPORT_SESSIONS.get(session_id)
  if not session:
    return jsonify({"error": "Session not found."}), 404
  payload = request.get_json(silent=True) or {}
  content = str(payload.get("message") or "").strip()
  if not content:
    return jsonify({"error": "message is required."}), 400
  _touch_operator()
  msg = _append_support_message(session, "operator", content)
  session["last_operator_read_id"] = int(msg.get("id", 0))
  _save_support_sessions()
  return jsonify({"ok": True, "message": msg})


@app.route("/support/operator/session/<session_id>/status", methods=["POST"])
def support_operator_set_status(session_id: str):
  if not _require_admin(request):
    return jsonify({"error": "Unauthorized"}), 401
  _ensure_support_loaded()
  session = SUPPORT_SESSIONS.get(session_id)
  if not session:
    return jsonify({"error": "Session not found."}), 404
  payload = request.get_json(silent=True) or {}
  status = str(payload.get("status") or "").strip().lower()
  if status not in ("open", "closed"):
    return jsonify({"error": "status must be open or closed"}), 400
  session["status"] = status
  session["updated_at"] = _now_iso()
  _touch_operator()
  _save_support_sessions()
  return jsonify({"ok": True, "status": status})

SYSTEM_PROMPT = """You are Sentinel AI, the assistant for Fake Account Lab.

Goals:
- Give practical, accurate answers about fake-account detection, dataset analysis, security, and product usage.
- Explain results in plain language and provide actionable next steps.
- Match the user's language (English, Persian/Farsi, or Arabic).
- If user asks outside project scope, still answer helpfully and honestly.

Style:
- Clear and direct.
- Structured when useful (short bullets).
- Avoid hallucinations; say when something is unknown."""

CLAUDE_SYSTEM_PROMPT = """You are Sentinel Claude Assistant.
Answer clearly and accurately.
Prefer concise, actionable responses unless the user asks for detailed explanation.
Use the same language as the user whenever possible."""


def _dataset_context_text() -> str:
  summary = (LATEST_SUMMARY or {}).get("summary") or {}
  results = LATEST_RESULTS or []
  if not summary and not results:
    return "No dataset loaded yet."
  total = int(summary.get("total") or len(results) or 0)
  fake = int(summary.get("fake") or sum(1 for r in results if r.get("is_fake")))
  real = int(summary.get("real") or max(total - fake, 0))
  avg = summary.get("avg_fake_probability")
  if avg is None and results:
    avg = sum(r.get("fake_probability") or 0 for r in results) / max(len(results), 1)
  risk = summary.get("risk_levels") or {}
  low = int(risk.get("low", 0))
  mid = int(risk.get("medium", 0))
  high = int(risk.get("high", 0))
  bot_rings = int(summary.get("bot_ring_count", 0))
  avg_txt = f"{(avg * 100):.1f}%" if avg is not None else "unknown"
  return (
    f"Dataset summary: total={total}, fake={fake}, real={real}, "
    f"avg_fake_probability={avg_txt}, "
    f"risk(low={low}, medium={mid}, high={high}), bot_rings={bot_rings}."
  )


def _load_chatbot_survey_dataset() -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame]]:
  global CHATBOT_SURVEY_DF, CHATBOT_SURVEY_DF_CODED, CHATBOT_SURVEY_LOAD_ERROR
  if CHATBOT_SURVEY_DF is not None and CHATBOT_SURVEY_DF_CODED is not None:
    return CHATBOT_SURVEY_DF, CHATBOT_SURVEY_DF_CODED
  if CHATBOT_SURVEY_LOAD_ERROR is not None:
    return None, None
  try:
    if not CHATBOT_SURVEY_FILE.exists() or not CHATBOT_SURVEY_FILE_CODED.exists():
      CHATBOT_SURVEY_LOAD_ERROR = "Survey dataset files not found."
      return None, None
    CHATBOT_SURVEY_DF = pd.read_csv(CHATBOT_SURVEY_FILE, sep=";", dtype=str, encoding="utf-8")
    CHATBOT_SURVEY_DF_CODED = pd.read_csv(CHATBOT_SURVEY_FILE_CODED, sep=";", encoding="utf-8")
    return CHATBOT_SURVEY_DF, CHATBOT_SURVEY_DF_CODED
  except Exception as exc:
    CHATBOT_SURVEY_LOAD_ERROR = str(exc)
    return None, None


def _survey_top_counts(df: pd.DataFrame, col: str, top_n: int = 5) -> str:
  if col not in df.columns:
    return "N/A"
  series = df[col].fillna("").astype(str).str.strip()
  series = series[series != ""]
  if series.empty:
    return "N/A"
  top = series.value_counts().head(top_n)
  return ", ".join([f"{k} ({v})" for k, v in top.items()])


def _survey_avg_likert(df_coded: pd.DataFrame, prefix: str) -> Optional[float]:
  cols = [c for c in df_coded.columns if c.startswith(prefix)]
  if not cols:
    return None
  sub = df_coded[cols].apply(pd.to_numeric, errors="coerce")
  if sub.empty:
    return None
  val = float(np.nanmean(sub.values))
  if np.isnan(val):
    return None
  return val


def _survey_reply(user_text: str) -> str:
  df, df_coded = _load_chatbot_survey_dataset()
  if df is None or df_coded is None:
    return "دیتاست نظرسنجی چت‌بات لود نشد. مسیر فایل را بررسی کن."

  q = (user_text or "").strip().lower()
  n = len(df)
  if n == 0:
    return "دیتاست نظرسنجی خالی است."

  degree_top = _survey_top_counts(df, "Q1", 3)
  major_top = _survey_top_counts(df, "Q2", 5)
  gender_top = _survey_top_counts(df, "Q3", 3)
  usage_top = _survey_top_counts(df, "Q4", 5)

  avg_q5 = _survey_avg_likert(df_coded, "Q5.")
  avg_q6 = _survey_avg_likert(df_coded, "Q6.")
  avg_q7 = _survey_avg_likert(df_coded, "Q7.")
  avg_q8 = _survey_avg_likert(df_coded, "Q8.")
  avg_q9 = _survey_avg_likert(df_coded, "Q9.")
  fmt = lambda x: f"{x:.2f}" if x is not None else "N/A"

  if any(k in q for k in ["gender", "جنس", "female", "male"]):
    return f"توزیع جنسیت در دیتاست ({n} پاسخ): {gender_top}."
  if any(k in q for k in ["major", "رشته", "field", "department"]):
    return f"پرتکرارترین رشته‌ها در دیتاست: {major_top}."
  if any(k in q for k in ["degree", "مقطع", "bachelor", "master"]):
    return f"توزیع مقطع تحصیلی: {degree_top}."
  if any(k in q for k in ["usage", "استفاده", "often", "rarely", "frequency"]):
    return f"الگوی استفاده از چت‌بات (Q4): {usage_top}."
  if any(k in q for k in ["attitude", "نگرش", "perception", "نظر", "رضایت"]):
    return (
      f"میانگین امتیاز نگرش/اثر (Likert 1-5): "
      f"Q5={fmt(avg_q5)}، Q6={fmt(avg_q6)}، Q7={fmt(avg_q7)}، Q8={fmt(avg_q8)}، Q9={fmt(avg_q9)}."
    )
  if any(k in q for k in ["comment", "کامنت", "نظرات", "q10"]):
    comments = (
      df["Q10"].fillna("").astype(str).str.strip()
      if "Q10" in df.columns
      else pd.Series([], dtype=str)
    )
    comments = comments[comments != ""].head(3).tolist()
    if not comments:
      return "نظر متنی در Q10 ثبت نشده است."
    return "نمونه‌ای از نظرات دانشجویان:\n- " + "\n- ".join(comments)

  return (
    f"خلاصه دیتاست «Impact of Conversational Chatbots...»: {n} پاسخ.\n"
    f"- مقطع: {degree_top}\n"
    f"- جنسیت: {gender_top}\n"
    f"- فراوانی استفاده: {usage_top}\n"
    f"- میانگین Likert: Q5={fmt(avg_q5)}, Q6={fmt(avg_q6)}, Q7={fmt(avg_q7)}, Q8={fmt(avg_q8)}, Q9={fmt(avg_q9)}\n"
    f"برای جزئیات بیشتر بپرسید: جنسیت، رشته، مقطع، فراوانی استفاده، نگرش، یا نظرات Q10."
  )


def _local_chat_reply(user_text: str) -> str:
  """Local fallback answer when external LLM is unavailable."""
  msg = (user_text or "").strip()
  if not msg:
    return "پیام شما خالی است. لطفاً پرسش خود را واضح‌تر بنویسید تا پاسخ دقیق‌تری ارائه شود."
  m = msg.lower()
  if any(k in m for k in ["hi", "hello", "سلام", "درود", "hey"]):
    return "سلام. من دستیار Sentinel هستم و می‌توانم درباره تحلیل اکانت‌های فیک، فایل CSV، دقت مدل، داشبورد و موضوعات امنیتی کمک کنم."
  if any(k in m for k in ["help", "راهنما", "چی کار", "how to"]):
    return (
      "راهنمای شروع سریع:\n"
      "1) به صفحه Analyze بروید و CSV آپلود کنید یا داده دمو را بارگذاری کنید.\n"
      "2) خروجی‌های Fake Probability، Trust Score و Risk Level را بررسی کنید.\n"
      "3) برای موارد مشکوک بازخورد fake/real ثبت کنید تا دقت سیستم بیشتر شود.\n"
      "4) برای پرسش آماری، درباره تعداد فیک‌ها، میانگین احتمال و توزیع ریسک سؤال بپرسید."
    )
  if any(k in m for k in ["instagram", "اینستاگرام"]):
    return (
      "برای تحلیل دقیق‌تر اینستاگرام، نام کاربری معتبر را بدون کاراکتر اضافی وارد کنید، "
      "چند نمونه را با هم مقایسه کنید و برای خروجی‌های نادرست بازخورد ثبت کنید."
    )
  if any(k in m for k in ["student", "دانشجو", "university", "learning", "chatbot", "چت بات", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"]):
    return _survey_reply(msg)
  # Fallback to project dataset-grounded short answer.
  return _dataset_reply(msg)


def _try_ollama_chat(api_messages: List[Dict[str, str]]) -> Optional[str]:
  """Call local Ollama chat endpoint. Returns None on any failure."""
  if not OLLAMA_ENABLED or not OLLAMA_MODEL:
    return None
  payload = {
    "model": OLLAMA_MODEL,
    "messages": api_messages,
    "stream": False,
    "options": {"temperature": 0.5},
  }
  req = urlrequest.Request(
    f"{OLLAMA_BASE_URL}/api/chat",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
  )
  try:
    with urlrequest.urlopen(req, timeout=OLLAMA_TIMEOUT_SEC) as resp:
      raw = resp.read().decode("utf-8", errors="replace")
      data = json.loads(raw or "{}")
      content = (
        (data.get("message") or {}).get("content")
        or data.get("response")
        or ""
      )
      content = str(content).strip()
      return content or None
  except (urlerror.URLError, TimeoutError, ValueError, OSError):
    return None


def _try_claude_chat(messages: List[Dict[str, str]]) -> Tuple[Optional[str], Optional[str]]:
  """Call Anthropic Claude API. Returns (content, error_message)."""
  if not CLAUDE_API_KEY:
    return None, "CLAUDE_API_KEY is missing in backend .env."
  normalized: List[Dict[str, str]] = []
  for m in messages[-20:]:
    role = str(m.get("role") or "user").lower()
    if role not in ("user", "assistant"):
      role = "user"
    content = str(m.get("content") or "").strip()
    if content:
      normalized.append({"role": role, "content": content})
  if not normalized:
    return None, "At least one message is required."
  payload = {
    "model": CLAUDE_MODEL,
    "system": CLAUDE_SYSTEM_PROMPT,
    "max_tokens": 1024,
    "temperature": 0.55,
    "messages": normalized,
  }
  req = urlrequest.Request(
    CLAUDE_BASE_URL,
    data=json.dumps(payload).encode("utf-8"),
    headers={
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    method="POST",
  )
  try:
    with urlrequest.urlopen(req, timeout=45) as resp:
      raw = resp.read().decode("utf-8", errors="replace")
      data = json.loads(raw or "{}")
      blocks = data.get("content") or []
      if isinstance(blocks, list):
        for item in blocks:
          if isinstance(item, dict) and item.get("type") == "text":
            text = str(item.get("text") or "").strip()
            if text:
              return text, None
      return None, "Claude returned an empty response."
  except urlerror.HTTPError as exc:
    try:
      raw = exc.read().decode("utf-8", errors="replace")
      data = json.loads(raw or "{}")
      err = (data.get("error") or {}).get("message") or raw
      return None, f"Claude API error: {str(err)[:220]}"
    except Exception:
      return None, f"Claude API error: HTTP {exc.code}"
  except (urlerror.URLError, TimeoutError, ValueError, OSError) as exc:
    return None, f"Claude request failed: {str(exc)[:220]}"


@app.route("/chat/claude", methods=["POST"])
def chat_claude():
  payload = request.get_json(silent=True) or {}
  messages = payload.get("messages") or []
  if not isinstance(messages, list):
    return jsonify({"error": "messages must be an array."}), 400
  content, err = _try_claude_chat(messages)
  if err:
    return jsonify({"error": err}), 400
  return jsonify({"message": content, "role": "assistant", "source": "claude"})


@app.route("/chat", methods=["POST"])
def chat():
  payload = request.get_json(silent=True) or {}
  messages = payload.get("messages") or []
  if not isinstance(messages, list):
    return jsonify({"error": "messages must be an array."}), 400

  clean_messages: List[Dict[str, str]] = []
  for m in messages[-20:]:
    role = str(m.get("role") or "user").lower()
    if role not in ("user", "assistant"):
      role = "user"
    content = str(m.get("content") or "").strip()
    if content:
      clean_messages.append({"role": role, "content": content})

  user_msgs = [m["content"] for m in clean_messages if m["role"] == "user"]
  if not user_msgs:
    return jsonify({"error": "At least one user message is required."}), 400
  user_text = user_msgs[-1]

  api_messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "system", "content": _dataset_context_text()},
  ]
  api_messages.extend(clean_messages)

  # 1) Cloud LLM (if configured)
  if OPENAI_API_KEY and OpenAI is not None:
    try:
      base_url = GAPGPT_BASE_URL if USE_GAPGPT else CHAT_API_BASE_URL
      client_kw = {"api_key": OPENAI_API_KEY}
      if base_url:
        client_kw["base_url"] = base_url
      client = OpenAI(**client_kw)
      resp = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=api_messages,
        max_tokens=1024,
        temperature=0.55,
      )
      choice = (resp.choices or [None])[0]
      if choice and getattr(choice, "message", None):
        content = str(choice.message.content or "").strip()
        if content:
          return jsonify({"message": content, "role": "assistant", "source": "llm"})
    except Exception:
      pass

  # 2) Local LLM via Ollama (no API key required)
  ollama_text = _try_ollama_chat(api_messages)
  if ollama_text:
    return jsonify({"message": ollama_text, "role": "assistant", "source": "ollama"})

  # 3) Deterministic local fallback
  return jsonify({"message": _local_chat_reply(user_text), "role": "assistant", "source": "local"})


def _dataset_reply(user_text: str) -> str:
  """پاسخ بر اساس دیتاست آپلود/دمو — بدون نیاز به API خارجی."""
  summary = (LATEST_SUMMARY or {}).get("summary") or {}
  results = LATEST_RESULTS or []
  if not results and not summary:
    return "هنوز دیتاستی بارگذاری نشده است. از صفحه Analyze یک CSV آپلود کنید یا گزینه «Load Demo» را بزنید، سپس دوباره سؤال بپرسید."
  total = summary.get("total") or len(results)
  if total == 0:
    return "دیتاست خالی است. لطفاً یک فایل CSV معتبر آپلود کنید."
  fake = summary.get("fake") or sum(1 for r in results if r.get("is_fake"))
  real = summary.get("real") or (total - fake)
  avg = summary.get("avg_fake_probability")
  if avg is None and results:
    avg = sum(r.get("fake_probability") or 0 for r in results) / len(results)
  avg_pct = f"{(avg * 100):.1f}%" if avg is not None else "—"
  risk = summary.get("risk_levels") or {}
  low = risk.get("low", 0)
  mid = risk.get("medium", 0)
  high = risk.get("high", 0)
  bot_rings = summary.get("bot_ring_count", 0)
  msg_lower = (user_text or "").strip().lower()
  mentioned = re.findall(r"@?([a-zA-Z0-9._-]{3,32})", msg_lower)
  if results and mentioned:
    tokens = [t for t in mentioned if t not in {"risk", "fake", "real", "count", "total"}]
    for token in tokens[:3]:
      match = next(
        (
          r for r in results
          if str(r.get("username") or r.get("user_id") or "").lower() == token.lower()
          or token.lower() in str(r.get("username") or r.get("user_id") or "").lower()
        ),
        None,
      )
      if match:
        prob = float(match.get("fake_probability") or 0) * 100
        trust = float(match.get("trust_score") or (100 - prob))
        level = match.get("risk_level", "LOW")
        label = "فیک" if bool(match.get("is_fake")) else "واقعی"
        return (
          f"تحلیل @{token}: برچسب {label}، احتمال فیک {prob:.1f}%، "
          f"امتیاز اعتماد {trust:.0f}/100، سطح ریسک {level}."
        )
  if any(w in msg_lower for w in ["چند", "تعداد", "چقدر", "چند تا", "number", "count", "how many", "total"]):
    return f"در این دیتاست: {total} اکانت، {fake} فیک و {real} واقعی شناسایی شده است. میانگین احتمال فیک: {avg_pct}. ریسک کم: {low}، متوسط: {mid}، بالا: {high}. تعداد بات‌رینگ: {bot_rings}."
  if any(w in msg_lower for w in ["میانگین", "average", "avg", "probability", "احتمال"]):
    return f"میانگین احتمال فیک: {avg_pct}. از مجموع {total} اکانت، {fake} مورد فیک و {real} مورد واقعی تشخیص داده شده است."
  if any(w in msg_lower for w in ["ریسک", "risk", "سطح"]):
    return f"توزیع ریسک: کم {low}، متوسط {mid}، بالا {high}. تعداد بات‌رینگ: {bot_rings}."
  if any(w in msg_lower for w in ["top", "ریسکی", "مشکوک", "خطرناک"]):
    risky = sorted(results, key=lambda r: r.get("fake_probability", 0), reverse=True)[:5]
    if not risky:
      return f"خلاصه دیتاست: {total} اکانت، {fake} فیک و {real} واقعی. میانگین احتمال فیک: {avg_pct}."
    lines = []
    for idx, r in enumerate(risky, start=1):
      name = r.get("username") or r.get("user_id") or f"user_{idx}"
      prob = float(r.get("fake_probability") or 0) * 100
      lines.append(f"{idx}) {name} — {prob:.1f}%")
    return "۵ حساب با بیشترین ریسک:\n" + "\n".join(lines)
  return f"خلاصه دیتاست: {total} اکانت، {fake} فیک و {real} واقعی. میانگین احتمال فیک: {avg_pct}. توزیع ریسک: کم {low}، متوسط {mid}، بالا {high}."


@app.route("/chat/dataset", methods=["POST"])
def chat_dataset():
  """چت بر اساس دیتاست فعلی — بدون API."""
  payload = request.get_json(silent=True) or {}
  msg = (payload.get("message") or payload.get("content") or "").strip()
  if not msg and isinstance(payload.get("messages"), list):
    user_msgs = [
      str(m.get("content") or "").strip()
      for m in payload.get("messages")
      if str(m.get("role") or "").lower() == "user" and str(m.get("content") or "").strip()
    ]
    msg = user_msgs[-1] if user_msgs else ""
  # Prioritize the user-requested university chatbot survey dataset.
  reply = _survey_reply(msg)
  return jsonify({"message": reply, "role": "assistant", "source": "dataset"})


RESULT_FEEDBACK_PATH = Path(__file__).resolve().parent / "result_feedback.json"
RESULT_FEEDBACK: Dict[str, Dict] = {}
if RESULT_FEEDBACK_PATH.exists():
  try:
    RESULT_FEEDBACK = json.loads(RESULT_FEEDBACK_PATH.read_text(encoding="utf-8"))
  except Exception:
    RESULT_FEEDBACK = {}


@app.route("/feedback", methods=["POST"])
def submit_feedback():
  """ثبت فیدبک درست/اشتباه برای یک نتیجه (user_id + correct: true/false)."""
  payload = request.get_json(silent=True) or {}
  user_id = (payload.get("user_id") or payload.get("username") or "").strip()
  correct = payload.get("correct")
  if not user_id:
    return jsonify({"error": "user_id or username is required."}), 400
  if correct not in (True, False):
    return jsonify({"error": "correct must be true or false."}), 400
  key = str(user_id).lower()
  RESULT_FEEDBACK[key] = {"correct": bool(correct), "at": dt.datetime.utcnow().isoformat() + "Z"}
  try:
    RESULT_FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULT_FEEDBACK_PATH.write_text(json.dumps(RESULT_FEEDBACK, ensure_ascii=False, indent=2), encoding="utf-8")
  except Exception:
    pass
  return jsonify({"ok": True, "user_id": key})


USER_FEEDBACK_PATH = Path(__file__).resolve().parent / "user_feedback.json"
USER_FEEDBACK_LIST: List[Dict] = []


def _load_user_feedback():
  global USER_FEEDBACK_LIST
  if USER_FEEDBACK_PATH.exists():
    try:
      raw = json.loads(USER_FEEDBACK_PATH.read_text(encoding="utf-8"))
      USER_FEEDBACK_LIST = raw if isinstance(raw, list) else []
    except Exception:
      USER_FEEDBACK_LIST = []


def _save_user_feedback():
  try:
    USER_FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    USER_FEEDBACK_PATH.write_text(json.dumps(USER_FEEDBACK_LIST[-500:], ensure_ascii=False, indent=2), encoding="utf-8")
  except Exception:
    pass


if USER_FEEDBACK_PATH.exists():
  _load_user_feedback()


@app.route("/feedback/form", methods=["POST"])
def submit_user_feedback():
  """ثبت پیشنهاد یا گزارش باگ از کاربر."""
  payload = request.get_json(silent=True) or {}
  feedback_type = str(payload.get("type") or "suggestion").strip().lower()
  if feedback_type not in ("suggestion", "bug", "other"):
    feedback_type = "suggestion"
  message = str(payload.get("message") or "").strip()
  if not message or len(message) < 5:
    return jsonify({"error": "Message must be at least 5 characters."}), 400
  user = _require_user(request)
  entry = {
    "id": len(USER_FEEDBACK_LIST) + 1,
    "type": feedback_type,
    "message": message[:2000],
    "user_id": str(user.get("id", "")) if user else "",
    "email": str(payload.get("email") or "").strip()[:120] if not user else (user.get("email") or ""),
    "created_at": dt.datetime.utcnow().isoformat() + "Z",
  }
  USER_FEEDBACK_LIST.append(entry)
  _save_user_feedback()
  return jsonify({"ok": True, "id": entry["id"]})


@app.route("/stats/overview", methods=["GET"])
def stats_overview():
  """آمار کلی برای نمودارها - گزارش‌ها در طول زمان، میانگین احتمال فیک."""
  _ensure_reward_data_loaded()
  claims = list(REWARD_DATA.get("claims") or {}).values()
  now = dt.datetime.utcnow().date()
  daily = {}
  for i in range(30):
    d = (now - dt.timedelta(days=29 - i)).isoformat()
    daily[d] = {"date": d, "reports": 0, "approved": 0, "fake_detected": 0}
  for c in claims:
    day = (_to_day(c.get("created_at") or c.get("reviewed_at")) or now).isoformat()
    if day not in daily:
      daily[day] = {"date": day, "reports": 0, "approved": 0, "fake_detected": 0}
    daily[day]["reports"] = daily[day].get("reports", 0) + 1
    if str(c.get("status")) == "approved":
      daily[day]["approved"] = daily[day].get("approved", 0) + 1
      daily[day]["fake_detected"] = daily[day].get("fake_detected", 0) + 1
  chart_data = sorted([v for v in daily.values() if v["date"]], key=lambda x: x["date"])
  this_month = sum(d["reports"] for d in chart_data if d["date"] >= (now - dt.timedelta(days=29)).isoformat())
  prev_month = sum(d["reports"] for d in chart_data if (now - dt.timedelta(days=59)).isoformat() <= d["date"] < (now - dt.timedelta(days=29)).isoformat())
  return jsonify({
    "chart": chart_data,
    "total_reports": len(claims),
    "approved_reports": sum(1 for c in claims if str(c.get("status")) == "approved"),
    "this_month": this_month,
    "prev_month": prev_month,
    "month_change_pct": round(((this_month - prev_month) / (prev_month or 1)) * 100, 1),
  })


if __name__ == "__main__":
  port = int(os.environ.get("PORT", 5000))
  app.run(host="0.0.0.0", port=port, debug=True)
