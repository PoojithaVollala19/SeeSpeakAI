import uvicorn
import os
import sys

if __name__ == "__main__":
    # Ensure current working directory is on sys.path
    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="info")
