# pipeline.py — Robust Preprocessing & Valuation Modeling Engine for Valuo
"""
Production-grade ML pipeline with real estate domain intelligence,
outlier filtering, smooth target encoding, and dual-engine regression (RandomForest & XGBoost)
targeting >90% accuracy (R2 >= 0.90).
"""

import re
import urllib.request
import io
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin, TransformerMixin
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

INTERNET_DATASET_URL = "https://raw.githubusercontent.com/abhijitpaul0212/DataSets/main/Bengaluru_House_Data.csv"

def parse_bhk_val(val: Any) -> float:
    """Parse bedroom count from integers, floats, or strings like '2 BHK' or '4 Bedroom'."""
    if pd.isna(val):
        return 2.0
    val_str = str(val).strip()
    match = re.search(r'(\d+)', val_str)
    if match:
        return float(match.group(1))
    return 2.0

def convert_sqft_val(x: Any) -> float:
    """Convert square footage from ranges (e.g., '2100 - 2850') and non-sqft units into standard sqft float."""
    if pd.isna(x):
        return np.nan
    x_str = re.sub(r',', '', str(x).strip())
    if '-' in x_str:
        tokens = x_str.split('-')
        try:
            return (float(tokens[0].strip()) + float(tokens[1].strip())) / 2.0
        except Exception:
            return np.nan
    match = re.match(r'^([\d\.]+)', x_str)
    if match:
        try:
            num = float(match.group(1))
            unit = x_str.lower()
            if 'sq. meter' in unit or 'sq. metre' in unit:
                return num * 10.7639
            elif 'perch' in unit:
                return num * 272.25
            elif 'sq. yards' in unit:
                return num * 9.0
            elif 'acres' in unit:
                return num * 43560.0
            elif 'guntha' in unit:
                return num * 1089.0
            elif 'cents' in unit:
                return num * 435.56
            return num
        except Exception:
            return np.nan
    return np.nan

def clean_housing_df(df_in: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names and types for housing dataframes."""
    df = df_in.copy()
    col_map = {}
    for col in df.columns:
        c_low = col.lower().strip()
        if c_low in ['total_sqft', 'area_sqft', 'sqft', 'square_feet', 'area']:
            col_map[col] = 'total_sqft'
        elif c_low in ['size', 'bhk', 'bedroom', 'bedrooms', 'rooms']:
            col_map[col] = 'bhk'
        elif c_low in ['bath', 'bathroom', 'bathrooms']:
            col_map[col] = 'bath'
        elif c_low in ['balcony', 'balconies']:
            col_map[col] = 'balcony'
        elif c_low in ['location', 'locality', 'neighborhood']:
            col_map[col] = 'location'
        elif c_low in ['area_type', 'property_type']:
            col_map[col] = 'area_type'
    if col_map:
        df = df.rename(columns=col_map)
        
    if 'total_sqft' in df.columns:
        df['total_sqft'] = df['total_sqft'].apply(convert_sqft_val)
    if 'bhk' in df.columns:
        df['bhk'] = df['bhk'].apply(parse_bhk_val)
    if 'bath' in df.columns:
        df['bath'] = pd.to_numeric(df['bath'], errors='coerce')
        if 'bhk' in df.columns:
            df['bath'] = df['bath'].fillna(df['bhk'])
    if 'balcony' in df.columns:
        df['balcony'] = pd.to_numeric(df['balcony'], errors='coerce').fillna(1.0)
    if 'location' in df.columns:
        df['location'] = df['location'].fillna('other').astype(str).str.strip()
    if 'area_type' in df.columns:
        df['area_type'] = df['area_type'].fillna('Super built-up  Area').astype(str).str.strip()
    return df

def filter_housing_training_data(df_train: pd.DataFrame, target_column: str = 'price') -> pd.DataFrame:
    """
    Apply domain anomaly filtering STRICTLY to the training partition.
    Never apply target-based filtering to test partitions or inference data.
    """
    df_clean = df_train.copy()
    if target_column not in df_clean.columns or 'total_sqft' not in df_clean.columns:
        return df_clean

    df_clean = df_clean.dropna(subset=[target_column, 'total_sqft'])
    df_clean[target_column] = pd.to_numeric(df_clean[target_column], errors='coerce')
    df_clean = df_clean.dropna(subset=[target_column])
    
    # 1. Physical anomalies on training data
    if 'bhk' in df_clean.columns:
        df_clean = df_clean[df_clean['total_sqft'] / np.maximum(df_clean['bhk'], 1.0) >= 200]
    if 'bath' in df_clean.columns and 'bhk' in df_clean.columns:
        df_clean = df_clean[df_clean['bath'] <= (df_clean['bhk'] + 2)]

    # 2. Trim extreme target PPS outliers on training set (0.5% and 99.5% quantiles)
    pps = (df_clean[target_column] * 100000.0) / np.maximum(df_clean['total_sqft'], 10.0)
    p_low, p_high = pps.quantile(0.005), pps.quantile(0.995)
    df_clean = df_clean[(pps >= p_low) & (pps <= p_high)]

    return df_clean

def clean_and_filter_housing_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Safe cleaning for housing datasets without target leakage."""
    return clean_housing_df(df)

class ValuoLogRegressor(BaseEstimator, RegressorMixin):
    """
    Log-Transformed Target Valuation Regressor.
    Stabilizes real estate price heteroskedasticity by fitting tree ensembles
    on log1p(Price), then inverting predictions via expm1(Y).
    Guarantees positive, non-exploding property valuations on real-world test data.
    """
    def __init__(self, estimator=None):
        self.estimator = estimator

    def fit(self, X, y):
        y_arr = np.maximum(np.asarray(y, dtype=float), 1.0)
        y_log = np.log1p(y_arr)
        self.estimator.fit(X, y_log)
        return self

    def predict(self, X):
        pred_log = self.estimator.predict(X)
        pred_log = np.clip(pred_log, 0.0, 15.0)
        return np.expm1(pred_log)

    @property
    def feature_importances_(self):
        return getattr(self.estimator, 'feature_importances_', None)

# Alias for backwards compatibility
ValuoRateRegressor = ValuoLogRegressor

class ValuoPreprocessor(BaseEstimator, TransformerMixin):
    """
    Feature engineering pipeline for housing analytics.
    Computes ratio metrics, smooth Bayesian target encoding for neighborhoods,
    and area type adjustments. Supports generic tabular fallback when needed.
    """
    def __init__(self, target_column: str = 'price'):
        self.target_column = target_column
        self.is_housing = False
        self.feature_names = []
        self.loc_pps_map = {}
        self.loc_freq_map = {}
        self.area_pps_map = {}
        self.global_pps = 5000.0
        self.global_area_pps = 5000.0
        self.fallback_pipe = None

    def fit(self, df_raw: pd.DataFrame, y=None):
        df = clean_housing_df(df_raw)
        has_sqft = 'total_sqft' in df.columns
        has_bhk = 'bhk' in df.columns
        
        if has_sqft and has_bhk:
            self.is_housing = True
            if self.target_column in df.columns and y is None:
                y = df[self.target_column]
            
            sqft = df['total_sqft'].values
            if y is not None:
                pps = (np.asarray(y, dtype=float) * 100000.0) / np.maximum(sqft, 10.0)
                df['_pps'] = pps
                self.global_pps = float(np.nanmedian(pps))
                
                if 'location' in df.columns:
                    loc_clean = df['location'].fillna('other').astype(str).str.strip()
                    loc_counts = loc_clean.value_counts()
                    freq_locs = set(loc_counts[loc_counts >= 5].index)
                    loc_clean = loc_clean.apply(lambda x: x if x in freq_locs else 'other')
                    df['_loc_clean'] = loc_clean
                    
                    stats = df.groupby('_loc_clean')['_pps'].agg(['mean', 'count'])
                    sm = 8.0
                    loc_encoded = ((stats['count'] * stats['mean']) + (sm * self.global_pps)) / (stats['count'] + sm)
                    self.loc_pps_map = loc_encoded.to_dict()
                    self.loc_freq_map = (df['_loc_clean'].value_counts() / len(df)).to_dict()
                
                if 'area_type' in df.columns:
                    self.area_pps_map = df.groupby('area_type')['_pps'].mean().to_dict()
                    self.global_area_pps = float(np.nanmean(pps))
            
            self.feature_names = [
                'total_sqft', 'log_sqft', 'bhk', 'bath', 'balcony', 'sqft_per_bhk', 'bath_per_bhk',
                'is_ready', 'loc_encoded_pps', 'log_loc_pps', 'loc_frequency', 'area_encoded_pps',
                'expected_baseline_price', 'log_baseline_price'
            ]
        else:
            self.is_housing = False
            X = df.drop(columns=[self.target_column]) if self.target_column in df.columns else df
            num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
            cat_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
            num_pipe = Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', RobustScaler())])
            cat_pipe = Pipeline([('imputer', SimpleImputer(strategy='most_frequent')), ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False, max_categories=10))])
            self.fallback_pipe = ColumnTransformer([('num', num_pipe, num_cols), ('cat', cat_pipe, cat_cols)])
            self.fallback_pipe.fit(X)
            self.feature_names = num_cols.copy()
            if cat_cols:
                try:
                    c_names = self.fallback_pipe.named_transformers_['cat'].named_steps['onehot'].get_feature_names_out(cat_cols)
                    self.feature_names.extend(c_names.tolist())
                except Exception:
                    pass
        return self

    def transform(self, df_raw: pd.DataFrame):
        df = clean_housing_df(df_raw)
        if self.is_housing:
            sqft = df['total_sqft'].fillna(1200.0).astype(float) if 'total_sqft' in df.columns else pd.Series(1200.0, index=df.index)
            bhk = df['bhk'].fillna(2.0).astype(float) if 'bhk' in df.columns else pd.Series(2.0, index=df.index)
            bath = df['bath'].fillna(bhk).astype(float) if 'bath' in df.columns else bhk.copy()
            balcony = df['balcony'].fillna(1.0).astype(float) if 'balcony' in df.columns else pd.Series(1.0, index=df.index)
            
            sqft_per_bhk = sqft / np.maximum(bhk, 1.0)
            bath_per_bhk = bath / np.maximum(bhk, 1.0)
            
            if 'availability' in df.columns:
                is_ready = (df['availability'].astype(str).str.lower().str.contains('ready')).astype(float)
            else:
                is_ready = pd.Series(1.0, index=df.index)
                
            if 'location' in df.columns:
                loc_clean = df['location'].fillna('other').astype(str).str.strip()
                loc_pps = loc_clean.map(self.loc_pps_map).fillna(self.global_pps).astype(float)
                loc_freq = loc_clean.map(self.loc_freq_map).fillna(0.001).astype(float)
            else:
                loc_pps = pd.Series(self.global_pps, index=df.index)
                loc_freq = pd.Series(0.001, index=df.index)
                
            if 'area_type' in df.columns:
                area_pps = df['area_type'].map(self.area_pps_map).fillna(self.global_area_pps).astype(float)
            else:
                area_pps = pd.Series(self.global_area_pps, index=df.index)
                
            expected_baseline = (sqft * loc_pps) / 100000.0
            
            feats = pd.DataFrame({
                'total_sqft': sqft,
                'log_sqft': np.log1p(sqft),
                'bhk': bhk,
                'bath': bath,
                'balcony': balcony,
                'sqft_per_bhk': sqft_per_bhk,
                'bath_per_bhk': bath_per_bhk,
                'is_ready': is_ready,
                'loc_encoded_pps': loc_pps,
                'log_loc_pps': np.log1p(loc_pps),
                'loc_frequency': loc_freq,
                'area_encoded_pps': area_pps,
                'expected_baseline_price': expected_baseline,
                'log_baseline_price': np.log1p(expected_baseline)
            }, index=df.index)
            return feats.values
        else:
            X = df.drop(columns=[self.target_column]) if self.target_column in df.columns else df
            return self.fallback_pipe.transform(X)

def sync_internet_dataset(target_dir: Path) -> pd.DataFrame:
    """Fetch fresh canonical real estate dataset from internet."""
    req = urllib.request.Request(INTERNET_DATASET_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read()
    target_dir.mkdir(parents=True, exist_ok=True)
    csv_file = target_dir / "dataset.csv"
    with open(csv_file, "wb") as f:
        f.write(content)
    return pd.read_csv(csv_file)
