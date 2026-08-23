from arq.connections import RedisSettings
from app.config import settings
from app.workers.tasks import process_document

class WorkerSettings:
    # Worker class configurations parsed by arq worker process daemon launcher command line
    functions = [process_document]
    
    # Parse redis parameters from config URLs
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    
    # Retries configurations
    max_jobs = 10
    job_timeout = 300
    keep_result = 600
