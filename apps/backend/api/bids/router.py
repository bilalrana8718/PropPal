"""
Bids API Router
Handles builder bid operations on user projects
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from common.db import get_database
from common.repositories.user_repository import UserRepository, get_user_repository
from common.repositories.bid_repository import BidRepository, get_bid_repository
from models.builder_bids import BuilderBidCreate, BuilderBidUpdate

router = APIRouter(prefix="/api/bids", tags=["bids"])


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
async def create_bid(
    bid_data: BuilderBidCreate,
    clerk_id: str = Query(..., description="Clerk user ID (builder)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Submit a bid on a project"""
    from bson import ObjectId
    import logging
    logger = logging.getLogger(__name__)
    
    builder_id = await get_user_id_from_clerk(clerk_id, user_repo)
    logger.info(f"Creating bid for builder_id: {builder_id}, project_id: {bid_data.project_id}")
    
    # Verify builder has a profile - check both string and ObjectId
    builder_profile = await db["builder_profiles"].find_one({
        "$or": [
            {"user_id": builder_id},
            {"user_id": ObjectId(builder_id)}
        ]
    })
    
    if not builder_profile:
        logger.warning(f"No builder profile found for user_id: {builder_id}")
        raise HTTPException(
            status_code=400, 
            detail="You need a builder profile to submit bids. Please create one first."
        )
    
    logger.info(f"Builder profile found: {builder_profile.get('_id')}")
    
    bid_repo = get_bid_repository(db)
    result = await bid_repo.create(builder_id, bid_data)
    
    if not result["success"]:
        logger.warning(f"Bid creation failed: {result}")
        if result.get("error") == "already_bid":
            raise HTTPException(status_code=409, detail=result["message"])
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to submit bid"))
    
    return result


@router.get("/project/{project_id}")
async def get_project_bids(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get all bids for a project (with builder details)"""
    bid_repo = get_bid_repository(db)
    bids = await bid_repo.get_project_bids(project_id, status=status, skip=skip, limit=limit)
    
    # Convert ObjectIds to strings
    for bid in bids:
        bid["_id"] = str(bid["_id"])
        bid["project_id"] = str(bid["project_id"])
        bid["builder_id"] = str(bid["builder_id"])
    
    return {
        "success": True,
        "bids": bids,
        "count": len(bids)
    }


@router.get("/builder")
async def get_builder_bids(
    clerk_id: str = Query(..., description="Clerk user ID (builder)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Get all bids submitted by a builder (with project details)"""
    builder_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    bid_repo = get_bid_repository(db)
    bids = await bid_repo.get_builder_bids(builder_id, status=status, skip=skip, limit=limit)
    
    # Convert ObjectIds to strings
    for bid in bids:
        bid["_id"] = str(bid["_id"])
        bid["project_id"] = str(bid["project_id"])
        bid["builder_id"] = str(bid["builder_id"])
    
    return {
        "success": True,
        "bids": bids,
        "count": len(bids)
    }


@router.get("/{bid_id}")
async def get_bid(
    bid_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get a specific bid with builder details"""
    bid_repo = get_bid_repository(db)
    bid = await bid_repo.get_by_id_with_builder(bid_id)
    
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    
    # Convert ObjectIds to strings
    bid["_id"] = str(bid["_id"])
    bid["project_id"] = str(bid["project_id"])
    bid["builder_id"] = str(bid["builder_id"])
    
    return {
        "success": True,
        "bid": bid
    }


@router.put("/{bid_id}")
async def update_bid(
    bid_id: str,
    update_data: BuilderBidUpdate,
    clerk_id: str = Query(..., description="Clerk user ID (builder)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Update a bid (only by owner, only if pending)"""
    builder_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    bid_repo = get_bid_repository(db)
    result = await bid_repo.update(bid_id, builder_id, update_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to update bid"))
    
    return result


@router.post("/{bid_id}/withdraw")
async def withdraw_bid(
    bid_id: str,
    clerk_id: str = Query(..., description="Clerk user ID (builder)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Withdraw a bid (only by owner)"""
    builder_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    bid_repo = get_bid_repository(db)
    result = await bid_repo.withdraw(bid_id, builder_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to withdraw bid"))
    
    return result


@router.post("/{bid_id}/shortlist")
async def shortlist_bid(
    bid_id: str,
    clerk_id: str = Query(..., description="Clerk user ID (project owner)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Shortlist a bid (only by project owner)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    bid_repo = get_bid_repository(db)
    result = await bid_repo.shortlist(bid_id, user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to shortlist bid"))
    
    return result


@router.post("/{bid_id}/reject")
async def reject_bid(
    bid_id: str,
    clerk_id: str = Query(..., description="Clerk user ID (project owner)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Reject a bid (only by project owner)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    
    bid_repo = get_bid_repository(db)
    result = await bid_repo.reject(bid_id, user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to reject bid"))
    
    return result


@router.post("/{bid_id}/accept")
async def accept_bid(
    bid_id: str,
    clerk_id: str = Query(..., description="Clerk user ID (project owner)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Accept a bid and award project (only by project owner)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    bid_repo = get_bid_repository(db)
    result = await bid_repo.accept(bid_id, user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to accept bid"))
    
    return result


@router.get("/check/{project_id}")
async def check_bid_status(
    project_id: str,
    clerk_id: str = Query(..., description="Clerk user ID (builder)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Check if builder has already bid on a project"""
    builder_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    bid_repo = get_bid_repository(db)
    has_bid = await bid_repo.has_builder_bid(project_id, builder_id)
    
    return {
        "success": True,
        "has_bid": has_bid
    }


@router.post("/generate-proposal")
async def generate_bid_proposal(
    project_title: str = Query(..., description="Project title"),
    project_type: str = Query(..., description="Type of project"),
    project_description: str = Query(None, description="Project description"),
    budget_min: float = Query(None, description="Minimum budget"),
    budget_max: float = Query(None, description="Maximum budget"),
    requirements: str = Query(None, description="Project requirements"),
    estimated_cost: str = Query(None, description="Builder's estimated cost"),
):
    """Generate a professional bid proposal using AI"""
    from langchain_groq import ChatGroq
    import os
    
    print(f"\n{'='*60}")
    print(f"[GENERATE PROPOSAL] Request received")
    print(f"Project: {project_title}")
    print(f"Type: {project_type}")
    print(f"Description: {project_description}")
    print(f"Budget: {budget_min} - {budget_max}")
    print(f"Requirements: {requirements}")
    print(f"{'='*60}\n")
    
    try:
        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.7,
            api_key=os.getenv("GROQ_API_KEY")
        )
        
        budget_info = ""
        if budget_min and budget_max:
            budget_info = f"Client's budget range: PKR {budget_min:,.0f} - {budget_max:,.0f}"
        
        cost_info = ""
        if estimated_cost:
            cost_info = f"Your proposed cost: PKR {estimated_cost}"
        
        prompt = f"""You are a professional construction and renovation contractor in Pakistan. 
Generate a compelling bid proposal for the following project:

Project Title: {project_title}
Project Type: {project_type}
{f'Description: {project_description}' if project_description else ''}
{budget_info}
{f'Requirements: {requirements}' if requirements else ''}
{cost_info}

Generate a professional proposal with:
1. A catchy proposal title (max 100 chars)
2. Detailed proposal (2-3 paragraphs explaining what you'll do, your expertise, and why you're the best choice)
3. Your approach to the project (brief methodology)

Format your response as:
TITLE: [your proposal title]
DETAILS: [your detailed proposal]
APPROACH: [your approach/methodology]

Be specific, professional, and persuasive. Use Pakistani construction context where appropriate."""

        print(f"[GENERATE PROPOSAL] Calling LLM...")
        response = llm.invoke(prompt)
        content = response.content
        print(f"[GENERATE PROPOSAL] LLM Response received:")
        print(f"{content[:500]}...")
        
        # Parse the response
        proposal_title = ""
        proposal_details = ""
        approach = ""
        
        lines = content.split('\n')
        current_section = None
        current_content = []
        
        for line in lines:
            line_upper = line.strip().upper()
            if line_upper.startswith('TITLE:'):
                if current_section and current_content:
                    if current_section == 'DETAILS':
                        proposal_details = ' '.join(current_content).strip()
                    elif current_section == 'APPROACH':
                        approach = ' '.join(current_content).strip()
                current_section = 'TITLE'
                proposal_title = line.split(':', 1)[1].strip() if ':' in line else ''
                current_content = []
            elif line_upper.startswith('DETAILS:'):
                if current_section and current_content:
                    if current_section == 'TITLE':
                        proposal_title = ' '.join(current_content).strip() if not proposal_title else proposal_title
                current_section = 'DETAILS'
                rest = line.split(':', 1)[1].strip() if ':' in line else ''
                current_content = [rest] if rest else []
            elif line_upper.startswith('APPROACH:'):
                if current_section and current_content:
                    if current_section == 'DETAILS':
                        proposal_details = ' '.join(current_content).strip()
                current_section = 'APPROACH'
                rest = line.split(':', 1)[1].strip() if ':' in line else ''
                current_content = [rest] if rest else []
            elif current_section:
                current_content.append(line.strip())
        
        # Handle last section
        if current_section == 'APPROACH' and current_content:
            approach = ' '.join(current_content).strip()
        elif current_section == 'DETAILS' and current_content:
            proposal_details = ' '.join(current_content).strip()
        
        print(f"\n[GENERATE PROPOSAL] Parsed results:")
        print(f"  Title: {proposal_title[:100] if proposal_title else 'EMPTY'}")
        print(f"  Details length: {len(proposal_details)} chars")
        print(f"  Approach length: {len(approach)} chars")
        
        result = {
            "success": True,
            "proposal_title": proposal_title or f"Professional {project_type.replace('_', ' ').title()} Services",
            "proposal_details": proposal_details or "We are excited to submit our proposal for your project.",
            "approach": approach or ""
        }
        print(f"[GENERATE PROPOSAL] Returning: {result['proposal_title']}")
        return result
        
    except Exception as e:
        print(f"[GENERATE PROPOSAL] ERROR: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate proposal: {str(e)}"
        )
