"""pytest config สำหรับ API tests."""
import os
import sys
import tempfile
from pathlib import Path

# ตั้ง env ก่อน import app
_tmp = tempfile.mkdtemp(prefix="ut-test-")
os.environ["DATA_DIR"] = _tmp
os.environ["APP_ENV"] = "development"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"

sys.path.insert(0, str(Path(__file__).parent.parent))
