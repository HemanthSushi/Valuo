# server.py — Valuo Real Estate Valuation & Machine Learning API
import sys
from pathlib import Path

# Ensure both backend directory and repo root are in sys.path regardless of execution CWD
BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
for _p in (str(REPO_ROOT), str(BACKEND_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Header, status, Query
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware

# Explicit package imports with local fallbacks
try:
    from backend import database
    from backend.task_manager import task_manager
    from backend.security import (
        safe_dump_artifact,
        safe_load_artifact,
        sign_artifact,
        SecurityException,
        initialize_workspace_signatures
    )
    from backend import pipeline
    from backend.pipeline import (
        clean_housing_df,
        clean_and_filter_housing_dataset,
        filter_housing_training_data,
        ValuoPreprocessor,
        ValuoRateRegressor,
        ValuoLogRegressor,
        sync_internet_dataset
    )
except ImportError:
    import database
    from task_manager import task_manager
    from security import (
        safe_dump_artifact,
        safe_load_artifact,
        sign_artifact,
        SecurityException,
        initialize_workspace_signatures
    )
    import pipeline
    from pipeline import (
        clean_housing_df,
        clean_and_filter_housing_dataset,
        filter_housing_training_data,
        ValuoPreprocessor,
        ValuoRateRegressor,
        ValuoLogRegressor,
        sync_internet_dataset
    )

import os
import re
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Optional, Any, Tuple, Callable
import uuid
import pandas as pd
import numpy as np
import joblib
import json
import io
import shutil
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, mean_absolute_percentage_error
import xgboost as xgb
import shap
import warnings
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller
import matplotlib
matplotlib.use('Agg')

warnings.filterwarnings('ignore')

# --- Setup ------------------------------------------------------------------
ROOT_DIR = BACKEND_DIR
load_dotenv(BACKEND_DIR / '.env')
load_dotenv(REPO_ROOT / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("valuo-api")

JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError(
        "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is unset. "
        "The server cannot start without a secure secret key. "
        "Generate one using: python -c \"import secrets; print(secrets.token_urlsafe(32))\" "
        "and configure it in backend/.env"
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = int(os.getenv('JWT_EXPIRES_MINUTES', 1440))

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        database.init_db()
        initialize_workspace_signatures(WORKSPACE_DIR)
        stats = await database.get_db_stats()
        logger.info(
            f"SQLite storage engine active: {stats['file_path']} "
            f"({stats['size_formatted']}, {stats['mode']}). "
            f"Users: {stats['tables']['users']}, Datasets: {stats['tables']['datasets']}."
        )
    except Exception as e:
        logger.error(f"Failed to initialize SQLite database: {e}")
    yield

WORKSPACE_DIR = ROOT_DIR / "workspace"
WORKSPACE_DIR.mkdir(exist_ok=True)
initialize_workspace_signatures(WORKSPACE_DIR)

app = FastAPI(
    title="Valuo API",
    description="Valuo Intelligent House Price Prediction & Analytics API",
    version="1.0.0",
    lifespan=lifespan
)

api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth")

ALLOWED_MODELS = ["RandomForest", "XGBoost"]
MAX_UPLOAD_SIZE = int(os.getenv('MAX_UPLOAD_SIZE_BYTES', 50 * 1024 * 1024))

# --- Password & JWT Helpers -------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=JWT_EXPIRES_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in."
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session."
        )
    user_id = payload["sub"]
    user = await database.get_user_by_id(user_id)
    if user:
        user = {k: v for k, v in user.items() if k != "hashed_password"}
    else:
        # Fall back to payload claims
        user = {
            "id": user_id,
            "email": payload.get("email", ""),
            "name": payload.get("name", "User")
        }
    return user

# --- Pydantic Schemas -------------------------------------------------------
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False

class AuthResponse(BaseModel):
    user: Dict[str, Any]
    token: str

class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: int
    column_names: List[str]
    sample_data: List[Dict]

class MetaResponse(BaseModel):
    dataset_id: str
    rows: int
    columns: int
    column_types: Dict[str, str]
    unique_values: Dict[str, List[Any]]
    suggested_targets: List[str]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]

UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
UUID_REGEX = re.compile(UUID_PATTERN)

class TrainRequest(BaseModel):
    dataset_id: str = Field(..., pattern=UUID_PATTERN, description="Canonical UUID of the dataset")
    target_column: str
    models: Optional[List[str]] = None
    test_size: float = 0.2
    random_state: int = 42
    cv_folds: Optional[int] = None
    background: Optional[bool] = False

class PredictRequest(BaseModel):
    dataset_id: str = Field(..., pattern=UUID_PATTERN, description="Canonical UUID of the dataset")
    model_name: str
    rows: List[Dict]

class ForecastRequest(BaseModel):
    dataset_id: str = Field(..., pattern=UUID_PATTERN, description="Canonical UUID of the dataset")
    date_column: str
    target_column: str
    periods: int = 12
    freq: str = "M"

# --- Authentication Routes --------------------------------------------------
@auth_router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    email_clean = request.email.lower().strip()
    name_clean = request.name.strip()
    if len(name_clean) < 1:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    # Check existing user in SQLite
    existing = await database.get_user_by_email(email_clean)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email address already exists. Please sign in."
        )

    user_id = str(uuid.uuid4())
    hashed = await asyncio.to_thread(hash_password, request.password)
    await database.create_user(user_id, name_clean, email_clean, hashed)

    token = create_access_token({
        "sub": user_id,
        "email": email_clean,
        "name": name_clean
    })

    return AuthResponse(
        user={"id": user_id, "name": name_clean, "email": email_clean},
        token=token
    )

@auth_router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    email_clean = request.email.lower().strip()

    user = await database.get_user_by_email(email_clean)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    valid_password = await asyncio.to_thread(
        verify_password, request.password, user.get("hashed_password", "")
    )
    if not valid_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Token duration: 7 days if remember_me, else configured JWT_EXPIRES_MINUTES
    expires_delta = timedelta(days=7) if request.remember_me else timedelta(minutes=JWT_EXPIRES_MINUTES)
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"]
    }, expires_delta=expires_delta)

    return AuthResponse(
        user={"id": user["id"], "name": user["name"], "email": user["email"]},
        token=token
    )

@auth_router.post("/logout")
async def logout():
    return {"message": "Logged out successfully."}

@auth_router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user.get("name", "User"),
        "email": current_user["email"]
    }

# --- Dataset and Model Helpers ----------------------------------------------
DEFAULT_BENCHMARK_ID = "06390047-ef89-4508-b930-6fc7a47f5e05"

def validate_dataset_id(dataset_id: str) -> str:
    """
    Validate that dataset_id strictly conforms to a canonical 36-character UUID format.
    Prevents path traversal attacks (e.g., '../../etc' or absolute filesystem paths).
    """
    if not dataset_id or not isinstance(dataset_id, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset identifier: must be a non-empty string."
        )
    clean_id = dataset_id.strip()
    if not UUID_REGEX.match(clean_id):
        logger.warning(f"Path traversal or malformed dataset_id rejected: '{dataset_id}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset identifier: must conform to standard UUID format (8-4-4-4-12 hex digits)."
        )
    try:
        parsed_uuid = uuid.UUID(clean_id)
        return str(parsed_uuid)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset identifier: malformed UUID."
        )

def get_dataset_path(dataset_id: str) -> Path:
    """
    Resolve dataset directory inside WORKSPACE_DIR with strict path containment checks.
    Guarantees that the resolved path starts with WORKSPACE_DIR.resolve() and prevents
    directory traversal outside the designated storage root.
    """
    clean_id = validate_dataset_id(dataset_id)
    resolved_workspace = WORKSPACE_DIR.resolve()
    target_path = (resolved_workspace / clean_id).resolve()

    # Ensure target path is strictly within the workspace directory
    try:
        target_path.relative_to(resolved_workspace)
        if target_path == resolved_workspace:
            raise ValueError("Target path cannot resolve directly to workspace root.")
    except ValueError:
        logger.error(f"SECURITY ALERT: Path traversal attempt blocked for dataset_id: '{dataset_id}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset path: traversal outside workspace boundary is forbidden."
        )

    return target_path

def get_dataset_file(dataset_id: str) -> Path:
    return get_dataset_path(dataset_id) / "dataset.csv"

async def verify_dataset_access(dataset_id: str, current_user: dict) -> dict:
    """Ensure user has authorization to access the dataset (either owner or system benchmark)."""
    clean_id = validate_dataset_id(dataset_id)
    dataset = await database.get_dataset(clean_id)
    if not dataset:
        if clean_id == DEFAULT_BENCHMARK_ID and get_dataset_file(clean_id).exists():
            return {"id": clean_id, "user_id": None, "filename": "dataset.csv"}
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # System benchmark or dataset with no owner is accessible to all authenticated users
    if dataset.get("user_id") is None or clean_id == DEFAULT_BENCHMARK_ID:
        return dataset

    # Otherwise must match current user to prevent IDOR
    if dataset.get("user_id") != current_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access this dataset."
        )
    return dataset

def load_dataset(dataset_id: str) -> pd.DataFrame:
    file_path = get_dataset_file(dataset_id)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return pd.read_csv(file_path)

def detect_column_types(df: pd.DataFrame) -> Dict[str, List[str]]:
    df_c = clean_housing_df(df)
    numeric_cols = df_c.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df_c.select_dtypes(include=['object', 'category']).columns.tolist()
    datetime_cols = []
    for col in categorical_cols:
        try:
            ser = pd.to_datetime(df_c[col], errors='coerce')
            if ser.notna().sum() > len(df_c) * 0.5:
                datetime_cols.append(col)
        except Exception:
            pass
    categorical_cols = [c for c in categorical_cols if c not in datetime_cols]

    filtered_categorical = []
    for c in categorical_cols:
        if df_c[c].nunique() < 2000:
            filtered_categorical.append(c)

    return {"numeric": numeric_cols, "categorical": filtered_categorical, "datetime": datetime_cols}

def suggest_target_columns(df: pd.DataFrame) -> List[str]:
    df_c = clean_housing_df(df)
    numeric_cols = df_c.select_dtypes(include=[np.number]).columns.tolist()
    target_keywords = ['price', 'cost', 'value', 'amount', 'sale', 'median']
    suggested = [c for c in numeric_cols if any(k in c.lower() for k in target_keywords)]
    if not suggested:
        suggested = numeric_cols[:5]
    return suggested

def compute_eda(df: pd.DataFrame, column_types: Dict) -> Dict:
    df_c = clean_housing_df(df)
    eda = {}
    numeric_cols = column_types['numeric']
    if numeric_cols:
        summary_stats = df_c[numeric_cols].describe().to_dict()
        for col in summary_stats:
            for stat in list(summary_stats[col].keys()):
                val = summary_stats[col][stat]
                summary_stats[col][stat] = None if (pd.isna(val) or np.isinf(val)) else float(val)
        eda['summary_stats'] = summary_stats
    else:
        eda['summary_stats'] = {}

    missing = df.isnull().sum()
    eda['missing_values'] = {
        col: {"count": int(missing[col]), "percent": float((missing[col] / len(df) * 100).round(2))}
        for col in df.columns
    }

    categorical_info = {}
    for col in column_types['categorical']:
        try:
            value_counts = df[col].value_counts()
            categorical_info[col] = {
                "unique_count": int(df[col].nunique()),
                "top_categories": {str(k): int(v) for k, v in value_counts.head(10).items()}
            }
        except Exception:
            categorical_info[col] = {"unique_count": 0, "top_categories": {}}
    eda['categorical_info'] = categorical_info

    if len(numeric_cols) > 1:
        try:
            corr_df = df_c[numeric_cols].corr()
            corr_dict = {}
            for col in corr_df.columns:
                corr_dict[col] = {
                    c: None if (pd.isna(corr_df[col][c]) or np.isinf(corr_df[col][c])) else float(corr_df[col][c])
                    for c in corr_df.index
                }
            eda['correlations'] = corr_dict
        except Exception:
            eda['correlations'] = {}
    else:
        eda['correlations'] = {}

    return eda

def build_preprocessing_pipeline(df: pd.DataFrame, target_column: str, column_types: Dict):
    preprocessor = ValuoPreprocessor(target_column=target_column)
    preprocessor.fit(df)
    numeric_cols = [c for c in column_types['numeric'] if c != target_column]
    categorical_cols = column_types['categorical']
    return preprocessor, numeric_cols, categorical_cols

def train_models(
    df: pd.DataFrame,
    target_column: str,
    models_to_train: List[str],
    test_size: float,
    random_state: int,
    cv_folds: Optional[int],
    dataset_id: str,
    progress_callback: Optional[Callable[[int, str], None]] = None
):
    if progress_callback:
        progress_callback(20, "Preprocessing dataset features")

    dataset_path = get_dataset_path(dataset_id)
    is_housing = any(
        c.lower() in ['total_sqft', 'area_sqft', 'sqft', 'square_feet', 'bedrooms', 'bhk']
        for c in df.columns
    ) and target_column.lower() in ['price', 'cost', 'value', 'target']

    if is_housing:
        # 1. Feature cleaning only (no target dropping of test points)
        df_clean = clean_housing_df(df).dropna(subset=[target_column, 'total_sqft'])
        df_clean[target_column] = pd.to_numeric(df_clean[target_column], errors='coerce')
        df_clean = df_clean.dropna(subset=[target_column])
        df_clean = df_clean[(df_clean['total_sqft'] >= 100) & (df_clean[target_column] > 0)]

        # 2. Strict Train/Test split BEFORE any target-based filtering
        train_df, test_df = train_test_split(df_clean, test_size=test_size, random_state=random_state)

        # 3. Training-only anomaly filtering (never touches test_df)
        train_df_filtered = filter_housing_training_data(train_df, target_column=target_column)
        if len(train_df_filtered) < 10:
            train_df_filtered = train_df

        preprocessor = ValuoPreprocessor(target_column=target_column)
        preprocessor.fit(train_df_filtered)

        X_train_transformed = preprocessor.transform(train_df_filtered)
        X_test_transformed = preprocessor.transform(test_df)
        y_train = train_df_filtered[target_column].values
        y_test = test_df[target_column].values
        feature_names = preprocessor.feature_names
        training_features = [c for c in df.columns if c != target_column]

        model_constructors = {
            "RandomForest": lambda: ValuoLogRegressor(
                RandomForestRegressor(
                    n_estimators=300,
                    max_depth=18,
                    min_samples_split=3,
                    min_samples_leaf=1,
                    max_features='sqrt',
                    random_state=random_state,
                    n_jobs=-1
                )
            ),
            "XGBoost": lambda: ValuoLogRegressor(
                xgb.XGBRegressor(
                    n_estimators=500,
                    learning_rate=0.03,
                    max_depth=5,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_alpha=0.1,
                    reg_lambda=1.0,
                    random_state=random_state,
                    n_jobs=-1
                )
            )
        }
    else:
        # Generic tabular dataset
        column_types = detect_column_types(df)
        X = df.drop(columns=[target_column])
        y = df[target_column].values
        training_features = X.columns.tolist()

        preprocessor = ValuoPreprocessor(target_column=target_column)
        preprocessor.fit(df)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
        X_train_transformed = preprocessor.transform(X_train)
        X_test_transformed = preprocessor.transform(X_test)
        feature_names = preprocessor.feature_names

        model_constructors = {
            "RandomForest": lambda: RandomForestRegressor(
                n_estimators=100,
                max_depth=15,
                random_state=random_state,
                n_jobs=-1
            ),
            "XGBoost": lambda: xgb.XGBRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=random_state,
                n_jobs=-1
            )
        }

    safe_dump_artifact(preprocessor, dataset_path / "preprocessor.pkl")
    with open(dataset_path / "training_features.json", "w") as f:
        json.dump(training_features, f)
    with open(dataset_path / "feature_names.json", "w") as f:
        json.dump(feature_names, f)

    valid_models = [m for m in models_to_train if m in model_constructors]
    if not valid_models:
        valid_models = ALLOWED_MODELS

    results = []
    import time
    for idx, model_name in enumerate(valid_models):
        if progress_callback:
            pct = 35 + int((idx / len(valid_models)) * 50)
            progress_callback(pct, f"Training {model_name} model")
        model = model_constructors[model_name]()
        start_time = time.time()
        model.fit(X_train_transformed, y_train)
        train_time = time.time() - start_time

        y_pred = model.predict(X_test_transformed)
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        mae = float(mean_absolute_error(y_test, y_pred))
        r2 = float(r2_score(y_test, y_pred))
        try:
            mape = float(mean_absolute_percentage_error(y_test, y_pred))
        except Exception:
            mape = 0.0

        safe_dump_artifact(model, dataset_path / f"model_{model_name}.pkl")
        results.append({
            "model_name": model_name,
            "rmse": rmse,
            "mae": mae,
            "r2": r2,
            "mape": mape,
            "train_time": float(train_time),
            "cv_rmse": None
        })

    if not results:
        raise ValueError("No valid models were trained.")

    if progress_callback:
        progress_callback(90, "Evaluating model candidates and persisting artifacts")

    best_model = min(results, key=lambda x: x['rmse'])
    best_model_name = best_model['model_name']
    shutil.copy(dataset_path / f"model_{best_model_name}.pkl", dataset_path / "model_best.pkl")
    sign_artifact(dataset_path / "model_best.pkl")

    with open(dataset_path / "model_candidates.json", "w") as f:
        json.dump({
            "models": results,
            "best_model": best_model_name,
            "target_column": target_column,
            "test_size": test_size,
            "random_state": random_state
        }, f, indent=2)

    return results, best_model_name

def compute_shap_values(dataset_id: str, model_name: str, sample_size: int = 40):
    dataset_path = get_dataset_path(dataset_id)
    model_file = dataset_path / f"model_{model_name}.pkl"
    if not model_file.exists():
        return None

    try:
        model = safe_load_artifact(model_file)
        preprocessor = safe_load_artifact(dataset_path / "preprocessor.pkl")
        df = load_dataset(dataset_id)
        with open(dataset_path / "model_candidates.json", "r") as f:
            model_info = json.load(f)
        target_column = model_info['target_column']
        X = df.drop(columns=[target_column]) if target_column in df.columns else df.copy()
        X_transformed = preprocessor.transform(X)

        if len(X_transformed) > sample_size:
            sample_indices = np.random.choice(len(X_transformed), sample_size, replace=False)
            X_sample = X_transformed[sample_indices]
        else:
            X_sample = X_transformed

        # TreeExplainer for base tree model
        tree_estimator = getattr(model, 'estimator', model)
        explainer = shap.TreeExplainer(tree_estimator)
        shap_values = explainer.shap_values(X_sample)

        with open(dataset_path / "feature_names.json", "r") as f:
            feature_names = json.load(f)

        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        mean_shap = np.abs(shap_values).mean(axis=0)
        limit = min(len(mean_shap), len(feature_names))
        top_indices = np.argsort(mean_shap[:limit])[-20:][::-1]

        return {
            "feature_names": [feature_names[i] for i in top_indices],
            "mean_shap_values": mean_shap[top_indices].tolist()
        }
    except SecurityException as se:
        logger.error(f"Security Alert: Untrusted artifact in compute_shap_values: {se}")
        return None
    except Exception as e:
        logger.warning(f"SHAP computation exception for {model_name}: {e}")
        return None

def get_feature_importance(dataset_id: str, model_name: str):
    dataset_path = get_dataset_path(dataset_id)
    model_file = dataset_path / f"model_{model_name}.pkl"
    if not model_file.exists():
        return None

    try:
        model = safe_load_artifact(model_file)
        with open(dataset_path / "feature_names.json", "r") as f:
            feature_names = json.load(f)
        tree_estimator = getattr(model, 'estimator', model)
        if hasattr(tree_estimator, 'feature_importances_'):
            importances = tree_estimator.feature_importances_
            limit = min(len(importances), len(feature_names))
            top_indices = np.argsort(importances[:limit])[-20:][::-1]
            return {
                "feature_names": [feature_names[i] for i in top_indices],
                "importances": importances[top_indices].tolist()
            }
        return None
    except SecurityException as se:
        logger.error(f"Security Alert: Untrusted artifact in get_feature_importance: {se}")
        return None
    except Exception as e:
        logger.warning(f"Feature importance exception for {model_name}: {e}")
        return None

def forecast_time_series(dataset_id: str, date_column: str, target_column: str, periods: int, freq: str):
    """
    Fit statistical ARIMA model on genuine sequential time-series data with stationarity verification.
    Cross-sectional datasets without chronological transaction dates are strictly rejected.
    """
    df = load_dataset(dataset_id)
    if date_column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Specified date column '{date_column}' does not exist in dataset."
        )
    if target_column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Specified target column '{target_column}' does not exist in dataset."
        )

    # Validate chronological datetime validity
    parsed_dates = pd.to_datetime(df[date_column], errors='coerce')
    valid_ratio = float(parsed_dates.notna().sum()) / max(len(df), 1)

    # Reject cross-sectional or pseudo-temporal datasets (e.g. 'availability' with mostly strings)
    if valid_ratio < 0.40 or parsed_dates.notna().sum() < 10:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Column '{date_column}' contains only {valid_ratio*100:.1f}% valid date values. "
                "Cross-sectional housing datasets do not have a chronological time dimension and cannot support time-series forecasting. "
                "Please upload a time-stamped transaction or monthly sales index dataset."
            )
        )

    df_ts = df.assign(_parsed_date=parsed_dates).dropna(subset=['_parsed_date', target_column])
    df_ts = df_ts.sort_values('_parsed_date')
    df_ts.set_index('_parsed_date', inplace=True)
    ts = pd.to_numeric(df_ts[target_column], errors='coerce').dropna()

    if freq:
        try:
            ts = ts.resample(freq).mean().dropna()
        except Exception:
            pass

    if len(ts) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient continuous chronological observations ({len(ts)} periods found, at least 10 required for reliable ARIMA estimation)."
        )

    # 1. Stationarity Check using Augmented Dickey-Fuller (ADF) Test
    try:
        adf_result = adfuller(ts, autolag='AIC')
        adf_stat = float(adf_result[0])
        p_value = float(adf_result[1])
        is_stationary = bool(p_value < 0.05)
    except Exception as ex:
        logger.warning(f"ADF stationarity test exception: {ex}")
        adf_stat, p_value, is_stationary = 0.0, 1.0, False

    # 2. Determine differencing order d based on stationarity test
    d = 0 if is_stationary else 1

    # 3. Model Order Selection using AIC search
    best_model = None
    best_aic = float('inf')
    best_order = (1, d, 1)

    candidate_orders = [(1, d, 1), (1, d, 0), (0, d, 1), (2, d, 1)]
    for order in candidate_orders:
        try:
            m = ARIMA(ts, order=order)
            fitted = m.fit()
            if fitted.aic < best_aic:
                best_aic = float(fitted.aic)
                best_model = fitted
                best_order = order
        except Exception:
            continue

    if best_model is None:
        try:
            best_model = ARIMA(ts, order=(1, d, 1)).fit()
            best_order = (1, d, 1)
            best_aic = float(best_model.aic)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ARIMA model fitting failed: {str(e)}")

    try:
        forecast = best_model.forecast(steps=periods)
        forecast_result = best_model.get_forecast(steps=periods)
        conf_int = forecast_result.conf_int()
        last_date = ts.index[-1]
        forecast_dates = pd.date_range(start=last_date, periods=periods + 1, freq=freq or 'ME')[1:]

        return {
            "historical_dates": ts.index.strftime('%Y-%m-%d').tolist(),
            "historical_values": [float(v) for v in ts.values],
            "forecast_dates": forecast_dates.strftime('%Y-%m-%d').tolist(),
            "forecast_values": [float(v) for v in forecast],
            "lower_bound": [float(v) for v in conf_int.iloc[:, 0]],
            "upper_bound": [float(v) for v in conf_int.iloc[:, 1]],
            "stationarity": {
                "adf_statistic": round(adf_stat, 4),
                "p_value": round(p_value, 4),
                "is_stationary": is_stationary,
                "differencing_order": d,
                "selected_order": list(best_order),
                "aic": round(best_aic, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting calculation failed: {str(e)}")

# --- API Endpoints ----------------------------------------------------------
@api_router.get("/")
async def root():
    db_stats = await database.get_db_stats()
    return {
        "name": "Valuo API",
        "status": "operational",
        "version": "1.0.0",
        "database": {
            "engine": db_stats.get("engine", "SQLite"),
            "mode": db_stats.get("mode", "WAL"),
            "size": db_stats.get("size_formatted", "0 KB"),
            "status": db_stats.get("status", "healthy")
        },
        "supported_models": ALLOWED_MODELS
    }

def _process_uploaded_file_sync(contents: bytes, filename: str, dataset_path: Path):
    if filename.lower().endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    elif filename.lower().endswith(('.xlsx', '.xls')):
        df = pd.read_excel(io.BytesIO(contents))
    else:
        raise ValueError("Unsupported file format. Please upload a CSV or Excel (.xlsx/.xls) file.")

    if len(df) == 0:
        raise ValueError("The uploaded file contains no data rows.")

    csv_file_path = dataset_path / "dataset.csv"
    df.to_csv(csv_file_path, index=False)
    sample_records = df.head(5).replace({np.nan: None}).to_dict('records')
    return len(df), len(df.columns), df.columns.tolist(), sample_records, str(csv_file_path)

@api_router.post("/upload", response_model=UploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        contents = await file.read()
        size = len(contents)
        if size > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File exceeds maximum upload size of {MAX_UPLOAD_SIZE} bytes.")
        dataset_id = str(uuid.uuid4())
        dataset_path = get_dataset_path(dataset_id)
        dataset_path.mkdir(exist_ok=True)

        try:
            rows, cols, col_names, sample_data, csv_file_path = await asyncio.to_thread(
                _process_uploaded_file_sync, contents, file.filename, dataset_path
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # Persist dataset metadata into SQLite associated with current user
        await database.save_dataset(
            dataset_id=dataset_id,
            filename=file.filename,
            rows=rows,
            columns=cols,
            file_path=csv_file_path,
            column_names=col_names,
            user_id=current_user["id"]
        )

        return UploadResponse(
            dataset_id=dataset_id,
            filename=file.filename,
            rows=rows,
            columns=cols,
            column_names=col_names,
            sample_data=sample_data
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Upload error")
        raise HTTPException(status_code=500, detail=str(e))

def _compute_dataset_meta_sync(dataset_id: str) -> dict:
    df = load_dataset(dataset_id)
    column_types = detect_column_types(df)
    suggested_targets = suggest_target_columns(df)
    col_type_map = {}
    for col in df.columns:
        if col in column_types['numeric']:
            col_type_map[col] = 'numeric'
        elif col in column_types['categorical']:
            col_type_map[col] = 'categorical'
        elif col in column_types['datetime']:
            col_type_map[col] = 'datetime'
        else:
            col_type_map[col] = 'text'

    unique_values = {}
    for col in column_types['categorical']:
        unique_values[col] = df[col].dropna().unique().tolist()[:50]

    return {
        "dataset_id": dataset_id,
        "rows": len(df),
        "columns": len(df.columns),
        "column_types": col_type_map,
        "unique_values": unique_values,
        "suggested_targets": suggested_targets,
        "numeric_columns": column_types['numeric'],
        "categorical_columns": column_types['categorical'],
        "datetime_columns": column_types['datetime']
    }

@api_router.get("/meta/{dataset_id}", response_model=MetaResponse)
async def get_dataset_meta(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        meta_dict = await asyncio.to_thread(_compute_dataset_meta_sync, dataset_id)
        return MetaResponse(**meta_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Meta error")
        raise HTTPException(status_code=500, detail=str(e))

def _compute_dataset_eda_sync(dataset_id: str) -> dict:
    df = load_dataset(dataset_id)
    column_types = detect_column_types(df)
    return compute_eda(df, column_types)

@api_router.get("/eda/{dataset_id}")
async def get_eda(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        return await asyncio.to_thread(_compute_dataset_eda_sync, dataset_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("EDA error")
        raise HTTPException(status_code=500, detail=str(e))

def execute_training_pipeline_sync(
    task_id: str,
    dataset_id: str,
    target_column: str,
    models_requested: List[str],
    test_size: float,
    random_state: int,
    cv_folds: Optional[int]
) -> Tuple[List[dict], str]:
    """Execute training pipeline safely within a worker thread without blocking asyncio loop."""
    try:
        task_manager.update_progress(task_id, 10, "Loading and validating dataset", status="running")
        df = load_dataset(dataset_id)
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset.")

        def _on_progress(pct: int, msg: str):
            task_manager.update_progress(task_id, pct, msg, status="running")

        results, best_model_name = train_models(
            df=df,
            target_column=target_column,
            models_to_train=models_requested,
            test_size=test_size,
            random_state=random_state,
            cv_folds=cv_folds,
            dataset_id=dataset_id,
            progress_callback=_on_progress
        )

        task_manager.update_progress(task_id, 95, "Recording model results in database", status="running")
        for m in results:
            database._save_model_result_sync(
                dataset_id=dataset_id,
                model_name=m["model_name"],
                rmse=m["rmse"],
                mae=m["mae"],
                r2=m["r2"],
                mape=m.get("mape", 0.0),
                train_time=m.get("train_time", 0.0),
                is_best=(m["model_name"] == best_model_name)
            )

        task_manager.mark_completed(task_id, results, best_model_name)
        return results, best_model_name
    except Exception as e:
        logger.exception(f"Training pipeline error for task {task_id}: {e}")
        task_manager.mark_failed(task_id, str(e))
        raise

@api_router.post("/train")
async def train_model(
    request: TrainRequest,
    current_user: dict = Depends(get_current_user),
    background: Optional[bool] = Query(None)
):
    """
    Train machine learning models.
    Supports both synchronous execution (offloaded to threadpool to prevent event loop starvation)
    and asynchronous execution with status polling via /api/train/status/{task_id}.
    """
    try:
        await verify_dataset_access(request.dataset_id, current_user)
        is_bg = background if background is not None else getattr(request, 'background', False)
        task_id = str(uuid.uuid4())
        models_requested = request.models if request.models else ALLOWED_MODELS

        task_manager.register_task(
            task_id=task_id,
            dataset_id=request.dataset_id,
            user_id=current_user["id"],
            target_column=request.target_column,
            models=models_requested
        )

        if is_bg:
            task_manager.executor.submit(
                execute_training_pipeline_sync,
                task_id,
                request.dataset_id,
                request.target_column,
                models_requested,
                request.test_size,
                request.random_state,
                request.cv_folds
            )
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "task_id": task_id,
                    "status": "queued",
                    "dataset_id": request.dataset_id,
                    "message": "Training job queued. Poll /api/train/status/{task_id} for progress."
                }
            )

        try:
            results, best_model_name = await asyncio.to_thread(
                execute_training_pipeline_sync,
                task_id,
                request.dataset_id,
                request.target_column,
                models_requested,
                request.test_size,
                request.random_state,
                request.cv_folds
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        return {"task_id": task_id, "results": results, "best_model": best_model_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Train error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/train/async")
async def train_model_async(
    request: TrainRequest,
    current_user: dict = Depends(get_current_user)
):
    """Submit a training job to the background queue and return task_id immediately."""
    await verify_dataset_access(request.dataset_id, current_user)
    task_id = str(uuid.uuid4())
    models_requested = request.models if request.models else ALLOWED_MODELS

    task_manager.register_task(
        task_id=task_id,
        dataset_id=request.dataset_id,
        user_id=current_user["id"],
        target_column=request.target_column,
        models=models_requested
    )

    task_manager.executor.submit(
        execute_training_pipeline_sync,
        task_id,
        request.dataset_id,
        request.target_column,
        models_requested,
        request.test_size,
        request.random_state,
        request.cv_folds
    )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "task_id": task_id,
            "status": "queued",
            "dataset_id": request.dataset_id,
            "message": "Training job queued. Poll /api/train/status/{task_id} for progress."
        }
    )

@api_router.get("/train/status/{task_id}")
async def get_train_status(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Poll status of a background training task."""
    clean_task_id = task_id.strip()
    if not UUID_REGEX.match(clean_task_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task identifier: must be a valid UUID."
        )
    task = task_manager.get_task(clean_task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Training task not found.")
    await verify_dataset_access(task["dataset_id"], current_user)
    return task

@api_router.get("/train/jobs/{dataset_id}")
async def list_train_jobs(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List recent training tasks for a given dataset."""
    await verify_dataset_access(dataset_id, current_user)
    return await asyncio.to_thread(
        task_manager.list_tasks_for_dataset, dataset_id, current_user["id"]
    )

def _get_models_sync(dataset_id: str) -> dict:
    dataset_path = get_dataset_path(dataset_id)
    candidates_file = dataset_path / "model_candidates.json"
    if not candidates_file.exists():
        raise FileNotFoundError("No trained models found for this dataset.")

    with open(candidates_file, "r") as f:
        data = json.load(f)

    # Filter out any unsupported models from legacy workspaces
    if "models" in data and isinstance(data["models"], list):
        valid_models = [m for m in data["models"] if m.get("model_name") in ALLOWED_MODELS]
        if valid_models:
            data["models"] = valid_models
            if data.get("best_model") not in ALLOWED_MODELS:
                best = min(valid_models, key=lambda x: x.get('rmse', float('inf')))
                data["best_model"] = best["model_name"]
    return data

@api_router.get("/models/{dataset_id}")
async def get_models(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    await verify_dataset_access(dataset_id, current_user)
    try:
        return await asyncio.to_thread(_get_models_sync, dataset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No trained models found for this dataset.")
    except Exception as e:
        logger.exception("Get models error")
        raise HTTPException(status_code=500, detail=str(e))

def compute_uncertainty_intervals(
    model: Any,
    X_transformed: Any,
    predictions: List[float],
    dataset_path: Path,
    model_name: str
) -> List[Dict[str, Any]]:
    """
    Compute real statistical 95% confidence and prediction intervals for property valuations.
    Uses empirical quantiles from decision tree ensemble variance for RandomForestRegressor,
    and calibrated test-residual variance for Gradient Boosted (XGBoost) and linear regressors.
    """
    intervals = []
    est = getattr(model, 'estimator', model)
    is_log = hasattr(model, 'estimator')  # ValuoLogRegressor

    # 1. Ensemble Tree Variance (Random Forest)
    if hasattr(est, 'estimators_') and len(getattr(est, 'estimators_', [])) > 0:
        try:
            tree_preds = np.array([tree.predict(X_transformed) for tree in est.estimators_])  # (n_trees, n_samples)
            if is_log:
                tree_prices = np.expm1(np.clip(tree_preds, 0.0, 15.0))
            else:
                tree_prices = tree_preds

            for i in range(len(predictions)):
                sample_preds = tree_prices[:, i]
                low_95 = float(np.percentile(sample_preds, 2.5))
                high_95 = float(np.percentile(sample_preds, 97.5))
                std_val = float(np.std(sample_preds))
                intervals.append({
                    "lower": round(max(0.01, low_95), 2),
                    "upper": round(high_95, 2),
                    "std_dev": round(std_val, 2),
                    "confidence_level": 0.95,
                    "method": "RandomForest Ensemble Tree Variance (95%)"
                })
            return intervals
        except Exception as e:
            logger.warning(f"Failed to compute ensemble tree variance: {e}")

    # 2. Calibrated Residual Uncertainty (XGBoost / Generic)
    mape_val = 0.20
    try:
        candidates_file = dataset_path / "model_candidates.json"
        if candidates_file.exists():
            with open(candidates_file, "r") as f:
                info = json.load(f)
            for m in info.get("models", []):
                if m.get("model_name") == model_name:
                    mape_val = float(m.get("mape", 0.20) or 0.20)
                    break
    except Exception as e:
        logger.warning(f"Could not read model metadata for CI calibration: {e}")

    mape_val = max(0.08, min(0.60, mape_val))
    for pred in predictions:
        pred_float = float(pred)
        if pred_float <= 0:
            pred_float = 1.0
        low = pred_float * np.exp(-1.96 * mape_val)
        high = pred_float * np.exp(1.96 * mape_val)
        std_val = pred_float * mape_val
        intervals.append({
            "lower": round(max(0.01, float(low)), 2),
            "upper": round(float(high), 2),
            "std_dev": round(float(std_val), 2),
            "confidence_level": 0.95,
            "method": f"{model_name} Calibrated Residual Uncertainty (95%)"
        })
    return intervals

def _predict_rows_sync(dataset_id: str, model_name: str, rows: List[Dict]) -> Tuple[List[float], List[Dict[str, Any]]]:
    if model_name not in ALLOWED_MODELS and model_name != "best":
        raise ValueError(f"Model '{model_name}' is not recognized. Allowed models: {ALLOWED_MODELS + ['best']}")
    dataset_path = get_dataset_path(dataset_id)
    model_file = dataset_path / f"model_{model_name}.pkl"
    if not model_file.exists():
        raise FileNotFoundError(f"Model '{model_name}' not found. Please train models first.")

    model = safe_load_artifact(model_file)
    preprocessor = safe_load_artifact(dataset_path / "preprocessor.pkl")

    try:
        with open(dataset_path / "training_features.json", "r") as f:
            expected_features = json.load(f)
    except FileNotFoundError:
        raise ValueError("Feature definitions missing. Retrain the model.")

    df_input = pd.DataFrame(rows)
    if hasattr(preprocessor, 'is_housing') and preprocessor.is_housing:
        X_transformed = preprocessor.transform(df_input)
    else:
        for col in expected_features:
            if col not in df_input.columns:
                df_input[col] = np.nan
        df_input = df_input[[c for c in expected_features if c in df_input.columns]]
        X_transformed = preprocessor.transform(df_input)

    predictions = [float(p) for p in model.predict(X_transformed)]
    intervals = compute_uncertainty_intervals(
        model=model,
        X_transformed=X_transformed,
        predictions=predictions,
        dataset_path=dataset_path,
        model_name=model_name
    )
    return predictions, intervals

@api_router.post("/predict")
async def predict(
    request: PredictRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(request.dataset_id, current_user)
        try:
            predictions, intervals = await asyncio.to_thread(
                _predict_rows_sync, request.dataset_id, request.model_name, request.rows
            )
        except SecurityException as se:
            logger.error(f"Security Alert in predict: {se}")
            raise HTTPException(status_code=403, detail="Untrusted or tampered model artifact detected.")
        except FileNotFoundError as fe:
            raise HTTPException(status_code=404, detail=str(fe))
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # Log predictions to SQLite audit log asynchronously
        for row, pred in zip(request.rows, predictions):
            try:
                await database.save_prediction(
                    dataset_id=request.dataset_id,
                    model_name=request.model_name,
                    inputs=row,
                    prediction_value=float(pred)
                )
            except Exception as e:
                logger.warning(f"Failed to record prediction in SQLite: {e}")

        return {
            "predictions": predictions,
            "confidence_intervals": intervals,
            "lower_bounds": [i["lower"] for i in intervals],
            "upper_bounds": [i["upper"] for i in intervals]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Prediction error")
        raise HTTPException(status_code=500, detail=str(e))

def _predict_random_sync(dataset_id: str, model_name: str) -> dict:
    if model_name not in ALLOWED_MODELS and model_name != "best":
        raise ValueError(f"Model '{model_name}' is not recognized. Allowed models: {ALLOWED_MODELS + ['best']}")
    dataset_path = get_dataset_path(dataset_id)
    model_file = dataset_path / f"model_{model_name}.pkl"
    if not model_file.exists():
        raise FileNotFoundError(f"Model '{model_name}' not found.")

    model = safe_load_artifact(model_file)
    preprocessor = safe_load_artifact(dataset_path / "preprocessor.pkl")

    with open(dataset_path / "training_features.json", "r") as f:
        expected_features = json.load(f)

    df = load_dataset(dataset_id)
    sample_row = df.sample(n=1, random_state=None)

    if hasattr(preprocessor, 'is_housing') and preprocessor.is_housing:
        X_transformed = preprocessor.transform(sample_row)
        prediction = float(model.predict(X_transformed)[0])
        input_dict = sample_row.iloc[0].replace({np.nan: None}).to_dict()
    else:
        input_data = sample_row[[c for c in expected_features if c in sample_row.columns]]
        X_transformed = preprocessor.transform(input_data)
        prediction = float(model.predict(X_transformed)[0])
        input_dict = input_data.iloc[0].replace({np.nan: None}).to_dict()

    target_column = None
    try:
        with open(dataset_path / "model_candidates.json", "r") as f:
            model_info = json.load(f)
        target_column = model_info.get('target_column')
    except Exception:
        pass

    actual = None
    diff = None
    if target_column and target_column in sample_row.columns:
        val = sample_row[target_column].iloc[0]
        if pd.notna(val):
            actual = float(val)
            diff = float(abs(prediction - actual))

    intervals = compute_uncertainty_intervals(
        model=model,
        X_transformed=X_transformed,
        predictions=[prediction],
        dataset_path=dataset_path,
        model_name=model_name
    )
    ci = intervals[0] if intervals else None

    return {
        "inputs": input_dict,
        "prediction": prediction,
        "confidence_interval": ci,
        "actual_target": actual,
        "difference": diff
    }

@api_router.get("/predict/random/{dataset_id}/{model_name}")
async def predict_random(
    dataset_id: str,
    model_name: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        try:
            eval_res = await asyncio.to_thread(_predict_random_sync, dataset_id, model_name)
        except SecurityException as se:
            logger.error(f"Security Alert in predict_random: {se}")
            raise HTTPException(status_code=403, detail="Untrusted or tampered model artifact detected.")
        except FileNotFoundError as fe:
            raise HTTPException(status_code=404, detail=str(fe))

        # Log evaluation to SQLite asynchronously
        try:
            await database.save_prediction(
                dataset_id=dataset_id,
                model_name=model_name,
                inputs=eval_res["inputs"],
                prediction_value=eval_res["prediction"],
                actual_value=eval_res["actual_target"],
                difference=eval_res["difference"]
            )
        except Exception as e:
            logger.warning(f"Failed to record random prediction evaluation in SQLite: {e}")

        return eval_res
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Random prediction error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/dataset/sync-internet/{dataset_id}")
async def sync_dataset_internet_endpoint(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        dataset_path = get_dataset_path(dataset_id)
        df = await asyncio.to_thread(sync_internet_dataset, dataset_path)
        await database.save_dataset(
            dataset_id=dataset_id,
            filename="Bengaluru_House_Data.csv",
            rows=len(df),
            columns=len(df.columns),
            file_path=str(dataset_path / "dataset.csv"),
            column_names=df.columns.tolist(),
            user_id=current_user["id"]
        )
        return {
            "message": "Dataset successfully synchronized from internet repository.",
            "rows": len(df),
            "columns": len(df.columns)
        }
    except Exception as e:
        logger.exception("Sync internet dataset error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/forecast")
async def forecast(
    request: ForecastRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(request.dataset_id, current_user)
        return await asyncio.to_thread(
            forecast_time_series,
            request.dataset_id,
            request.date_column,
            request.target_column,
            request.periods,
            request.freq
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/explainability/{dataset_id}/{model_name}")
async def get_explainability(
    dataset_id: str,
    model_name: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        # Ignore legacy unsupported models gracefully
        if model_name not in ALLOWED_MODELS:
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_name}' is not supported. Supported models: {', '.join(ALLOWED_MODELS)}"
            )

        # Offload feature importance and SHAP computations concurrently to worker threads
        feature_imp, shap_data = await asyncio.gather(
            asyncio.to_thread(get_feature_importance, dataset_id, model_name),
            asyncio.to_thread(compute_shap_values, dataset_id, model_name, 40)
        )
        return {
            "model_name": model_name,
            "feature_importance": feature_imp,
            "shap_values": shap_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Explainability error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/db/stats")
async def get_db_stats():
    """Retrieve SQLite database storage statistics, WAL mode, and table counts."""
    return await database.get_db_stats()

@api_router.get("/datasets")
async def list_datasets(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List uploaded datasets tracked in the SQLite database for the authenticated user."""
    return await database.list_datasets(user_id=current_user["id"], limit=limit)

@api_router.get("/predictions/{dataset_id}")
async def get_predictions(
    dataset_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve historical prediction audit logs for a given dataset."""
    await verify_dataset_access(dataset_id, current_user)
    return await database.get_predictions(dataset_id=dataset_id, limit=limit)

# Mount auth routes under /api
api_router.include_router(auth_router)
app.include_router(api_router)

# --- CORS -------------------------------------------------------------------
origins_raw = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
if isinstance(origins_raw, str):
    origins = [o.strip() for o in origins_raw.split(',') if o.strip()]
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)