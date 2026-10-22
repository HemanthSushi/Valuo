# database.py — Lightweight, High-Performance SQLite Storage Engine for Valuo
"""
Embedded SQLite database engine replacing MongoDB.
Features:
- Zero background daemon requirement (serverless, embedded)
- Ultra-compact storage footprint (<100 KB initial file size vs >100 MB MongoDB preallocation)
- Write-Ahead Logging (WAL) mode enabled for high-concurrency read/write operations
- Asynchronous non-blocking operations using asyncio.to_thread
- Comprehensive persistence for Users, Datasets metadata, Models, and Prediction logs
- Automatic discovery & indexing of legacy/workspace datasets
"""

import sqlite3
import os
import json
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

logger = logging.getLogger("valuo-database")

# Default database location inside workspace
ROOT_DIR = Path(__file__).parent
WORKSPACE_DIR = ROOT_DIR / "workspace"
WORKSPACE_DIR.mkdir(exist_ok=True)

DEFAULT_DB_PATH = WORKSPACE_DIR / "valuo.db"
DB_PATH = Path(os.getenv("SQLITE_DB_PATH", str(DEFAULT_DB_PATH)))

def get_db_path() -> Path:
    env_path = os.getenv("SQLITE_DB_PATH")
    if env_path:
        p = Path(env_path)
        return p if p.is_absolute() else ROOT_DIR / p
    return DEFAULT_DB_PATH

def get_connection() -> sqlite3.Connection:
    """Create a configured SQLite connection with WAL mode and row factory."""
    db_file = get_db_path()
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(
        str(db_file),
        check_same_thread=False,
        timeout=30.0
    )
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrency (non-blocking reads while writing)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    return conn

def init_db():
    """Initialize database tables, indexes, and synchronize workspace datasets."""
    conn = get_connection()
    try:
        with conn:
            # 1. Users Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")

            # 2. Datasets Metadata Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS datasets (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    rows INTEGER NOT NULL,
                    columns INTEGER NOT NULL,
                    file_path TEXT NOT NULL,
                    column_names_json TEXT NOT NULL,
                    user_id TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_datasets_user ON datasets(user_id);")

            # 3. Models Performance Leaderboard Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS models (
                    id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    rmse REAL NOT NULL,
                    mae REAL NOT NULL,
                    r2 REAL NOT NULL,
                    mape REAL DEFAULT 0.0,
                    train_time REAL DEFAULT 0.0,
                    is_best INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_models_dataset ON models(dataset_id);")

            # 4. Predictions Audit Log Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    inputs_json TEXT NOT NULL,
                    prediction_value REAL NOT NULL,
                    actual_value REAL,
                    difference REAL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_predictions_dataset ON predictions(dataset_id);")

            # 5. System Metadata Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS system_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)
            conn.execute(
                "INSERT OR REPLACE INTO system_meta (key, value) VALUES ('db_engine', 'SQLite-WAL');"
            )
            conn.execute(
                "INSERT OR IGNORE INTO system_meta (key, value) VALUES ('initialized_at', ?);",
                (datetime.now(timezone.utc).isoformat(),)
            )

        # Sync existing workspace datasets into SQLite
        _sync_workspace_datasets(conn)
        logger.info(f"SQLite database initialized successfully at: {get_db_path()} with WAL mode.")
    finally:
        conn.close()

def _sync_workspace_datasets(conn: sqlite3.Connection):
    """Scan existing workspace directories and register any datasets and models."""
    try:
        import pandas as pd
        for folder in WORKSPACE_DIR.iterdir():
            if folder.is_dir() and (folder / "dataset.csv").exists():
                dataset_id = folder.name
                # Check if already registered
                cur = conn.execute("SELECT id FROM datasets WHERE id = ?", (dataset_id,))
                if cur.fetchone() is None:
                    csv_path = folder / "dataset.csv"
                    try:
                        df = pd.read_csv(csv_path, nrows=5)
                        # Count total lines safely
                        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
                            total_rows = max(0, sum(1 for _ in f) - 1)
                        cols = list(df.columns)
                        conn.execute("""
                            INSERT OR IGNORE INTO datasets
                            (id, filename, rows, columns, file_path, column_names_json, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (
                            dataset_id,
                            "dataset.csv",
                            total_rows,
                            len(cols),
                            str(csv_path),
                            json.dumps(cols),
                            datetime.now(timezone.utc).isoformat()
                        ))
                    except Exception as e:
                        logger.warning(f"Could not index existing dataset {dataset_id}: {e}")

                # Check if trained models metadata exists
                candidates_file = folder / "model_candidates.json"
                if candidates_file.exists():
                    try:
                        with open(candidates_file, "r") as f:
                            model_data = json.load(f)
                        best_model = model_data.get("best_model", "")
                        for m in model_data.get("models", []):
                            m_name = m.get("model_name", "")
                            # Check if model already recorded
                            chk = conn.execute(
                                "SELECT id FROM models WHERE dataset_id = ? AND model_name = ?",
                                (dataset_id, m_name)
                            )
                            if chk.fetchone() is None:
                                conn.execute("""
                                    INSERT INTO models
                                    (id, dataset_id, model_name, rmse, mae, r2, mape, train_time, is_best, created_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, (
                                    str(uuid.uuid4()),
                                    dataset_id,
                                    m_name,
                                    float(m.get("rmse", 0.0)),
                                    float(m.get("mae", 0.0)),
                                    float(m.get("r2", 0.0)),
                                    float(m.get("mape", 0.0) or 0.0),
                                    float(m.get("train_time", 0.0) or 0.0),
                                    1 if m_name == best_model else 0,
                                    datetime.now(timezone.utc).isoformat()
                                ))
                    except Exception as e:
                        logger.warning(f"Could not index existing models for {dataset_id}: {e}")
        conn.commit()
    except Exception as e:
        logger.warning(f"Workspace dataset sync encountered error: {e}")

# --- Synchronous Internal Operations -----------------------------------------

def _create_user_sync(user_id: str, name: str, email: str, hashed_password: str) -> dict:
    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute("""
                INSERT INTO users (id, name, email, hashed_password, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, name, email, hashed_password, now))
        return {
            "id": user_id,
            "name": name,
            "email": email,
            "hashed_password": hashed_password,
            "created_at": now
        }
    finally:
        conn.close()

def _get_user_by_email_sync(email: str) -> Optional[dict]:
    conn = get_connection()
    try:
        cur = conn.execute("SELECT * FROM users WHERE email = ? LIMIT 1", (email.lower().strip(),))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def _get_user_by_id_sync(user_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        cur = conn.execute("SELECT * FROM users WHERE id = ? LIMIT 1", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def _save_dataset_sync(dataset_id: str, filename: str, rows: int, columns: int,
                       file_path: str, column_names: List[str], user_id: Optional[str] = None) -> dict:
    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        cols_json = json.dumps(column_names)
        with conn:
            conn.execute("""
                INSERT OR REPLACE INTO datasets
                (id, filename, rows, columns, file_path, column_names_json, user_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (dataset_id, filename, rows, columns, file_path, cols_json, user_id, now))
        return {
            "id": dataset_id,
            "filename": filename,
            "rows": rows,
            "columns": columns,
            "file_path": file_path,
            "column_names": column_names,
            "user_id": user_id,
            "created_at": now
        }
    finally:
        conn.close()

def _get_dataset_sync(dataset_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        cur = conn.execute("SELECT * FROM datasets WHERE id = ? LIMIT 1", (dataset_id,))
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d["column_names"] = json.loads(d.get("column_names_json", "[]"))
        except Exception:
            d["column_names"] = []
        return d
    finally:
        conn.close()

def _list_datasets_sync(user_id: Optional[str] = None, limit: int = 50) -> List[dict]:
    conn = get_connection()
    try:
        if user_id:
            cur = conn.execute(
                "SELECT * FROM datasets WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT ?",
                (user_id, limit)
            )
        else:
            cur = conn.execute("SELECT * FROM datasets ORDER BY created_at DESC LIMIT ?", (limit,))
        result = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d["column_names"] = json.loads(d.get("column_names_json", "[]"))
            except Exception:
                d["column_names"] = []
            result.append(d)
        return result
    finally:
        conn.close()

def _save_model_result_sync(dataset_id: str, model_name: str, rmse: float, mae: float,
                            r2: float, mape: float, train_time: float, is_best: bool = False) -> dict:
    conn = get_connection()
    try:
        model_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with conn:
            # If this is best, update previous best flags for this dataset
            if is_best:
                conn.execute("UPDATE models SET is_best = 0 WHERE dataset_id = ?", (dataset_id,))
            conn.execute("""
                INSERT INTO models
                (id, dataset_id, model_name, rmse, mae, r2, mape, train_time, is_best, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                model_id, dataset_id, model_name,
                float(rmse), float(mae), float(r2),
                float(mape), float(train_time),
                1 if is_best else 0, now
            ))
        return {
            "id": model_id,
            "dataset_id": dataset_id,
            "model_name": model_name,
            "rmse": rmse,
            "mae": mae,
            "r2": r2,
            "mape": mape,
            "train_time": train_time,
            "is_best": is_best,
            "created_at": now
        }
    finally:
        conn.close()

def _get_models_by_dataset_sync(dataset_id: str) -> List[dict]:
    conn = get_connection()
    try:
        cur = conn.execute(
            "SELECT * FROM models WHERE dataset_id = ? ORDER BY is_best DESC, rmse ASC",
            (dataset_id,)
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

def _save_prediction_sync(dataset_id: str, model_name: str, inputs: dict,
                          prediction_value: float, actual_value: Optional[float] = None,
                          difference: Optional[float] = None) -> dict:
    conn = get_connection()
    try:
        pred_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        inputs_str = json.dumps(inputs)
        with conn:
            conn.execute("""
                INSERT INTO predictions
                (id, dataset_id, model_name, inputs_json, prediction_value, actual_value, difference, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                pred_id, dataset_id, model_name, inputs_str,
                float(prediction_value),
                float(actual_value) if actual_value is not None else None,
                float(difference) if difference is not None else None,
                now
            ))
        return {
            "id": pred_id,
            "dataset_id": dataset_id,
            "model_name": model_name,
            "inputs": inputs,
            "prediction_value": prediction_value,
            "actual_value": actual_value,
            "difference": difference,
            "created_at": now
        }
    finally:
        conn.close()

def _get_predictions_sync(dataset_id: str, limit: int = 50) -> List[dict]:
    conn = get_connection()
    try:
        cur = conn.execute(
            "SELECT * FROM predictions WHERE dataset_id = ? ORDER BY created_at DESC LIMIT ?",
            (dataset_id, limit)
        )
        results = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d["inputs"] = json.loads(d.get("inputs_json", "{}"))
            except Exception:
                d["inputs"] = {}
            results.append(d)
        return results
    finally:
        conn.close()

def _get_db_stats_sync() -> dict:
    db_file = get_db_path()
    file_size_bytes = db_file.stat().st_size if db_file.exists() else 0
    wal_file = Path(f"{db_file}-wal")
    wal_size_bytes = wal_file.stat().st_size if wal_file.exists() else 0
    total_bytes = file_size_bytes + wal_size_bytes

    if total_bytes < 1024:
        size_str = f"{total_bytes} B"
    elif total_bytes < 1024 * 1024:
        size_str = f"{total_bytes / 1024:.1f} KB"
    else:
        size_str = f"{total_bytes / (1024 * 1024):.2f} MB"

    conn = get_connection()
    try:
        users_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        datasets_count = conn.execute("SELECT COUNT(*) FROM datasets").fetchone()[0]
        models_count = conn.execute("SELECT COUNT(*) FROM models").fetchone()[0]
        predictions_count = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
        sqlite_ver = conn.execute("SELECT sqlite_version()").fetchone()[0]

        return {
            "engine": "SQLite",
            "mode": "WAL (Write-Ahead Logging)",
            "file_path": str(db_file),
            "size_bytes": total_bytes,
            "size_formatted": size_str,
            "sqlite_version": sqlite_ver,
            "tables": {
                "users": users_count,
                "datasets": datasets_count,
                "models": models_count,
                "predictions": predictions_count
            },
            "status": "healthy"
        }
    finally:
        conn.close()

# --- Asynchronous Wrappers for FastAPI ---------------------------------------

async def create_user(user_id: str, name: str, email: str, hashed_password: str) -> dict:
    return await asyncio.to_thread(_create_user_sync, user_id, name, email, hashed_password)

async def get_user_by_email(email: str) -> Optional[dict]:
    return await asyncio.to_thread(_get_user_by_email_sync, email)

async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await asyncio.to_thread(_get_user_by_id_sync, user_id)

async def save_dataset(dataset_id: str, filename: str, rows: int, columns: int,
                       file_path: str, column_names: List[str], user_id: Optional[str] = None) -> dict:
    return await asyncio.to_thread(_save_dataset_sync, dataset_id, filename, rows, columns, file_path, column_names, user_id)

async def get_dataset(dataset_id: str) -> Optional[dict]:
    return await asyncio.to_thread(_get_dataset_sync, dataset_id)

async def list_datasets(user_id: Optional[str] = None, limit: int = 50) -> List[dict]:
    return await asyncio.to_thread(_list_datasets_sync, user_id, limit)

async def save_model_result(dataset_id: str, model_name: str, rmse: float, mae: float,
                            r2: float, mape: float, train_time: float, is_best: bool = False) -> dict:
    return await asyncio.to_thread(_save_model_result_sync, dataset_id, model_name, rmse, mae, r2, mape, train_time, is_best)

async def get_models_by_dataset(dataset_id: str) -> List[dict]:
    return await asyncio.to_thread(_get_models_by_dataset_sync, dataset_id)

async def save_prediction(dataset_id: str, model_name: str, inputs: dict,
                          prediction_value: float, actual_value: Optional[float] = None,
                          difference: Optional[float] = None) -> dict:
    return await asyncio.to_thread(_save_prediction_sync, dataset_id, model_name, inputs, prediction_value, actual_value, difference)

async def get_predictions(dataset_id: str, limit: int = 50) -> List[dict]:
    return await asyncio.to_thread(_get_predictions_sync, dataset_id, limit)

async def get_db_stats() -> dict:
    return await asyncio.to_thread(_get_db_stats_sync)
