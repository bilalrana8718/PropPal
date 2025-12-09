"""
Storage API endpoints for file uploads (Backblaze B2).
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Query
from typing import List
import os
from datetime import datetime

from services.storage.backblaze import upload_file

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.post("/upload", summary="Upload images to Backblaze B2")
async def upload_images(
    files: List[UploadFile] = File(...),
    clerk_id: str = Query(..., description="Clerk user ID"),
):
    """
    Upload one or more image files to Backblaze B2 storage.
    Returns public URLs for the uploaded images.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed per request"
        )
    
    uploaded_urls = []
    
    for file in files:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} is not an image"
            )
        
        # Validate file size (max 10MB)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds 10MB limit"
            )
        
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_ext = os.path.splitext(file.filename)[1] or ".jpg"
        unique_filename = f"properties/{clerk_id}/{timestamp}_{hash(file.filename) % 10000}{file_ext}"
        
        try:
            # Upload to Backblaze
            public_url = upload_file(
                file_content=file_content,
                file_name=unique_filename,
                content_type=file.content_type
            )
            uploaded_urls.append(public_url)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload {file.filename}: {str(e)}"
            )
    
    return {
        "success": True,
        "urls": uploaded_urls,
        "count": len(uploaded_urls)
    }


@router.post("/upload-documents", summary="Upload documents to Backblaze B2")
async def upload_documents(
    files: List[UploadFile] = File(...),
    clerk_id: str = Query(..., description="Clerk user ID"),
):
    """
    Upload documents (PDF, DOC, images, etc.) to Backblaze B2 storage.
    Returns public URLs for the uploaded documents.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed per request"
        )
    
    # Allowed document types
    allowed_types = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    ]
    
    uploaded_urls = []
    
    for file in files:
        # Validate file type
        if not file.content_type or file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} has unsupported type. Allowed: PDF, DOC, DOCX, XLS, XLSX, and images"
            )
        
        # Validate file size (max 10MB)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds 10MB limit"
            )
        
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_ext = os.path.splitext(file.filename)[1] or ".pdf"
        unique_filename = f"documents/{clerk_id}/{timestamp}_{hash(file.filename) % 10000}{file_ext}"
        
        try:
            # Upload to Backblaze
            public_url = upload_file(
                file_content=file_content,
                file_name=unique_filename,
                content_type=file.content_type
            )
            uploaded_urls.append(public_url)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload {file.filename}: {str(e)}"
            )
    
    return {
        "success": True,
        "urls": uploaded_urls,
        "count": len(uploaded_urls)
    }
