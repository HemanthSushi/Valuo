# server.py — Valuo Real Estate Valuation & Machine Learning API
from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Header, status
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
try:
    import database
except ImportError:
    from backend import database
import os
import re
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Optional, Any
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
import matplotlib
matplotlib.use('Agg')

warnings.filterwarnings('ignore')

try:
    import pipeline
except ImportError:
    from backend import pipeline

from pipeline import (
    clean_housing_df,
    clean_and_filter_housing_dataset,
    filter_housing_training_data,
    ValuoPreprocessor,
    ValuoRateRegressor,
    ValuoLogRegressor,
    sync_internet_dataset
)

# --- Setup ------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    models: Optional[List[str]] = None
    test_size: float = 0.2
    random_state: int = 42
    cv_folds: Optional[int] = None

class PredictRequest(BaseModel):
    dataset_id: str
    model_name: str
    rows: List[Dict]

class ForecastRequest(BaseModel):
    dataset_id: str
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
    hashed = hash_password(request.password)
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
    if not user or not verify_password(request.password, user.get("hashed_password", "")):
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

def get_dataset_path(dataset_id: str) -> Path:
    safe_id = re.sub(r'[^a-zA-Z0-9_\-]', '', str(dataset_id))
    if not safe_id:
        raise HTTPException(status_code=400, detail="Invalid dataset identifier.")
    return WORKSPACE_DIR / safe_id

def get_dataset_file(dataset_id: str) -> Path:
    return get_dataset_path(dataset_id) / "dataset.csv"

async def verify_dataset_access(dataset_id: str, current_user: dict) -> dict:
    """Ensure user has authorization to access the dataset (either owner or system benchmark)."""
    dataset = await database.get_dataset(dataset_id)
    if not dataset:
        if dataset_id == DEFAULT_BENCHMARK_ID and get_dataset_file(dataset_id).exists():
            return {"id": dataset_id, "user_id": None, "filename": "dataset.csv"}
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # System benchmark or dataset with no owner is accessible to all authenticated users
    if dataset.get("user_id") is None or dataset_id == DEFAULT_BENCHMARK_ID:
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
    dataset_id: str
):
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

    joblib.dump(preprocessor, dataset_path / "preprocessor.pkl")
    with open(dataset_path / "training_features.json", "w") as f:
        json.dump(training_features, f)
    with open(dataset_path / "feature_names.json", "w") as f:
        json.dump(feature_names, f)

    valid_models = [m for m in models_to_train if m in model_constructors]
    if not valid_models:
        valid_models = ALLOWED_MODELS

    results = []
    import time
    for model_name in valid_models:
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

        joblib.dump(model, dataset_path / f"model_{model_name}.pkl")
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

    best_model = min(results, key=lambda x: x['rmse'])
    best_model_name = best_model['model_name']
    shutil.copy(dataset_path / f"model_{best_model_name}.pkl", dataset_path / "model_best.pkl")

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
        model = joblib.load(model_file)
        preprocessor = joblib.load(dataset_path / "preprocessor.pkl")
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
    except Exception as e:
        logger.warning(f"SHAP computation exception for {model_name}: {e}")
        return None

def get_feature_importance(dataset_id: str, model_name: str):
    dataset_path = get_dataset_path(dataset_id)
    model_file = dataset_path / f"model_{model_name}.pkl"
    if not model_file.exists():
        return None

    try:
        model = joblib.load(model_file)
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
    except Exception as e:
        logger.warning(f"Feature importance exception for {model_name}: {e}")
        return None

def forecast_time_series(dataset_id: str, date_column: str, target_column: str, periods: int, freq: str):
    df = load_dataset(dataset_id)
    df[date_column] = pd.to_datetime(df[date_column], errors='coerce')
    df = df.dropna(subset=[date_column]).sort_values(date_column)
    df.set_index(date_column, inplace=True)
    ts = pd.to_numeric(df[target_column], errors='coerce').dropna()
    if freq:
        try:
            ts = ts.resample(freq).mean().dropna()
        except Exception:
            pass
    if len(ts) < 5:
        raise HTTPException(
            status_code=400,
            detail="Insufficient time-series data points for reliable ARIMA modeling (at least 5 required)."
        )
    try:
        model = ARIMA(ts, order=(1, 1, 1))
        fitted_model = model.fit()
        forecast = fitted_model.forecast(steps=periods)
        forecast_result = fitted_model.get_forecast(steps=periods)
        conf_int = forecast_result.conf_int()
        last_date = ts.index[-1]
        forecast_dates = pd.date_range(start=last_date, periods=periods + 1, freq=freq)[1:]
        return {
            "historical_dates": ts.index.strftime('%Y-%m-%d').tolist(),
            "historical_values": ts.values.tolist(),
            "forecast_dates": forecast_dates.strftime('%Y-%m-%d').tolist(),
            "forecast_values": forecast.tolist(),
            "lower_bound": conf_int.iloc[:, 0].tolist(),
            "upper_bound": conf_int.iloc[:, 1].tolist()
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
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(io.BytesIO(contents))
            elif file.filename.lower().endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(contents))
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a CSV or Excel (.xlsx/.xls) file.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

        if len(df) == 0:
            raise HTTPException(status_code=400, detail="The uploaded file contains no data rows.")

        csv_file_path = dataset_path / "dataset.csv"
        df.to_csv(csv_file_path, index=False)

        # Persist dataset metadata into SQLite associated with current user
        await database.save_dataset(
            dataset_id=dataset_id,
            filename=file.filename,
            rows=len(df),
            columns=len(df.columns),
            file_path=str(csv_file_path),
            column_names=df.columns.tolist(),
            user_id=current_user["id"]
        )

        return UploadResponse(
            dataset_id=dataset_id,
            filename=file.filename,
            rows=len(df),
            columns=len(df.columns),
            column_names=df.columns.tolist(),
            sample_data=df.head(5).replace({np.nan: None}).to_dict('records')
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Upload error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/meta/{dataset_id}", response_model=MetaResponse)
async def get_dataset_meta(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
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

        return MetaResponse(
            dataset_id=dataset_id,
            rows=len(df),
            columns=len(df.columns),
            column_types=col_type_map,
            unique_values=unique_values,
            suggested_targets=suggested_targets,
            numeric_columns=column_types['numeric'],
            categorical_columns=column_types['categorical'],
            datetime_columns=column_types['datetime']
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Meta error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/eda/{dataset_id}")
async def get_eda(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        df = load_dataset(dataset_id)
        column_types = detect_column_types(df)
        return compute_eda(df, column_types)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("EDA error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/train")
async def train_model(
    request: TrainRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(request.dataset_id, current_user)
        df = load_dataset(request.dataset_id)
        if request.target_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{request.target_column}' not found in dataset.")

        models_requested = request.models if request.models else ALLOWED_MODELS
        results, best_model_name = await asyncio.to_thread(
            train_models,
            df,
            request.target_column,
            models_requested,
            request.test_size,
            request.random_state,
            request.cv_folds,
            request.dataset_id
        )
        for m in results:
            await database.save_model_result(
                dataset_id=request.dataset_id,
                model_name=m["model_name"],
                rmse=m["rmse"],
                mae=m["mae"],
                r2=m["r2"],
                mape=m.get("mape", 0.0),
                train_time=m.get("train_time", 0.0),
                is_best=(m["model_name"] == best_model_name)
            )
        return {"results": results, "best_model": best_model_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Train error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/models/{dataset_id}")
async def get_models(
    dataset_id: str,
    current_user: dict = Depends(get_current_user)
):
    await verify_dataset_access(dataset_id, current_user)
    dataset_path = get_dataset_path(dataset_id)
    candidates_file = dataset_path / "model_candidates.json"
    if not candidates_file.exists():
        raise HTTPException(status_code=404, detail="No trained models found for this dataset.")

    try:
        with open(candidates_file, "r") as f:
            data = json.load(f)

        # FR-5.5 / AC-9: Safely filter out stale LinearRegression or LightGBM models from legacy workspaces
        if "models" in data and isinstance(data["models"], list):
            valid_models = [m for m in data["models"] if m.get("model_name") in ALLOWED_MODELS]
            if valid_models:
                data["models"] = valid_models
                if data.get("best_model") not in ALLOWED_MODELS:
                    best = min(valid_models, key=lambda x: x.get('rmse', float('inf')))
                    data["best_model"] = best["model_name"]
        return data
    except Exception as e:
        logger.exception("Get models error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/predict")
async def predict(
    request: PredictRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(request.dataset_id, current_user)
        dataset_path = get_dataset_path(request.dataset_id)
        model_file = dataset_path / f"model_{request.model_name}.pkl"
        if not model_file.exists():
            raise HTTPException(status_code=404, detail=f"Model '{request.model_name}' not found. Please train models first.")

        model = joblib.load(model_file)
        preprocessor = joblib.load(dataset_path / "preprocessor.pkl")

        try:
            with open(dataset_path / "training_features.json", "r") as f:
                expected_features = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=400, detail="Feature definitions missing. Retrain the model.")

        df_input = pd.DataFrame(request.rows)
        if hasattr(preprocessor, 'is_housing') and preprocessor.is_housing:
            X_transformed = preprocessor.transform(df_input)
        else:
            for col in expected_features:
                if col not in df_input.columns:
                    df_input[col] = np.nan
            df_input = df_input[[c for c in expected_features if c in df_input.columns]]
            X_transformed = preprocessor.transform(df_input)

        predictions = model.predict(X_transformed)

        # Log predictions to SQLite audit log
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

        return {"predictions": [float(p) for p in predictions]}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Prediction error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/predict/random/{dataset_id}/{model_name}")
async def predict_random(
    dataset_id: str,
    model_name: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        await verify_dataset_access(dataset_id, current_user)
        dataset_path = get_dataset_path(dataset_id)
        model_file = dataset_path / f"model_{model_name}.pkl"
        if not model_file.exists():
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found.")

        model = joblib.load(model_file)
        preprocessor = joblib.load(dataset_path / "preprocessor.pkl")

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

        # Log evaluation to SQLite
        try:
            await database.save_prediction(
                dataset_id=dataset_id,
                model_name=model_name,
                inputs=input_dict,
                prediction_value=prediction,
                actual_value=actual,
                difference=diff
            )
        except Exception as e:
            logger.warning(f"Failed to record random prediction evaluation in SQLite: {e}")

        return {
            "inputs": input_dict,
            "prediction": prediction,
            "actual_target": actual,
            "difference": diff
        }
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
        df = sync_internet_dataset(dataset_path)
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

        feature_imp = await asyncio.to_thread(get_feature_importance, dataset_id, model_name)
        shap_data = await asyncio.to_thread(compute_shap_values, dataset_id, model_name, 40)
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