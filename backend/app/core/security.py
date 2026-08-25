import logging
from typing import Any, Optional
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: Optional[Any] = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def create_error_response(code: str, message: str, status_code: int = 400, details: Optional[Any] = None) -> JSONResponse:
    content = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details:
        content["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=content)


def create_success_response(data: Any, message: Optional[str] = None) -> dict:
    resp = {"success": True, "data": data}
    if message:
        resp["message"] = message
    return resp
