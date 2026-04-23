"""app.py - Flask web server for RAG chatbot"""
import logging
import os
import tempfile
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
from rag_pipeline import build_rag_chain, ask_question

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR   = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TMPL_DIR   = BASE_DIR / "templates"

app = Flask(__name__, static_folder=str(STATIC_DIR), template_folder=str(TMPL_DIR))
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

_rag_chain = None
_pdf_name  = None
_upload_dir = tempfile.mkdtemp(prefix="rag_uploads_")

@app.get("/")
def index():
    return send_from_directory(str(TMPL_DIR), "index.html")

@app.get("/health")
def health():
    return jsonify(status="ok", pdf_loaded=_rag_chain is not None)

@app.post("/upload")
def upload():
    global _rag_chain, _pdf_name
    if "file" not in request.files:
        return jsonify(success=False, message="No file field in request."), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify(success=False, message="No file selected."), 400
    filename = secure_filename(file.filename)
    if not filename.lower().endswith(".pdf"):
        return jsonify(success=False, message="Only PDF files are supported."), 415

    save_path = Path(_upload_dir) / filename
    file.save(str(save_path))
    logger.info("Saved upload to: %s", save_path)

    try:
        _rag_chain = build_rag_chain(str(save_path))
        _pdf_name  = filename
        return jsonify(success=True, message=f'"{filename}" indexed successfully.', filename=filename)
    except Exception as exc:
        logger.exception("Failed to build RAG chain for %s", filename)
        return jsonify(success=False, message=f"Processing error: {exc}"), 500

@app.post("/chat")
def chat():
    if _rag_chain is None:
        return jsonify(success=False, message="Please upload a PDF first."), 400
    data     = request.get_json(force=True, silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify(success=False, message="Question cannot be empty."), 400
    try:
        answer, sources = ask_question(_rag_chain, question)
        return jsonify(success=True, answer=answer, sources=sources)
    except Exception as exc:
        logger.exception("Error answering question: %r", question)
        return jsonify(success=False, message=f"Error: {exc}"), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info("Starting RAG Chatbot on http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=False)