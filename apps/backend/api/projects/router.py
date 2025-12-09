"""
Projects API Router
Handles user project (job posting) operations
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from common.db import get_database
from common.repositories.user_repository import UserRepository, get_user_repository
from common.repositories.project_repository import ProjectRepository, get_project_repository
from models.user_projects import UserProjectCreate, UserProjectUpdate, UserProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


async def get_user_id_from_clerk(
    clerk_id: str,
    user_repo: UserRepository
) -> str:
    """Helper to get internal user ID from clerk ID"""
    user = await user_repo.get_user_by_clerk_id(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return str(user.id)


@router.post("")
async def create_project(
    project_data: UserProjectCreate,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Create a new project (job posting)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    project_repo = get_project_repository(db)
    result = await project_repo.create(user_id, project_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create project"))
    
    return result


@router.get("")
async def list_projects(
    clerk_id: Optional[str] = Query(None, description="Filter by user's clerk ID"),
    status: Optional[str] = Query(None, description="Filter by status: open, in_progress, completed, cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """List projects for a user"""
    if not clerk_id:
        raise HTTPException(status_code=400, detail="clerk_id is required")
    
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    project_repo = get_project_repository(db)
    projects = await project_repo.get_user_projects(user_id, status=status, skip=skip, limit=limit)
    
    # Convert ObjectIds to strings for JSON serialization
    for project in projects:
        project["_id"] = str(project["_id"])
        project["user_id"] = str(project["user_id"])
        if project.get("property_id"):
            project["property_id"] = str(project["property_id"])
        if project.get("awarded_to"):
            project["awarded_to"] = str(project["awarded_to"])
    
    return {
        "success": True,
        "projects": projects,
        "count": len(projects)
    }


@router.get("/search")
async def search_projects(
    q: Optional[str] = Query(None, description="Search query"),
    city: Optional[str] = Query(None, description="Filter by city"),
    project_type: Optional[str] = Query(None, description="Filter by project type"),
    budget_min: Optional[float] = Query(None, description="Minimum budget"),
    budget_max: Optional[float] = Query(None, description="Maximum budget"),
    status: str = Query("open", description="Project status"),
    exclude_user_id: Optional[str] = Query(None, description="Exclude projects from this user ID"),
    exclude_clerk_id: Optional[str] = Query(None, description="Exclude projects from this clerk ID (resolved to user ID)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Search projects (for builders to find jobs)"""
    
    # Resolve exclude_clerk_id to exclude_user_id if provided
    resolved_exclude_user_id = exclude_user_id
    if exclude_clerk_id and not exclude_user_id:
        try:
            user = await user_repo.get_user_by_clerk_id(exclude_clerk_id)
            if user:
                resolved_exclude_user_id = str(user.id)
                print(f"[SEARCH PROJECTS] Resolved clerk_id {exclude_clerk_id} to user_id {resolved_exclude_user_id}")
        except Exception as e:
            print(f"[SEARCH PROJECTS] Error resolving clerk_id: {e}")
    
    print(f"[SEARCH PROJECTS] exclude_user_id: {resolved_exclude_user_id}")
    
    project_repo = get_project_repository(db)
    projects = await project_repo.search_projects(
        query=q,
        city=city,
        project_type=project_type,
        budget_min=budget_min,
        budget_max=budget_max,
        status=status,
        exclude_user_id=resolved_exclude_user_id,
        skip=skip,
        limit=limit
    )
    
    # Convert ObjectIds to strings
    for project in projects:
        project["_id"] = str(project["_id"])
        project["user_id"] = str(project["user_id"])
        if project.get("property_id"):
            project["property_id"] = str(project["property_id"])
        if project.get("awarded_to"):
            project["awarded_to"] = str(project["awarded_to"])
    
    return {
        "success": True,
        "projects": projects,
        "count": len(projects)
    }


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get a project by ID with user details"""
    project_repo = get_project_repository(db)
    project = await project_repo.get_by_id_with_user(project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Convert ObjectIds to strings
    project["_id"] = str(project["_id"])
    project["user_id"] = str(project["user_id"])
    if project.get("property_id"):
        project["property_id"] = str(project["property_id"])
    if project.get("awarded_to"):
        project["awarded_to"] = str(project["awarded_to"])
    
    return {
        "success": True,
        "project": project
    }


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    update_data: UserProjectUpdate,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Update a project (only by owner)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    project_repo = get_project_repository(db)
    result = await project_repo.update(project_id, user_id, update_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to update project"))
    
    return result


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Delete a project (only by owner)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    project_repo = get_project_repository(db)
    result = await project_repo.delete(project_id, user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to delete project"))
    
    return result


@router.post("/{project_id}/award/{builder_id}")
async def award_project(
    project_id: str,
    builder_id: str,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Award a project to a builder"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    project_repo = get_project_repository(db)
    result = await project_repo.award_project(project_id, user_id, builder_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to award project"))
    
    return result


@router.get("/{project_id}/stats")
async def get_project_stats(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get project statistics (bid count, etc.)"""
    project_repo = get_project_repository(db)
    project = await project_repo.get_by_id(project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "success": True,
        "bid_count": project.get("bid_count", 0),
        "status": project.get("status", "open"),
        "awarded_to": str(project["awarded_to"]) if project.get("awarded_to") else None
    }


from pydantic import BaseModel
from typing import Optional, List as TypingList


class ProjectDescriptionRequest(BaseModel):
    """Request model for generating project description"""
    title: Optional[str] = None
    project_type: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    timeline: Optional[str] = None
    requirements: Optional[TypingList[str]] = []


@router.post("/generate-description", summary="Generate project description using LLM")
async def generate_project_description(
    project_data: ProjectDescriptionRequest,
    clerk_id: str = Query(..., description="Clerk user ID"),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Generate a project description using AI based on project details"""
    from langchain_groq import ChatGroq
    import os
    
    # Verify user
    user = await user_repo.get_user_by_clerk_id(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Build prompt from project data
        project_type = project_data.project_type or ""
        title = project_data.title or ""
        city = project_data.city or ""
        location = project_data.location or ""
        budget_min = project_data.budget_min
        budget_max = project_data.budget_max
        timeline = project_data.timeline or ""
        requirements = project_data.requirements or []
        
        budget_str = "Not specified"
        if budget_min and budget_max:
            budget_str = f"PKR {budget_min:,.0f} - PKR {budget_max:,.0f}"
        elif budget_min:
            budget_str = f"PKR {budget_min:,.0f}+"
        elif budget_max:
            budget_str = f"Up to PKR {budget_max:,.0f}"
        
        prompt = f"""Generate a professional and detailed project description for a construction/renovation project posting.
        
Project Details:
- Type: {project_type}
- Title: {title}
- Location: {location or city}
- City: {city}
- Budget Range: {budget_str}
- Timeline: {timeline or "Not specified"}
- Requirements: {', '.join(requirements) if requirements else "Not specified"}

Write a compelling 2-3 paragraph description that:
1. Clearly describes the scope of work
2. Highlights key requirements and expectations
3. Sets professional tone for attracting qualified builders
4. Mentions any specific materials or quality standards if applicable

Only output the description text, no headers or labels."""

        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            api_key=os.getenv("GROQ_API_KEY")
        )
        
        response = await llm.ainvoke(prompt)
        description = response.content.strip()
        
        return {
            "success": True,
            "description": description
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate description: {str(e)}")
