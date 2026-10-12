# server.py (Optimized for Speed & Flexible Inputs)
from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uuid
import pandas as pd
import numpy as np
import joblib
import json
import io
import shutil
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, mean_absolute_percentage_error
import xgboost as xgb
import lightgbm as lgb
import shap
import warnings
from statsmodels.tsa.arima.model import ARIMA
import matplotlib
matplotlib.use('Agg')

warnings.filterwarnings('ignore')

# --- Setup ------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("houseprice-api")

mongo_url = os.getenv('MONGO_URL')
client = None
db = None
if mongo_url:
    try:
        client = AsyncIOMotorClient(mongo_url)
        db_name = os.getenv('DB_NAME')
        if db_name:
            db = client[db_name]
        logger.info("MongoDB client initialized.")
    except Exception as e:
        logger.exception("Failed to initialize MongoDB client: %s", str(e))
else:
    logger.info("No MONGO_URL found in .env — running without MongoDB.")

WORKSPACE_DIR = ROOT_DIR / "workspace"
WORKSPACE_DIR.mkdir(exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
MAX_UPLOAD_SIZE = int(os.getenv('MAX_UPLOAD_SIZE_BYTES', 50 * 1024 * 1024))

# --- Pydantic Models --------------------------------------------------------
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
    unique_values: Dict[str, List[Any]] # Added to populate dropdowns
    suggested_targets: List[str]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    models: List[str]
    test_size: float = 0.2
    random_state: int = 42
    cv_folds: Optional[int] = None

class PredictRequest(BaseModel):
    dataset_id: str
    model_name: str
    rows: List[Dict] # Can be partial data

class ForecastRequest(BaseModel):
    dataset_id: str
    date_column: str
    target_column: str
    periods: int = 12
    freq: str = "M"

# --- Helpers ---------------------------------------------------------------
def get_dataset_path(dataset_id: str) -> Path:
    return WORKSPACE_DIR / dataset_id

def get_dataset_file(dataset_id: str) -> Path:
    return get_dataset_path(dataset_id) / "dataset.csv"

def load_dataset(dataset_id: str) -> pd.DataFrame:
    return pd.read_csv(get_dataset_file(dataset_id))

def detect_column_types(df: pd.DataFrame) -> Dict[str, List[str]]:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    datetime_cols = []
    for col in categorical_cols:
        try:
            ser = pd.to_datetime(df[col], errors='coerce')
            if ser.notna().sum() > len(df) * 0.5:
                datetime_cols.append(col)
        except Exception:
            pass
    categorical_cols = [c for c in categorical_cols if c not in datetime_cols]
    
    # Filter high cardinality for OHE, but keep track of them
    filtered_categorical = []
    for c in categorical_cols:
        if df[c].nunique() < 500: 
            filtered_categorical.append(c)
            
    return {"numeric": numeric_cols, "categorical": filtered_categorical, "datetime": datetime_cols}

def suggest_target_columns(df: pd.DataFrame) -> List[str]:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    target_keywords = ['price', 'cost', 'value', 'amount', 'sale', 'median']
    suggested = [c for c in numeric_cols if any(k in c.lower() for k in target_keywords)]
    if not suggested:
        suggested = numeric_cols[:5]
    return suggested

def compute_eda(df: pd.DataFrame, column_types: Dict) -> Dict:
    eda = {}
    numeric_cols = column_types['numeric']
    if numeric_cols:
        summary_stats = df[numeric_cols].describe().to_dict()
        for col in summary_stats:
            for stat in list(summary_stats[col].keys()):
                val = summary_stats[col][stat]
                summary_stats[col][stat] = None if (pd.isna(val) or np.isinf(val)) else float(val)
        eda['summary_stats'] = summary_stats
    else:
        eda['summary_stats'] = {}
    
    # Simple Missing values
    missing = df.isnull().sum()
    eda['missing_values'] = {col: {"count": int(missing[col]), "percent": float((missing[col]/len(df)*100).round(2))} for col in df.columns}
    
    # Categorical info
    categorical_info = {}
    for col in column_types['categorical']:
        try:
            value_counts = df[col].value_counts()
            categorical_info[col] = {"unique_count": int(df[col].nunique()), "top_categories": {str(k): int(v) for k, v in value_counts.head(10).items()}}
        except Exception:
            categorical_info[col] = {"unique_count": 0, "top_categories": {}}
    eda['categorical_info'] = categorical_info

    # Correlations
    if len(numeric_cols) > 1:
        try:
            corr_df = df[numeric_cols].corr()
            corr_dict = {}
            for col in corr_df.columns:
                corr_dict[col] = {c: None if (pd.isna(corr_df[col][c]) or np.isinf(corr_df[col][c])) else float(corr_df[col][c]) for c in corr_df.index}
            eda['correlations'] = corr_dict
        except Exception:
            eda['correlations'] = {}
    else:
        eda['correlations'] = {}
        
    return eda

def build_preprocessing_pipeline(df: pd.DataFrame, target_column: str, column_types: Dict):
    numeric_cols = [c for c in column_types['numeric'] if c != target_column]
    categorical_cols = column_types['categorical']
    
    # Imputers handle missing data (NaN) automatically
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')), 
        ('scaler', RobustScaler())
    ])
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')), 
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False, max_categories=10))
    ])
    
    preprocessor = ColumnTransformer(transformers=[
        ('num', numeric_transformer, numeric_cols), 
        ('cat', categorical_transformer, categorical_cols)
    ])
    return preprocessor, numeric_cols, categorical_cols

def train_models(df: pd.DataFrame, target_column: str, models_to_train: List[str], test_size: float, random_state: int, cv_folds: Optional[int], dataset_id: str):
    column_types = detect_column_types(df)
    X = df.drop(columns=[target_column])
    y = df[target_column]
    
    # Save the original input columns expected by the model
    training_features = X.columns.tolist()
    
    preprocessor, numeric_cols, categorical_cols = build_preprocessing_pipeline(df, target_column, column_types)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
    
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)
    
    dataset_path = get_dataset_path(dataset_id)
    joblib.dump(preprocessor, dataset_path / "preprocessor.pkl")
    
    # Save training features list
    with open(dataset_path / "training_features.json", "w") as f:
        json.dump(training_features, f)

    # Save expanded feature names (for SHAP/Importance)
    feature_names = numeric_cols.copy()
    if categorical_cols:
        try:
            cat_features = preprocessor.named_transformers_['cat'].named_steps['onehot'].get_feature_names_out(categorical_cols)
            feature_names.extend(cat_features.tolist())
        except Exception:
            pass
    with open(dataset_path / "feature_names.json", "w") as f:
        json.dump(feature_names, f)
    
    model_dict = {
        "LinearRegression": LinearRegression(),
        "RandomForest": RandomForestRegressor(n_estimators=50, max_depth=15, random_state=random_state, n_jobs=-1),
        "XGBoost": xgb.XGBRegressor(n_estimators=50, max_depth=10, random_state=random_state, n_jobs=-1),
        "LightGBM": lgb.LGBMRegressor(n_estimators=50, max_depth=10, random_state=random_state, n_jobs=-1, verbose=-1)
    }
    
    results = []
    for model_name in models_to_train:
        if model_name not in model_dict:
            continue
        model = model_dict[model_name]
        
        import time
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
            
        cv_score = None
        
        joblib.dump(model, dataset_path / f"model_{model_name}.pkl")
        results.append({"model_name": model_name, "rmse": rmse, "mae": mae, "r2": r2, "mape": mape, "train_time": float(train_time), "cv_rmse": cv_score})
        
    if not results:
        raise ValueError("No valid models were trained.")
        
    best_model = min(results, key=lambda x: x['rmse'])
    best_model_name = best_model['model_name']
    shutil.copy(dataset_path / f"model_{best_model_name}.pkl", dataset_path / "model_best.pkl")
    with open(dataset_path / "model_candidates.json", "w") as f:
        json.dump({"models": results, "best_model": best_model_name, "target_column": target_column, "test_size": test_size, "random_state": random_state}, f)
    return results, best_model_name

def compute_shap_values(dataset_id: str, model_name: str, sample_size: int = 100):
    dataset_path = get_dataset_path(dataset_id)
    model = joblib.load(dataset_path / f"model_{model_name}.pkl")
    preprocessor = joblib.load(dataset_path / "preprocessor.pkl")
    df = load_dataset(dataset_id)
    with open(dataset_path / "model_candidates.json", "r") as f:
        model_info = json.load(f)
    target_column = model_info['target_column']
    X = df.drop(columns=[target_column])
    X_transformed = preprocessor.transform(X)
    
    if len(X_transformed) > sample_size:
        sample_indices = np.random.choice(len(X_transformed), sample_size, replace=False)
        X_sample = X_transformed[sample_indices]
    else:
        X_sample = X_transformed
        
    try:
        if isinstance(model, (xgb.XGBRegressor, lgb.LGBMRegressor, RandomForestRegressor)):
            explainer = shap.TreeExplainer(model)
        else:
            explainer = shap.LinearExplainer(model, X_sample)
        shap_values = explainer.shap_values(X_sample)
        
        with open(dataset_path / "feature_names.json", "r") as f:
            feature_names = json.load(f)
            
        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        mean_shap = np.abs(shap_values).mean(axis=0)
        limit = min(len(mean_shap), len(feature_names))
        top_indices = np.argsort(mean_shap[:limit])[-20:][::-1]
        
        return {"feature_names": [feature_names[i] for i in top_indices], "mean_shap_values": mean_shap[top_indices].tolist()}
    except Exception:
        return None

def get_feature_importance(dataset_id: str, model_name: str):
    dataset_path = get_dataset_path(dataset_id)
    model = joblib.load(dataset_path / f"model_{model_name}.pkl")
    with open(dataset_path / "feature_names.json", "r") as f:
        feature_names = json.load(f)
    try:
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
            limit = min(len(importances), len(feature_names))
            top_indices = np.argsort(importances[:limit])[-20:][::-1]
            return {"feature_names": [feature_names[i] for i in top_indices], "importances": importances[top_indices].tolist()}
        else:
            return None
    except Exception:
        return None

def forecast_time_series(dataset_id: str, date_column: str, target_column: str, periods: int, freq: str):
    df = load_dataset(dataset_id)
    df[date_column] = pd.to_datetime(df[date_column])
    df = df.sort_values(date_column)
    df.set_index(date_column, inplace=True)
    ts = pd.to_numeric(df[target_column], errors='coerce').dropna()
    if freq:
        try:
            ts = ts.resample(freq).mean().dropna()
        except Exception:
            pass
    try:
        model = ARIMA(ts, order=(1, 1, 1))
        fitted_model = model.fit()
        forecast = fitted_model.forecast(steps=periods)
        forecast_result = fitted_model.get_forecast(steps=periods)
        conf_int = forecast_result.conf_int()
        last_date = ts.index[-1]
        forecast_dates = pd.date_range(start=last_date, periods=periods+1, freq=freq)[1:]
        return {"historical_dates": ts.index.strftime('%Y-%m-%d').tolist(), "historical_values": ts.values.tolist(), "forecast_dates": forecast_dates.strftime('%Y-%m-%d').tolist(), "forecast_values": forecast.tolist(), "lower_bound": conf_int.iloc[:, 0].tolist(), "upper_bound": conf_int.iloc[:, 1].tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")

# --- Routes ----------------------------------------------------------------
@api_router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        size = len(contents)
        if size > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_UPLOAD_SIZE} bytes.")
        dataset_id = str(uuid.uuid4())
        dataset_path = get_dataset_path(dataset_id)
        dataset_path.mkdir(exist_ok=True)
        try:
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(io.BytesIO(contents))
            elif file.filename.lower().endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(contents))
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format.")
        except Exception:
            raise HTTPException(status_code=400, detail="Failed to read file.")
        
        df.to_csv(dataset_path / "dataset.csv", index=False)
        return UploadResponse(dataset_id=dataset_id, filename=file.filename, rows=len(df), columns=len(df.columns), column_names=df.columns.tolist(), sample_data=df.head(5).to_dict('records'))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Upload error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/meta/{dataset_id}", response_model=MetaResponse)
async def get_dataset_meta(dataset_id: str):
    try:
        df = load_dataset(dataset_id)
        column_types = detect_column_types(df)
        suggested_targets = suggest_target_columns(df)
        col_type_map = {}
        for col in df.columns:
            if col in column_types['numeric']: col_type_map[col] = 'numeric'
            elif col in column_types['categorical']: col_type_map[col] = 'categorical'
            elif col in column_types['datetime']: col_type_map[col] = 'datetime'
        
        # Get unique values for categorical columns (for dropdowns)
        unique_values = {}
        for col in column_types['categorical']:
            # Take top 50 to avoid massive payloads
            unique_values[col] = df[col].dropna().unique().tolist()[:50]
            
        return MetaResponse(dataset_id=dataset_id, rows=len(df), columns=len(df.columns), column_types=col_type_map, unique_values=unique_values, suggested_targets=suggested_targets, numeric_columns=column_types['numeric'], categorical_columns=column_types['categorical'], datetime_columns=column_types['datetime'])
    except Exception as e:
        logger.exception("Meta error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/eda/{dataset_id}")
async def get_eda(dataset_id: str):
    try:
        df = load_dataset(dataset_id)
        column_types = detect_column_types(df)
        return compute_eda(df, column_types)
    except Exception as e:
        logger.exception("EDA error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/train")
async def train_model(request: TrainRequest):
    try:
        df = load_dataset(request.dataset_id)
        if request.target_column not in df.columns:
            raise HTTPException(status_code=400, detail="Target column not found")
        results, best_model_name = train_models(df, request.target_column, request.models, request.test_size, request.random_state, request.cv_folds, request.dataset_id)
        return {"results": results, "best_model": best_model_name}
    except Exception as e:
        logger.exception("Train error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/models/{dataset_id}")
async def get_models(dataset_id: str):
    try:
        dataset_path = get_dataset_path(dataset_id)
        with open(dataset_path / "model_candidates.json", "r") as f:
            return json.load(f)
    except Exception:
        raise HTTPException(status_code=404, detail="Models not found")

@api_router.post("/predict")
async def predict(request: PredictRequest):
    try:
        dataset_path = get_dataset_path(request.dataset_id)
        model = joblib.load(dataset_path / f"model_{request.model_name}.pkl")
        preprocessor = joblib.load(dataset_path / "preprocessor.pkl")
        
        # Load expected feature list
        try:
            with open(dataset_path / "training_features.json", "r") as f:
                expected_features = json.load(f)
        except FileNotFoundError:
             raise HTTPException(status_code=400, detail="Feature definition file missing. Please retrain.")

        # Convert input to DataFrame
        df_input = pd.DataFrame(request.rows)
        
        # Ensure all columns exist (fill missing with NaN)
        # This handles the case where user only sends "bhk", "bath" but model needs "location" too.
        # The SimpleImputer in the pipeline will handle the NaNs.
        for col in expected_features:
            if col not in df_input.columns:
                df_input[col] = np.nan
        
        # Reorder columns to strictly match training data
        df_input = df_input[expected_features]
        
        X_transformed = preprocessor.transform(df_input)
        predictions = model.predict(X_transformed)
        return {"predictions": predictions.tolist()}
    except Exception as e:
        logger.exception("Prediction error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/predict/random/{dataset_id}/{model_name}")
async def predict_random(dataset_id: str, model_name: str):
    try:
        dataset_path = get_dataset_path(dataset_id)
        model = joblib.load(dataset_path / f"model_{model_name}.pkl")
        preprocessor = joblib.load(dataset_path / "preprocessor.pkl")
        
        with open(dataset_path / "training_features.json", "r") as f:
            expected_features = json.load(f)
            
        df = load_dataset(dataset_id)
        sample_row = df.sample(n=1)
        
        # Ensure we only use columns that were used in training
        input_data = sample_row[expected_features]
        
        X_transformed = preprocessor.transform(input_data)
        prediction = model.predict(X_transformed)[0]
        
        with open(dataset_path / "model_candidates.json", "r") as f:
            model_info = json.load(f)
        target_column = model_info['target_column']
        
        actual = sample_row[target_column].iloc[0] if target_column in sample_row.columns else None
        
        return {
            "inputs": input_data.iloc[0].replace({np.nan: None}).to_dict(),
            "prediction": float(prediction),
            "actual_target": float(actual) if actual is not None else None
        }
    except Exception as e:
        logger.exception("Random predict error")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/forecast")
async def forecast(request: ForecastRequest):
    try:
        return forecast_time_series(request.dataset_id, request.date_column, request.target_column, request.periods, request.freq)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/explainability/{dataset_id}/{model_name}")
async def get_explainability(dataset_id: str, model_name: str):
    try:
        feature_imp = get_feature_importance(dataset_id, model_name)
        shap_data = compute_shap_values(dataset_id, model_name)
        return {"feature_importance": feature_imp, "shap_values": shap_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "House Price Prediction API"}

app.include_router(api_router)

origins = os.getenv('CORS_ORIGINS', '*')
if isinstance(origins, str):
    origins = origins.split(',') if origins != '*' else ["*"]

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