# task_manager.py — Non-blocking Asynchronous Task Queue & Polling Engine for Valuo
"""
In-process Asynchronous Task Queue for heavy ML training jobs.
Eliminates event loop starvation in FastAPI endpoints by offloading heavy ML
workloads to worker threads with background status polling (/api/train/status/{task_id}).
"""

import asyncio
import concurrent.futures
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable, Tuple
import pandas as pd

try:
    from backend import database
except ImportError:
    import database

logger = logging.getLogger("valuo-task-manager")

class TaskManager:
    """
    Manages background training tasks and execution lifecycle without event loop starvation.
    """
    def __init__(self, max_workers: int = 4):
        self.executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="ValuoMLWorker"
        )
        self._active_tasks: Dict[str, Dict[str, Any]] = {}

    def register_task(
        self,
        task_id: str,
        dataset_id: str,
        user_id: Optional[str],
        target_column: str,
        models: List[str]
    ) -> Dict[str, Any]:
        """Register a new task in both active memory cache and SQLite."""
        now = datetime.now(timezone.utc).isoformat()
        task_info = {
            "task_id": task_id,
            "dataset_id": dataset_id,
            "user_id": user_id,
            "status": "queued",
            "progress": 0,
            "stage": "Job queued in worker queue",
            "target_column": target_column,
            "models": models,
            "results": None,
            "best_model": None,
            "error": None,
            "created_at": now,
            "updated_at": now,
            "completed_at": None
        }
        self._active_tasks[task_id] = task_info

        # Persist initial queued state into SQLite
        database._save_task_sync(
            task_id=task_id,
            dataset_id=dataset_id,
            user_id=user_id,
            target_column=target_column,
            models=models,
            status="queued",
            progress=0,
            stage="Job queued in worker queue"
        )
        return task_info

    def update_progress(self, task_id: str, progress: int, stage: str, status: str = "running"):
        """Update progress percentage and stage message for a running task."""
        now = datetime.now(timezone.utc).isoformat()
        if task_id in self._active_tasks:
            self._active_tasks[task_id]["progress"] = progress
            self._active_tasks[task_id]["stage"] = stage
            self._active_tasks[task_id]["status"] = status
            self._active_tasks[task_id]["updated_at"] = now
        database._update_task_sync(
            task_id=task_id,
            status=status,
            progress=progress,
            stage=stage
        )

    def mark_completed(self, task_id: str, results: List[dict], best_model: str):
        """Mark task as completed with evaluation results and best model."""
        now = datetime.now(timezone.utc).isoformat()
        if task_id in self._active_tasks:
            self._active_tasks[task_id].update({
                "status": "completed",
                "progress": 100,
                "stage": "Training completed successfully",
                "results": results,
                "best_model": best_model,
                "error": None,
                "updated_at": now,
                "completed_at": now
            })
        database._update_task_sync(
            task_id=task_id,
            status="completed",
            progress=100,
            stage="Training completed successfully",
            results=results,
            best_model=best_model,
            error=None
        )

    def mark_failed(self, task_id: str, error_msg: str):
        """Mark task as failed with error description."""
        now = datetime.now(timezone.utc).isoformat()
        curr_prog = self._active_tasks.get(task_id, {}).get("progress", 0)
        if task_id in self._active_tasks:
            self._active_tasks[task_id].update({
                "status": "failed",
                "stage": f"Training failed: {error_msg}",
                "error": error_msg,
                "updated_at": now,
                "completed_at": now
            })
        database._update_task_sync(
            task_id=task_id,
            status="failed",
            progress=curr_prog,
            stage=f"Training failed: {error_msg}",
            error=error_msg
        )

    def get_task(self, task_id: str) -> Optional[dict]:
        """Fetch task status from active memory or fallback to SQLite."""
        if task_id in self._active_tasks:
            return self._active_tasks[task_id].copy()

        db_task = database._get_task_sync(task_id)
        if db_task:
            return {
                "task_id": db_task["id"],
                "dataset_id": db_task["dataset_id"],
                "user_id": db_task.get("user_id"),
                "status": db_task["status"],
                "progress": db_task["progress"],
                "stage": db_task["stage"],
                "target_column": db_task["target_column"],
                "models": db_task.get("models", []),
                "results": db_task.get("results"),
                "best_model": db_task.get("best_model"),
                "error": db_task.get("error"),
                "created_at": db_task["created_at"],
                "updated_at": db_task["updated_at"],
                "completed_at": db_task.get("completed_at")
            }
        return None

    def list_tasks_for_dataset(self, dataset_id: str, user_id: Optional[str] = None, limit: int = 20) -> List[dict]:
        """List recent tasks for a given dataset."""
        return database._list_tasks_sync(dataset_id=dataset_id, user_id=user_id, limit=limit)


# Global singleton task manager instance
task_manager = TaskManager(max_workers=4)
