from typing import Optional
from pydantic import BaseModel
from .canvas import FlowSnapshot

class GeneratePythonRequest(BaseModel):
    snapshot: FlowSnapshot
    options: Optional[dict] = {
        "include_comments": True,
        "include_docstrings": True
    }

class GeneratePythonResponse(BaseModel):
    success: bool
    code: Optional[str] = None
    error: Optional[str] = None

class ParsePythonRequest(BaseModel):
    code: str
    options: Optional[dict] = {}

class ParsePythonResponse(BaseModel):
    success: bool
    snapshot: Optional[FlowSnapshot] = None
    error: Optional[str] = None