#!/usr/bin/env python3
"""
Valuo Backend API Test Suite
Tests authentication, dataset ingestion, exploratory analysis,
two-model ML training (RandomForest & XGBoost), explainability,
prediction with random test row, and forecasting.
"""

import requests
import sys
import json
import time
from datetime import datetime
from pathlib import Path
import os

class ValuoAPITester:
    def __init__(self, base_url="http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.api_url = f"{self.base_url}/api"
        self.dataset_id = None
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name} - {details}")
        
        self.test_results.append({
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        req_headers = {}
        if self.token:
            req_headers["Authorization"] = f"Bearer {self.token}"
        if headers:
            req_headers.update(headers)
        if files is None and 'Content-Type' not in req_headers:
            req_headers['Content-Type'] = 'application/json'

        print(f"\n[Test] {name} ({method} {endpoint})")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=req_headers, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=req_headers, timeout=60)

            success = response.status_code == expected_status
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except Exception:
                    return True, response.text
            else:
                error_msg = f"Expected HTTP {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except Exception:
                    error_msg += f" - {response.text[:200]}"
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        return self.run_test("Root API Status", "GET", "", 200)

    def test_auth_signup(self):
        signup_data = {
            "name": "Alex Developer",
            "email": f"alex.test.{int(time.time())}@valuo.ai",
            "password": "SecurePassword123"
        }
        success, resp = self.run_test("User Signup", "POST", "auth/signup", 200, data=signup_data)
        if success and "token" in resp:
            self.token = resp["token"]
            self.test_email = signup_data["email"]
            return True, resp
        return False, {}

    def test_auth_me(self):
        return self.run_test("Current User Profile (auth/me)", "GET", "auth/me", 200)

    def test_auth_login(self):
        if not hasattr(self, 'test_email'):
            return False, {}
        login_data = {
            "email": self.test_email,
            "password": "SecurePassword123",
            "remember_me": True
        }
        success, resp = self.run_test("User Login", "POST", "auth/login", 200, data=login_data)
        if success and "token" in resp:
            self.token = resp["token"]
            return True, resp
        return False, {}

    def test_upload_dataset(self):
        # Look for existing sample dataset in workspace
        root_dir = Path(__file__).parent
        canonical = root_dir / "backend" / "workspace" / "06390047-ef89-4508-b930-6fc7a47f5e05" / "dataset.csv"
        if canonical.exists():
            sample_file = canonical
        else:
            sample_file = None
            for p in (root_dir / "backend" / "workspace").glob("*/dataset.csv"):
                sample_file = p
                break
        
        if not sample_file or not sample_file.exists():
            # Create a small sample CSV
            sample_file = root_dir / "backend" / "sample_housing.csv"
            sample_file.write_text(
                "area_sqft,bedrooms,bathrooms,location,price\n"
                "1200,2,2,Indiranagar,75.0\n"
                "1600,3,2,Whitefield,95.0\n"
                "2100,3,3,Koramangala,145.0\n"
                "2800,4,4,Indiranagar,210.0\n"
                "1100,2,2,Whitefield,68.0\n"
                "1750,3,3,HSR Layout,110.0\n"
                "3200,4,4,Koramangala,260.0\n"
                "1400,2,2,HSR Layout,88.0\n"
            )

        with open(sample_file, 'rb') as f:
            files = {'file': ('dataset.csv', f, 'text/csv')}
            success, response = self.run_test(
                "Upload Housing Dataset", 
                "POST", 
                "upload", 
                200, 
                files=files
            )
        
        if success and 'dataset_id' in response:
            self.dataset_id = response['dataset_id']
            print(f"   Created Dataset ID: {self.dataset_id}")
            return True, response
        return False, {}

    def test_get_meta(self):
        return self.run_test("Dataset Metadata", "GET", f"meta/{self.dataset_id}", 200)

    def test_get_eda(self):
        return self.run_test("Dataset EDA Profiling", "GET", f"eda/{self.dataset_id}", 200)

    def test_train_models(self):
        # Only 2 models: RandomForest and XGBoost
        train_data = {
            "dataset_id": self.dataset_id,
            "target_column": "price",
            "models": ["RandomForest", "XGBoost"],
            "test_size": 0.25,
            "random_state": 42
        }
        return self.run_test("Train Models (RF & XGBoost)", "POST", "train", 200, data=train_data)

    def test_train_models_async_and_polling(self):
        train_data = {
            "dataset_id": self.dataset_id,
            "target_column": "price",
            "models": ["RandomForest", "XGBoost"],
            "test_size": 0.25,
            "random_state": 42
        }
        # 1. Post to async training endpoint
        success, resp = self.run_test("Dispatch Async Training Task (/api/train/async)", "POST", "train/async", 202, data=train_data)
        if not success or "task_id" not in resp:
            return False, {}
        task_id = resp["task_id"]

        # 2. Concurrency test: ping root health check while background worker is running
        t0 = time.time()
        health_res = requests.get(f"{self.api_url}/", timeout=5)
        dt_ms = (time.time() - t0) * 1000
        concurrency_ok = health_res.status_code == 200 and dt_ms < 1000
        self.log_test("Event Loop Liveness during ML Task (concurrent /api/ < 1s)", concurrency_ok, f"Status: {health_res.status_code}, Latency: {dt_ms:.1f}ms")

        # 3. Poll /api/train/status/{task_id}
        completed = False
        final_resp = {}
        for _ in range(30):
            time.sleep(0.4)
            s_res = requests.get(
                f"{self.api_url}/train/status/{task_id}",
                headers={"Authorization": f"Bearer {self.token}"} if self.token else {}
            )
            if s_res.status_code == 200:
                s_data = s_res.json()
                if s_data.get("status") == "completed":
                    completed = True
                    final_resp = s_data
                    break

        self.log_test("Background Task Completion via Status Polling", completed, f"Final status: {final_resp.get('status')}")
        return completed, final_resp

    def test_get_models(self):
        return self.run_test("Get Model Leaderboard", "GET", f"models/{self.dataset_id}", 200)

    def test_explainability(self):
        return self.run_test("Explainability (SHAP & Importance)", "GET", f"explainability/{self.dataset_id}/RandomForest", 200)

    def test_predict(self):
        predict_data = {
            "dataset_id": self.dataset_id,
            "model_name": "RandomForest",
            "rows": [{
                "area_sqft": 1500,
                "bedrooms": 3,
                "bathrooms": 2,
                "location": "Whitefield"
            }]
        }
        return self.run_test("Calculate Price Prediction", "POST", "predict", 200, data=predict_data)

    def test_predict_random(self):
        return self.run_test("Random Test Row Evaluation", "GET", f"predict/random/{self.dataset_id}/RandomForest", 200)

    def test_tampered_model_signature_rejection(self):
        if not self.dataset_id:
            return False, {}
        model_file = Path(__file__).parent / "backend" / "workspace" / self.dataset_id / "model_RandomForest.pkl"
        if not model_file.exists():
            return False, {}

        original_bytes = model_file.read_bytes()
        try:
            # Tamper with the model file by appending bytes
            with open(model_file, "ab") as f:
                f.write(b"ATTACKER_TAMPERED_BYTES")

            predict_data = {
                "dataset_id": self.dataset_id,
                "model_name": "RandomForest",
                "rows": [{
                    "area_sqft": 1500,
                    "bedrooms": 3,
                    "bathrooms": 2,
                    "location": "Whitefield"
                }]
            }
            # The backend must reject the tampered artifact with HTTP 403 Forbidden
            success, _ = self.run_test(
                "Reject Tampered Model Deserialization (HMAC-SHA256)",
                "POST",
                "predict",
                403,
                data=predict_data
            )
            return success, {}
        finally:
            # Restore original clean model bytes
            model_file.write_bytes(original_bytes)

    def test_db_stats(self):
        success, resp = self.run_test("SQLite Storage Stats", "GET", "db/stats", 200)
        if success and resp.get("engine") == "SQLite":
            print(f"   Database Size: {resp.get('size_formatted')}, Tables: {resp.get('tables')}")
            return True, resp
        return False, {}

    def test_list_datasets(self):
        return self.run_test("List Datasets in Database", "GET", "datasets", 200)

    def test_get_predictions(self):
        return self.run_test("Query Persisted Predictions", "GET", f"predictions/{self.dataset_id}", 200)

    def test_auth_logout(self):
        return self.run_test("User Logout", "POST", "auth/logout", 200)

    def run_all_tests(self):
        print("Valuo API Test Suite")
        print(f"Target URL: {self.base_url}")
        print("=" * 60)
        
        self.test_root_endpoint()
        self.test_db_stats()

        # Security tests: verify unauthenticated requests are rejected
        saved_token = self.token
        self.token = None
        self.run_test("Reject Unauthenticated Datasets Access", "GET", "datasets", 401)
        self.run_test("Reject Unauthenticated Upload", "POST", "upload", 401)
        self.token = saved_token

        self.test_auth_signup()
        self.test_auth_me()
        self.test_auth_login()
        
        success, _ = self.test_upload_dataset()
        if not success:
            print("\nDataset upload failed - halting pipeline tests")
            return self.get_results()

        # IDOR Security test: verify user B cannot access user A's dataset
        if self.dataset_id:
            user_b = requests.post(f"{self.api_url}/auth/signup", json={
                "name": "User B Attacker",
                "email": f"attacker.{int(time.time())}@valuo.ai",
                "password": "Password12345"
            }).json()
            b_token = user_b.get("token")
            if b_token:
                res = requests.get(f"{self.api_url}/meta/{self.dataset_id}", headers={"Authorization": f"Bearer {b_token}"})
                self.log_test("IDOR Prevention (User B blocked from User A dataset)", res.status_code == 403, f"Status: {res.status_code}")

        self.test_get_meta()
        self.test_get_eda()
        self.test_list_datasets()
        
        print("\nTraining models (Random Forest & XGBoost)...")
        train_success, _ = self.test_train_models()
        if train_success:
            self.test_train_models_async_and_polling()
            self.test_get_models()
            self.test_explainability()
            self.test_predict()
            self.test_predict_random()
            self.test_tampered_model_signature_rejection()
            self.test_get_predictions()

        self.test_auth_logout()
        results = self.get_results()
        self.cleanup()
        return results

    def cleanup(self):
        if self.dataset_id:
            test_ws = Path(__file__).parent / "backend" / "workspace" / self.dataset_id
            if test_ws.exists():
                import shutil
                shutil.rmtree(test_ws, ignore_errors=True)
                print(f"Cleaned up temporary test workspace: {self.dataset_id}")

    def get_results(self):
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        results = {
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "failed_tests": self.tests_run - self.tests_passed,
                "success_rate": f"{success_rate:.1f}%"
            },
            "test_details": self.test_results,
            "dataset_id": self.dataset_id
        }
        print("\n" + "=" * 60)
        print("TEST RESULTS SUMMARY")
        print(f"Total: {self.tests_run} | Passed: {self.tests_passed} | Failed: {self.tests_run - self.tests_passed} | Rate: {success_rate:.1f}%")
        print("=" * 60)
        return results

def main():
    target_url = "http://127.0.0.1:8000"
    save_report = "--save-report" in sys.argv
    for arg in sys.argv[1:]:
        if arg.startswith("http"):
            target_url = arg

    tester = ValuoAPITester(base_url=target_url)
    results = tester.run_all_tests()
    
    if save_report:
        reports_dir = Path(__file__).parent / "test_reports"
        reports_dir.mkdir(exist_ok=True)
        report_file = reports_dir / f"backend_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Report saved to: {report_file}")

    return 0 if results['summary']['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())