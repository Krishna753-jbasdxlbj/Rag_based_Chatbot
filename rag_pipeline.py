"""rag_pipeline.py - RAG chain builder & query function"""
import logging
from dataclasses import dataclass
from pathlib import Path  # ← ADDED: for extracting filename from path
from typing import List, Tuple
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.documents import Document
from document_loader import load_and_split
from vector_store import create_vector_store

logger = logging.getLogger(__name__)  # ← FIXED: was logging.getLogger(name)

LLM_MODEL      = "mistral"
RETRIEVER_K    = 4

_PROMPT_TEMPLATE = """You are a knowledgeable assistant that answers questions strictly based on the provided document context.
Rules:
- Answer only from the context below; do not add outside knowledge.
- If the answer is not present, say exactly: "I don't know based on this document."
- Be concise, clear, and use bullet points when listing multiple items.
- Always cite the page number(s) where you found the information, e.g. [p. 3].

Context:
{context}
Question: {question}
Answer:"""

@dataclass
class RAGResponse:
    answer: str
    sources: List[str]

def _format_docs(docs: List[Document]) -> str:
    """Concatenate retrieved chunks with page attribution."""
    parts = []
    for doc in docs:
        page = doc.metadata.get("page", "?")
        parts.append(f"[p. {page + 1}]\n{doc.page_content.strip()}")
    return "\n\n---\n\n".join(parts)

def _extract_sources(docs: List[Document]) -> List[str]:
    """Build a de-duplicated list of source labels (filename only)."""
    seen = set()
    sources: List[str] = []
    for doc in docs:
        # ← FIXED: Extract just the filename from full temp path
        source_path = doc.metadata.get("source", "document")
        filename = Path(source_path).name  # e.g., "hp_vitus.pdf"
        
        page = doc.metadata.get("page", 0)
        label = f"{filename}, page {page + 1}"  # ← FIXED: uses filename
        
        if label not in seen:
            seen.add(label)
            sources.append(label)
    return sources

def build_rag_chain(file_path: str):
    """Load file_path, embed its chunks, and return an invokable RAG chain."""
    logger.info("Building RAG chain for: %s", file_path)
    
    chunks = load_and_split(file_path)
    vector_store = create_vector_store(chunks)
    retriever = vector_store.as_retriever(search_kwargs={"k": RETRIEVER_K})
    
    llm = OllamaLLM(model=LLM_MODEL)
    prompt = PromptTemplate.from_template(_PROMPT_TEMPLATE)

    def _build_inputs(question: str):  # ← FIXED: was _build_inp uts
        docs = retriever.invoke(question)
        return {
            "context": _format_docs(docs),  # ← FIXED: removed extra spaces
            "question": question,
            "_docs": docs,
        }

    answer_chain = (
        RunnableLambda(_build_inputs)
        | {
            "answer": (
                RunnableLambda(lambda x: {"context": x["context"], "question": x["question"]})
                | prompt | llm | StrOutputParser()
            ),
            "_docs": RunnableLambda(lambda x: x["_docs"]),
        }
    )
    logger.info("RAG chain ready (model=%s, k=%d).", LLM_MODEL, RETRIEVER_K)
    return answer_chain

def ask_question(chain, question: str) -> Tuple[str, List[str]]:
    """Run question through chain and return (answer, sources)."""
    if not question.strip():
        return "Please enter a question.", []
    
    logger.info("Processing question: %r", question[:80])
    result = chain.invoke(question)
    answer = result["answer"]
    sources = _extract_sources(result["_docs"])
    logger.info("Answer generated (%d chars, %d sources).", len(answer), len(sources))
    return answer, sources