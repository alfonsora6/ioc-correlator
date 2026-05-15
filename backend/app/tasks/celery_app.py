import os

from celery import Celery

broker = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

celery_app = Celery("ioc_correlator", broker=broker, backend=backend)
celery_app.conf.task_default_queue = "ioc"
celery_app.conf.imports = ("app.tasks.batch_tasks",)
