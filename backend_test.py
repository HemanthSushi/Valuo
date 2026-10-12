#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime
from pathlib import Path

class HousePricePredictionAPITester:
    def __init__(self, base_url="https://homeprice-genius-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.dataset_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        
        if files is None:
            headers['Content-Type'] = 'application/json'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=60)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_upload_dataset(self):
        """Test dataset upload"""
        sample_file_path = "/tmp/house_prices_sample.csv"
        
        if not Path(sample_file_path).exists():
            self.log_test("Upload Dataset", False, "Sample file not found")
            return False, {}
        
        with open(sample_file_path, 'rb') as f:
            files = {'file': ('house_prices_sample.csv', f, 'text/csv')}
            success, response = self.run_test(
                "Upload Dataset", 
                "POST", 
                "upload", 
                200, 
                files=files
            )
        
        if success and 'dataset_id' in response:
            self.dataset_id = response['dataset_id']
            print(f"   Dataset ID: {self.dataset_id}")
            return True, response
        
        return False, {}

    def test_get_meta(self):
        """Test getting dataset metadata"""
        if not self.dataset_id:
            self.log_test("Get Dataset Meta", False, "No dataset ID available")
            return False, {}
        
        return self.run_test(
            "Get Dataset Meta",
            "GET",
            f"meta/{self.dataset_id}",
            200
        )

    def test_get_eda(self):
        """Test getting EDA data"""
        if not self.dataset_id:
            self.log_test("Get EDA Data", False, "No dataset ID available")
            return False, {}
        
        return self.run_test(
            "Get EDA Data",
            "GET",
            f"eda/{self.dataset_id}",
            200
        )

    def test_train_models(self):
        """Test model training"""
        if not self.dataset_id:
            self.log_test("Train Models", False, "No dataset ID available")
            return False, {}
        
        train_data = {
            "dataset_id": self.dataset_id,
            "target_column": "price",
            "models": ["LinearRegression", "RandomForest", "XGBoost", "LightGBM"],
            "test_size": 0.2,
            "random_state": 42,
            "cv_folds": 3
        }
        
        return self.run_test(
            "Train Models",
            "POST",
            "train",
            200,
            data=train_data
        )

    def test_get_models(self):
        """Test getting trained models"""
        if not self.dataset_id:
            self.log_test("Get Models", False, "No dataset ID available")
            return False, {}
        
        return self.run_test(
            "Get Models",
            "GET",
            f"models/{self.dataset_id}",
            200
        )

    def test_explainability(self):
        """Test explainability endpoint"""
        if not self.dataset_id:
            self.log_test("Get Explainability", False, "No dataset ID available")
            return False, {}
        
        return self.run_test(
            "Get Explainability",
            "GET",
            f"explainability/{self.dataset_id}/RandomForest",
            200
        )

    def test_predict(self):
        """Test prediction endpoint"""
        if not self.dataset_id:
            self.log_test("Make Prediction", False, "No dataset ID available")
            return False, {}
        
        # Sample prediction data
        predict_data = {
            "dataset_id": self.dataset_id,
            "model_name": "RandomForest",
            "rows": [{
                "bedrooms": 3,
                "bathrooms": 2,
                "sqft_living": 1500,
                "sqft_lot": 6000,
                "floors": 1,
                "waterfront": 0,
                "view": 0,
                "condition": 3,
                "grade": 7,
                "sqft_above": 1500,
                "sqft_basement": 0,
                "yr_built": 1990,
                "yr_renovated": 0,
                "zipcode": 98125
            }]
        }
        
        return self.run_test(
            "Make Prediction",
            "POST",
            "predict",
            200,
            data=predict_data
        )

    def test_forecast(self):
        """Test time series forecasting (optional)"""
        if not self.dataset_id:
            self.log_test("Time Series Forecast", False, "No dataset ID available")
            return False, {}
        
        # This might fail if no proper date column exists
        forecast_data = {
            "dataset_id": self.dataset_id,
            "date_column": "yr_built",  # Using year as proxy
            "target_column": "price",
            "periods": 5,
            "freq": "Y"
        }
        
        # This test is expected to potentially fail due to data format
        success, response = self.run_test(
            "Time Series Forecast",
            "POST",
            "forecast",
            200,
            data=forecast_data
        )
        
        # Don't count this as a critical failure
        return success, response

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting House Price Prediction API Tests")
        print(f"   Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test basic connectivity
        self.test_root_endpoint()
        
        # Test upload workflow
        success, _ = self.test_upload_dataset()
        if not success:
            print("\n❌ Upload failed - cannot continue with dependent tests")
            return self.get_results()
        
        # Test metadata and EDA
        self.test_get_meta()
        self.test_get_eda()
        
        # Test training (this takes time)
        print("\n⏳ Training models (this may take 30-60 seconds)...")
        success, _ = self.test_train_models()
        if not success:
            print("\n❌ Training failed - cannot test model-dependent endpoints")
            return self.get_results()
        
        # Wait a bit for training to complete
        time.sleep(2)
        
        # Test model retrieval and usage
        self.test_get_models()
        self.test_explainability()
        self.test_predict()
        
        # Test forecasting (optional)
        self.test_forecast()
        
        return self.get_results()

    def get_results(self):
        """Get test results summary"""
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
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.dataset_id:
            print(f"Dataset ID: {self.dataset_id}")
        
        return results

def main():
    """Main test execution"""
    tester = HousePricePredictionAPITester()
    results = tester.run_all_tests()
    
    # Save results to file
    results_file = f"/app/test_reports/backend_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Results saved to: {results_file}")
    
    # Return appropriate exit code
    if results['summary']['failed_tests'] == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {results['summary']['failed_tests']} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())