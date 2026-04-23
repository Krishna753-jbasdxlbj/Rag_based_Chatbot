"""
vector_store.py
───────────────
Converts text chunks into vector embeddings and stores them in
ChromaDB for fast semantic retrieval — no API key required.
"""

import logging
from pathlib import Path
from typing import List

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"   # fast, lightweight, runs fully local
DB_PATH         = "./chroma_db"         # persistent storage directory


# ── Singleton embedding model ─────────────────────────────────────────────────
_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Return the embedding model, downloading and caching it on first call.
    Uses a module-level singleton so the model is only loaded once.
    """
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model '%s' …", EMBEDDING_MODEL)
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        logger.info("Embedding model ready.")
    return _embeddings


# ── Public helpers ─────────────────────────────────────────────────────────────

def create_vector_store(chunks: List[Document]) -> Chroma:
    """
    Embed *chunks* and persist them in a new ChromaDB collection.

    Args:
        chunks: Document objects returned by ``document_loader.load_and_split``.

    Returns:
        A ready-to-query Chroma vector store.
    """
    if not chunks:
        raise ValueError("Cannot create a vector store from an empty chunk list.")

    logger.info("Building vector store from %d chunk(s) …", len(chunks))
    embeddings = get_embeddings()

    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=DB_PATH,
    )
    logger.info("Vector store created and persisted at '%s'.", DB_PATH)
    return vector_store


def load_vector_store() -> Chroma:
    """
    Load an existing ChromaDB collection from disk.

    Returns:
        A Chroma vector store loaded from ``DB_PATH``.

    Raises:
        FileNotFoundError: If no persisted database exists at ``DB_PATH``.
    """
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(
            f"No vector store found at '{DB_PATH}'. "
            "Upload and process a PDF first."
        )
    logger.info("Loading existing vector store from '%s' …", DB_PATH)
    return Chroma(
        persist_directory=DB_PATH,
        embedding_function=get_embeddings(),
    )