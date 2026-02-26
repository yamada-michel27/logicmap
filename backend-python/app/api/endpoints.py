from fastapi import APIRouter, HTTPException
from app.models.responses import (
    GeneratePythonRequest, GeneratePythonResponse,
    ParsePythonRequest, ParsePythonResponse
)
from app.services.canvas_to_python import CanvasToPythonConverter
from app.services.python_to_canvas import PythonToCanvasConverter

router = APIRouter()

@router.post("/canvas-to-python", response_model=GeneratePythonResponse)
async def canvas_to_python(request: GeneratePythonRequest):
    """キャンバスからPythonコードを生成"""
    try:
        print(f"[DEBUG] Received request: {request}")
        print(f"[DEBUG] Snapshot nodes count: {len(request.snapshot.nodes)}")
        print(f"[DEBUG] Snapshot edges count: {len(request.snapshot.edges)}")

        converter = CanvasToPythonConverter(request.options or {})
        code = converter.convert(request.snapshot)
        return GeneratePythonResponse(success=True, code=code)
    except Exception as e:
        print(f"[ERROR] Canvas to Python conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return GeneratePythonResponse(success=False, error=str(e))

@router.post("/python-to-canvas", response_model=ParsePythonResponse)
async def python_to_canvas(request: ParsePythonRequest):
    """PythonコードからキャンバスJSONを生成"""
    try:
        converter = PythonToCanvasConverter(request.options or {})
        snapshot = converter.convert(request.code)
        return ParsePythonResponse(success=True, snapshot=snapshot)
    except Exception as e:
        return ParsePythonResponse(success=False, error=str(e))

@router.get("/test")
async def test_endpoint():
    """テスト用エンドポイント"""
    return {"message": "Python service is working!"}